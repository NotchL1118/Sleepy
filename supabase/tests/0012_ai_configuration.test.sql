begin;
create extension if not exists pgtap with schema extensions;
select plan(22);
create function pg_temp.error_code(statement text) returns text language plpgsql as $$
begin execute statement; return '<no exception>'; exception when others then return sqlstate; end;
$$;
delete from private.site_admins;
insert into auth.users(id, email) values ('99999999-9999-4999-8999-999999999927', 'ai-db-admin@example.test');
insert into private.site_admins(user_id) values ('99999999-9999-4999-8999-999999999927');
set local role authenticated;
select set_config('request.jwt.claim.sub', '99999999-9999-4999-8999-999999999927', true);
select lives_ok($$select public.ai_save_model(
 '{"id":"99999999-9999-4999-8999-999999999921","name":"First","protocol":"openai-completions","endpoint":"https://api.example/v1","model":"test","context_window":8192,"max_output_tokens":512,"enabled":true}',
 null, '{"version":"test","iv":"test","tag":"test","data":"encrypted-test"}', true)$$,
 'Admin can persist a model with encrypted credential');
select is((select public.ai_list_configuration()->'models' @> '[{"id":"99999999-9999-4999-8999-999999999921","key_set":true}]'), true,
 'configuration reads return credential status');
select is(position('encrypted-test' in public.ai_list_configuration()::text), 0,
 'configuration listing never returns ciphertext');
select lives_ok($$select public.ai_update_settings('{"default_model_id":"99999999-9999-4999-8999-999999999921"}')$$,
 'Admin selects an available default');
select is(public.ai_model_snapshot()->'model'->>'id', '99999999-9999-4999-8999-999999999921',
 'snapshot uses the persisted default');
select ok((public.ai_list_configuration()->'settings'->'prompts') ?& array['summary','slug','outline'],
 'initialization persisted all three instructions');
select lives_ok($$select public.ai_update_settings('{"prompts":{"summary":"Admin summary","slug":"Admin slug","outline":"Admin outline"}}')$$,
 'Admin can edit shared prompts');
select is(public.ai_model_snapshot()->'settings'->'prompts'->>'outline', 'Admin outline',
 'model snapshots read the shared edited instructions');
select is(pg_temp.error_code($$select public.ai_save_model(
 '{"id":"99999999-9999-4999-8999-999999999921","name":"Stale","protocol":"openai-completions","endpoint":"https://api.example/v1","model":"test","context_window":8192,"max_output_tokens":512,"enabled":true}',
 7, null, false)$$), '40001', 'stale writes cannot overwrite a configuration');
select lives_ok($$update private.ai_models set endpoint = 'https://new.example/v1' where id = '99999999-9999-4999-8999-999999999921'$$,
 'Admin can change the target');
select is((public.ai_model_snapshot()->'model'->>'credential'), null::text,
 'database target changes clear the previous credential');
select is(pg_temp.error_code($$select public.ai_update_settings('{"default_model_id":"99999999-9999-4999-8999-999999999921"}')$$),
 'P0001', 'a default must have a usable credential');
select lives_ok($$select public.ai_update_settings('{"enabled":false}')$$, 'Admin can disable model calls');
select is((public.ai_list_configuration()->'settings'->>'enabled')::boolean, false, 'disabled state persists');
reset role;
insert into private.ai_settings(singleton, prompts) values (true, '{"summary":"Seed","slug":"Seed","outline":"Seed"}')
on conflict (singleton) do nothing;
select is((select prompts->>'summary' from private.ai_settings), 'Admin summary',
 'idempotent initialization preserves Admin edits');
set local role authenticated;
select set_config('request.jwt.claim.sub', '99999999-9999-4999-8999-999999999928', true);
select is((select count(*)::integer from private.ai_models), 0, 'Readers cannot read private model rows');
select is((select count(*)::integer from private.ai_settings), 0, 'Readers cannot read settings');
select is(pg_temp.error_code('select public.ai_list_configuration()'), '42501', 'Readers cannot invoke config reads');
select is(pg_temp.error_code('select public.ai_model_snapshot()'), '42501', 'Readers cannot invoke credential snapshot reads');
select is(pg_temp.error_code($$select public.ai_update_settings('{"enabled":true}')$$), '42501', 'Readers cannot mutate settings');
set local role anon;
select is(pg_temp.error_code('select public.ai_list_configuration()'), '42501', 'anonymous callers cannot read configurations');
select is(pg_temp.error_code('select public.ai_model_snapshot()'), '42501', 'anonymous callers cannot read encrypted credentials');
reset role;
select * from finish();
rollback;

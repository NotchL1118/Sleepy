begin;
create extension if not exists pgtap with schema extensions;
select plan(33);
create function pg_temp.error_code(statement text) returns text language plpgsql as $$
begin execute statement; return '<no exception>'; exception when others then return sqlstate; end;
$$;
delete from private.site_admins;
insert into auth.users(id, email) values ('99999999-9999-4999-8999-999999999927', 'ai-db-admin@example.test');
insert into private.site_admins(user_id) values ('99999999-9999-4999-8999-999999999927');
set local role authenticated;
select set_config('request.jwt.claim.sub', '99999999-9999-4999-8999-999999999927', true);
select lives_ok($$select public.ai_save_model(
 '{"id":"99999999-9999-4999-8999-999999999921","name":"First","protocol":"openai-completions","endpoint":"https://api.example/v1","model":"test","max_output_tokens":512}',
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
select ok((public.ai_list_configuration()->'settings'->'prompts') ?& array['summary','slug'],
 'initialization persisted both instructions');
select lives_ok($$select public.ai_update_settings('{"prompts":{"summary":"Admin summary","slug":"Admin slug"}}')$$,
 'Admin can edit shared prompts');
select is(public.ai_model_snapshot()->'settings'->'prompts'->>'slug', 'Admin slug',
 'model snapshots read the shared edited instructions');
select is(pg_temp.error_code($$select public.ai_save_model(
 '{"id":"99999999-9999-4999-8999-999999999921","name":"Stale","protocol":"openai-completions","endpoint":"https://api.example/v1","model":"test","max_output_tokens":512}',
 7, null, false)$$), '40001', 'stale writes cannot overwrite a configuration');
select lives_ok($$update private.ai_models set endpoint = 'https://new.example/v1' where id = '99999999-9999-4999-8999-999999999921'$$,
 'Admin can change the target');
select is((public.ai_model_snapshot()->'model'->>'credential'), null::text,
 'database target changes clear the previous credential');
select is(pg_temp.error_code($$select public.ai_update_settings('{"default_model_id":"99999999-9999-4999-8999-999999999921"}')$$),
 'P0001', 'a default must have a usable credential');
select lives_ok($$select public.ai_update_settings('{"enabled":false}')$$, 'Admin can disable model calls');
select is((public.ai_list_configuration()->'settings'->>'enabled')::boolean, false, 'disabled state persists');
select ok(not (public.ai_model_snapshot()->'model' ?| array['context_window', 'enabled']),
 'connection records no longer expose context or independent enabled flags');
select ok(not (public.ai_list_configuration()->'settings'->'prompts' ? 'outline'),
 'outline instructions were removed');
select is(pg_temp.error_code($$select public.ai_update_settings('{"enabled":true,"prompts":{"summary":"","slug":"bad"}}')$$), '23514',
 'invalid preferences fail in the transaction');
select is((public.ai_list_configuration()->'settings'->>'enabled')::boolean, false,
 'invalid preference save cannot partially change the switch');
select lives_ok($$select public.ai_save_model(
 '{"id":"99999999-9999-4999-8999-999999999922","name":"Delete me","protocol":"openai-completions","endpoint":"https://api.example/v1","model":"test","max_output_tokens":512}',
 null, '{"version":"test","iv":"test","tag":"test","data":"encrypted-test"}', true)$$,
 'Admin creates another connection without context capacity');
select lives_ok($$select public.ai_update_settings('{"default_model_id":"99999999-9999-4999-8999-999999999922"}')$$,
 'Admin changes the active connection');
select is(pg_temp.error_code($$select public.ai_delete_model('99999999-9999-4999-8999-999999999922', 7)$$), '40001',
 'stale deletion is rejected');
select is(public.ai_model_snapshot()->'model'->>'id', '99999999-9999-4999-8999-999999999922',
 'stale deletion keeps the active selection');
select lives_ok($$select public.ai_delete_model('99999999-9999-4999-8999-999999999922', 1)$$,
 'Admin deletes the active connection');
select is(public.ai_list_configuration()->'settings'->>'default_model_id', null::text,
 'active deletion atomically clears the reference');
reset role;
insert into private.ai_settings(singleton, prompts) values (true, '{"summary":"Seed","slug":"Seed"}')
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
select is(pg_temp.error_code($$select public.ai_delete_model('99999999-9999-4999-8999-999999999921', 1)$$), '42501', 'Readers cannot delete connections');
set local role anon;
select is(pg_temp.error_code('select public.ai_list_configuration()'), '42501', 'anonymous callers cannot read configurations');
select is(pg_temp.error_code('select public.ai_model_snapshot()'), '42501', 'anonymous callers cannot read encrypted credentials');
reset role;
select * from finish();
rollback;

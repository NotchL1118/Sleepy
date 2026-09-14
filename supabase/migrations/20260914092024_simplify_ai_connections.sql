-- Connections keep their IDs and credential bindings. Only the global AI switch remains.
-- Do not accidentally activate a previously disabled selected connection during the upgrade.
update private.ai_settings s set default_model_id = null
from private.ai_models m where s.default_model_id = m.id and not m.enabled;
alter table private.ai_models drop column context_window, drop column enabled;
alter table private.ai_models add constraint ai_models_output_positive check (max_output_tokens > 0);

alter table private.ai_settings drop constraint ai_settings_prompts_check;
update private.ai_settings set prompts = prompts - 'outline';
alter table private.ai_settings add constraint ai_settings_prompts_check check (
  jsonb_typeof(prompts) = 'object'
  and prompts ?& array['summary', 'slug']
  and prompts - 'summary' - 'slug' = '{}'::jsonb
  and jsonb_typeof(prompts->'summary') = 'string'
  and jsonb_typeof(prompts->'slug') = 'string'
  and length(btrim(prompts->>'summary')) between 1 and 32000
  and length(btrim(prompts->>'slug')) between 1 and 32000
);

create or replace function public.ai_save_model(
  p_model jsonb, p_expected_revision integer, p_credential jsonb, p_replace_credential boolean
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid := (p_model->>'id')::uuid;
begin
  if not private.is_admin() then raise insufficient_privilege; end if;
  perform 1 from private.ai_settings where singleton for update;
  if not found then raise exception using errcode = 'P0001', message = 'ai_settings_missing'; end if;
  if p_expected_revision is null then
    insert into private.ai_models(id, name, protocol, endpoint, model, max_output_tokens)
    values (v_id, p_model->>'name', p_model->>'protocol', p_model->>'endpoint', p_model->>'model',
      (p_model->>'max_output_tokens')::integer);
  else
    update private.ai_models set name = p_model->>'name', protocol = p_model->>'protocol',
      endpoint = p_model->>'endpoint', model = p_model->>'model',
      max_output_tokens = (p_model->>'max_output_tokens')::integer, revision = revision + 1
    where id = v_id and revision = p_expected_revision;
    if not found then raise exception using errcode = '40001', message = 'ai_model_conflict'; end if;
  end if;
  if p_replace_credential then
    update private.ai_models set credential = p_credential where id = v_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.ai_update_settings(p_patch jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if not private.is_admin() then raise insufficient_privilege; end if;
  perform 1 from private.ai_settings where singleton for update;
  if not found then raise exception using errcode = 'P0001', message = 'ai_settings_missing'; end if;
  if p_patch ? 'default_model_id' and p_patch->>'default_model_id' is not null then
    perform 1 from private.ai_models where id = (p_patch->>'default_model_id')::uuid and credential is not null;
    if not found then raise exception using errcode = 'P0001', message = 'ai_model_unavailable'; end if;
  end if;
  update private.ai_settings set
    default_model_id = case when p_patch ? 'default_model_id' then (p_patch->>'default_model_id')::uuid else default_model_id end,
    enabled = case when p_patch ? 'enabled' then (p_patch->>'enabled')::boolean else enabled end,
    prompts = case when p_patch ? 'prompts' then p_patch->'prompts' else prompts end
  where singleton;
end;
$$;

grant delete on private.ai_models to authenticated;
create function public.ai_delete_model(p_id uuid, p_expected_revision integer) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if not private.is_admin() then raise insufficient_privilege; end if;
  perform 1 from private.ai_settings where singleton for update;
  if not found then raise exception using errcode = 'P0001', message = 'ai_settings_missing'; end if;
  perform 1 from private.ai_models where id = p_id and revision = p_expected_revision for update;
  if not found then raise exception using errcode = '40001', message = 'ai_model_conflict'; end if;
  update private.ai_settings set default_model_id = null where singleton and default_model_id = p_id;
  delete from private.ai_models where id = p_id;
end;
$$;
revoke all on function public.ai_delete_model(uuid, integer) from public, anon;
grant execute on function public.ai_delete_model(uuid, integer) to authenticated;

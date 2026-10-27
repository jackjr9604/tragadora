-- Read-only. Execute after 202610270002.
select source_language_override='en' as override_ok
from public.translation_resource_fields
where resource_type='account_plan_translation' and field_name='payout_frequency';
select public.translation_effective_source_language('account_plan_translation','payout_frequency')='en' as effective_source_ok;
select target_language,source_language,count(*)
from public.translation_field_state
where resource_type='account_plan_translation' and field_name='payout_frequency'
group by target_language,source_language order by target_language,source_language;
select count(*)=0 as no_null_source_states
from public.translation_field_state s join public.account_plans ap on ap.id::text=s.resource_id
where s.resource_type='account_plan_translation' and s.field_name='payout_frequency'
  and(s.target_language='es' or s.target_language='pt') and nullif(btrim(ap.payout_frequency),'') is null;
select count(*)=0 as no_active_en_jobs
from public.translation_jobs where resource_type='account_plan_translation' and field_name='payout_frequency'
  and target_language='en' and status in('queued','running','retry_wait');
select routine_name,security_type
from information_schema.routines
where routine_schema='public' and routine_name in('translation_effective_source_language','translation_request_ai_draft','translation_admin_language_coverage','translation_admin_content_center_inventory','translation_admin_content_center_summary')
order by routine_name;

do $$
declare trigger_count integer;field_pk boolean;override_fk boolean;
begin
  select count(*) into trigger_count from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='account_plans' and not t.tgisinternal
    and t.tgname in('translation_challenge_source_insert','translation_challenge_source_update','translation_challenge_source_delete') and t.tgenabled<>'D';
  if trigger_count<>3 then raise exception 'Triggers account_plans incompatibles: %',trigger_count;end if;
  select exists(select 1 from pg_constraint c where c.conrelid='public.translation_resource_fields'::regclass and c.contype='p'
    and pg_get_constraintdef(c.oid)='PRIMARY KEY (resource_type, field_name)') into field_pk;
  if not field_pk then raise exception 'PK translation_resource_fields incompatible';end if;
  select exists(select 1 from pg_constraint c where c.conrelid='public.translation_resource_fields'::regclass and c.contype='f'
    and pg_get_constraintdef(c.oid) like 'FOREIGN KEY (source_language_override) REFERENCES languages(code)%') into override_fk;
  if not override_fk then raise exception 'FK source_language_override ausente o incompatible';end if;
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in('translation_effective_source_language','translation_request_ai_draft','translation_admin_language_coverage','translation_admin_content_center_inventory','translation_admin_content_center_summary')
      and(not p.prosecdef or pg_get_userbyid(p.proowner)<>'postgres' or not coalesce(p.proconfig,'{}') @> array['search_path=pg_catalog, public'])) then
    raise exception 'SECURITY DEFINER, owner o search_path incompatible';end if;
  if has_function_privilege('anon','public.translation_effective_source_language(text,text)','EXECUTE')
     or has_function_privilege('authenticated','public.translation_effective_source_language(text,text)','EXECUTE')
     or has_function_privilege('service_role','public.translation_effective_source_language(text,text)','EXECUTE') then raise exception 'Helper de fuente expuesto';end if;
  if has_function_privilege('anon','public.translation_request_ai_draft(uuid,bigint,integer,integer,integer,integer,boolean)','EXECUTE')
     or not has_function_privilege('authenticated','public.translation_request_ai_draft(uuid,bigint,integer,integer,integer,integer,boolean)','EXECUTE') then raise exception 'ACL translation_request_ai_draft incompatible';end if;
  if has_function_privilege('anon','public.translation_admin_language_coverage(text[])','EXECUTE')
     or has_function_privilege('authenticated','public.translation_admin_language_coverage(text[])','EXECUTE')
     or not has_function_privilege('service_role','public.translation_admin_language_coverage(text[])','EXECUTE') then raise exception 'ACL cobertura incompatible';end if;
end $$;

select 'translation_field_source_language_postcheck: PASS' as result;

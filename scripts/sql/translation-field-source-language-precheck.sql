-- Read-only. Execute before 202610270002.
select current_setting('server_version_num')::integer between 150000 and 159999 as postgres_15,
       current_setting('server_version_num')::integer between 170000 and 170999 as postgres_17;
do $$
declare version_num integer:=current_setting('server_version_num')::integer;
begin
  if not(version_num between 150000 and 159999 or version_num between 170000 and 170999) then
    raise exception 'Versión PostgreSQL no validada para esta migración: %',version_num using errcode='0A000';
  end if;
end $$;
select to_regclass('public.translation_resource_fields') is not null as resource_fields_exists,
       to_regclass('public.translation_field_state') is not null as field_state_exists,
       to_regclass('public.account_plans') is not null as account_plans_exists;
select count(*) filter(where nullif(btrim(payout_frequency),'') is not null) as nonempty_sources,
       count(distinct payout_frequency) filter(where nullif(btrim(payout_frequency),'') is not null) as exact_distinct_sources,
       count(*) filter(where payout_frequency is null or btrim(payout_frequency)='') as null_or_blank
from public.account_plans;
select target_language,status,workflow_status,publication_status,is_protected,count(*)
from public.translation_field_state
where resource_type='account_plan_translation' and field_name='payout_frequency'
group by target_language,status,workflow_status,publication_status,is_protected
order by target_language,status,workflow_status;
select count(*) as pt_hash_mismatches
from public.translation_field_state s join public.account_plans ap on ap.id::text=s.resource_id
where s.resource_type='account_plan_translation' and s.field_name='payout_frequency' and s.target_language='pt'
  and nullif(btrim(ap.payout_frequency),'') is not null
  and s.source_hash<>public.translation_hash(to_jsonb(ap.payout_frequency));

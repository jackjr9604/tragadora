\set ON_ERROR_STOP on
create extension if not exists dblink;

do $$
declare plan_id uuid;state_id uuid;before_lock bigint;before_revision bigint;before_hash text;started timestamptz;elapsed interval;result record;
begin
  select ap.id into plan_id from public.account_plans ap where ap.payout_frequency is not null order by ap.account_size limit 1;
  select id,lock_version,source_revision,source_hash into state_id,before_lock,before_revision,before_hash
  from public.translation_field_state where resource_type='account_plan_translation' and resource_id=plan_id::text and field_name='payout_frequency' and target_language='es';
  perform dblink_connect('source_language_race','dbname='||current_database());
  perform dblink_exec('source_language_race','begin');
  perform dblink_exec('source_language_race',format('update public.translation_field_state set lock_version=lock_version+1,updated_at=now() where id=%L',state_id));
  perform dblink_send_query('source_language_race','select 1 from pg_sleep(1); commit');
  started:=clock_timestamp();
  update public.account_plans set payout_frequency=payout_frequency||' race' where id=plan_id;
  elapsed:=clock_timestamp()-started;
  while dblink_is_busy('source_language_race')=1 loop perform pg_sleep(0.05);end loop;
  for result in select * from dblink_get_result('source_language_race') as x(waited integer) loop null;end loop;
  perform dblink_disconnect('source_language_race');
  if elapsed<interval '0.7 seconds' then raise exception 'La escritura no esperó el lock remoto: %',elapsed;end if;
  if not exists(select 1 from public.translation_field_state where id=state_id and lock_version=before_lock+1 and source_revision=before_revision+1 and source_hash<>before_hash) then
    raise exception 'La carrera perdió lock_version, revisión o hash';end if;
exception when others then
  begin perform dblink_disconnect('source_language_race');exception when others then null;end;
  raise;
end $$;

select 'translation_field_source_language_concurrency_test: PASS' as result;

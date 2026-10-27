\set ON_ERROR_STOP on
create extension if not exists dblink;

begin;
create table public.translation_exact_group_concurrency_fixture(kind text primary key,state_id uuid not null,lock_version bigint not null);
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('a5270000-0000-4000-8000-000000000002','authenticated','authenticated','exact-groups-race@local.invalid',crypt('LocalOnly!',gen_salt('bf')),now(),'{}','{}',now(),now())
on conflict(id) do nothing;
select set_config('request.jwt.claim.role','service_role',false);
update public.profiles set role='super_admin' where id='a5270000-0000-4000-8000-000000000002';
with repeated as(
  select source_hash from public.translation_field_state where resource_type='account_plan_translation' and field_name='payout_frequency' and target_language='es' and workflow_status='none' and not is_protected group by source_hash having count(*)>=2 order by count(*) desc limit 1
), ranked as(
  select s.id,s.lock_version,row_number() over(order by s.id) position from public.translation_field_state s join repeated r using(source_hash)
  where s.resource_type='account_plan_translation' and s.field_name='payout_frequency' and s.target_language='es' and s.workflow_status='none' and not s.is_protected
)
insert into public.translation_exact_group_concurrency_fixture select case position when 1 then 'proposal' else 'target' end,id,lock_version from ranked where position<=2;
update public.translation_field_state s set draft_value=to_jsonb('Propuesta de carrera'::text),draft_source_hash=s.source_hash,draft_source_revision=s.source_revision,
 workflow_status='draft',draft_updated_at=now(),translation_method='libretranslate',provider='libretranslate-local',status='machine_translated',lock_version=s.lock_version+1
from public.translation_exact_group_concurrency_fixture f where f.kind='proposal' and f.state_id=s.id;
update public.translation_exact_group_concurrency_fixture f set lock_version=s.lock_version from public.translation_field_state s where s.id=f.state_id;
grant select on public.translation_exact_group_concurrency_fixture to authenticated;
commit;

select dblink_connect('exact_group_race','dbname='||current_database());
set role authenticated;
select set_config('request.jwt.claim.role','authenticated',false);
select set_config('request.jwt.claim.sub','a5270000-0000-4000-8000-000000000002',false);
do $$
declare proposal_id uuid;proposal_lock bigint;target_id uuid;target_lock bigint;started timestamptz;elapsed interval;payload jsonb;remote record;
begin
  select state_id,lock_version into proposal_id,proposal_lock from public.translation_exact_group_concurrency_fixture where kind='proposal';
  select state_id,lock_version into target_id,target_lock from public.translation_exact_group_concurrency_fixture where kind='target';
  perform dblink_exec('exact_group_race','begin');
  perform dblink_exec('exact_group_race',format('update public.translation_field_state set lock_version=lock_version+1,updated_at=now() where id=%L',target_id));
  perform dblink_send_query('exact_group_race','select 1 from pg_sleep(1); commit');
  started:=clock_timestamp();
  payload:=public.translation_admin_apply_exact_group_proposal(proposal_id,proposal_lock,jsonb_build_array(jsonb_build_object('state_id',target_id,'expected_lock_version',target_lock)));
  elapsed:=clock_timestamp()-started;
  while dblink_is_busy('exact_group_race')=1 loop perform pg_sleep(0.05);end loop;
  for remote in select * from dblink_get_result('exact_group_race') as x(waited integer) loop null;end loop;
  perform dblink_disconnect('exact_group_race');
  if elapsed<interval '0.7 seconds' then raise exception 'La aplicación no esperó el lock remoto: %',elapsed;end if;
  if (payload->>'applied')::integer<>0 or (payload->>'conflicts')::integer<>1 then raise exception 'La carrera no produjo conflicto seguro: %',payload;end if;
exception when others then
  begin perform dblink_disconnect('exact_group_race');exception when others then null;end;
  raise;
end $$;
reset role;

do $$
begin
  if exists(
    select 1 from public.translation_field_state s
    join public.translation_exact_group_concurrency_fixture f on f.state_id=s.id and f.kind='target'
    where s.workflow_status<>'none'
  ) then raise exception 'La carrera sobrescribió el registro concurrente';end if;
end $$;

drop table public.translation_exact_group_concurrency_fixture;
select 'translation_exact_groups_concurrency_test: PASS' result;

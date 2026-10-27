\set ON_ERROR_STOP on

begin;
set local role service_role;
set local request.jwt.claim.role='service_role';

do $$ declare groups integer;fields bigint;begin
  with pages as(
    select result.* from generate_series(1,10) page
    cross join lateral public.translation_admin_exact_group_inventory(array['account_plan_translation'],'account_plan_translation','payout_frequency',null,'all',null,page,100) result
  ) select coalesce(max(total_count),0),coalesce(sum(resource_count),0) into groups,fields from pages;
  if groups<170 or fields<>2808 then raise exception 'Agrupación inesperada: grupos %, campos %',groups,fields;end if;
  if exists(select 1 from public.translation_admin_exact_group_inventory(array['account_plan_translation'],'account_plan_translation','payout_frequency','en','all',null,1,100)) then raise exception 'EN fuente apareció como destino activo';end if;
end $$;

do $$ declare group_row record;member_count bigint;begin
  select * into group_row from public.translation_admin_exact_group_inventory(array['account_plan_translation'],'account_plan_translation','payout_frequency','es','pending',null,1,100) order by resource_count desc limit 1;
  if group_row.resource_count<2 or group_row.source_value is null then raise exception 'No se recuperó grupo repetido con fuente';end if;
  select max(total_count) into member_count from public.translation_admin_exact_group_members(array['account_plan_translation'],group_row.resource_type,group_row.field_name,group_row.source_hash,group_row.target_language,1,100);
  if member_count<>group_row.resource_count then raise exception 'Miembros % no coinciden con grupo %',member_count,group_row.resource_count;end if;
end $$;

reset role;
do $$ begin
  if has_function_privilege('anon','public.translation_admin_apply_exact_group_proposal(uuid,bigint,jsonb)','EXECUTE') or has_function_privilege('service_role','public.translation_admin_apply_exact_group_proposal(uuid,bigint,jsonb)','EXECUTE') or not has_function_privilege('authenticated','public.translation_admin_apply_exact_group_proposal(uuid,bigint,jsonb)','EXECUTE') then raise exception 'ACL de aplicación incorrecta';end if;
  if exists(select 1 from public.translation_jobs) then raise exception 'El inventario generó jobs';end if;
end $$;

reset request.jwt.claim.role;
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('a5270000-0000-4000-8000-000000000001','authenticated','authenticated','exact-groups@local.invalid',crypt('LocalOnly!',gen_salt('bf')),now(),'{}','{}',now(),now())
on conflict(id) do nothing;
select set_config('request.jwt.claim.role','service_role',true);
update public.profiles set role='super_admin' where id='a5270000-0000-4000-8000-000000000001';
reset role;

create temporary table exact_apply_ids(kind text primary key,state_id uuid,lock_version bigint);
with repeated as(
  select source_hash from public.translation_field_state where resource_type='account_plan_translation' and field_name='payout_frequency' and target_language='es' and workflow_status='none' and not is_protected group by source_hash having count(*)>=2 order by count(*) desc limit 1
), ranked as(
  select s.id,s.lock_version,row_number() over(order by s.id) position from public.translation_field_state s join repeated r using(source_hash)
  where s.resource_type='account_plan_translation' and s.field_name='payout_frequency' and s.target_language='es' and s.workflow_status='none' and not s.is_protected
)
insert into exact_apply_ids select case position when 1 then 'proposal' else 'target' end,id,lock_version from ranked where position<=2;
update public.translation_field_state s set draft_value=to_jsonb('Propuesta exacta local'::text),draft_source_hash=s.source_hash,draft_source_revision=s.source_revision,
  workflow_status='draft',draft_updated_at=now(),translation_method='libretranslate',provider='libretranslate-local',status='machine_translated',lock_version=s.lock_version+1
from exact_apply_ids i where i.kind='proposal' and i.state_id=s.id;
update exact_apply_ids i set lock_version=s.lock_version from public.translation_field_state s where s.id=i.state_id;
grant select on exact_apply_ids to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','a5270000-0000-4000-8000-000000000001',true);
select public.translation_admin_apply_exact_group_proposal(
  (select state_id from exact_apply_ids where kind='proposal'),(select lock_version from exact_apply_ids where kind='proposal'),
  jsonb_build_array(jsonb_build_object('state_id',(select state_id from exact_apply_ids where kind='target'),'expected_lock_version',(select lock_version from exact_apply_ids where kind='target')))
);
reset role;

do $$ begin
  if not exists(select 1 from public.translation_field_state s join exact_apply_ids i on i.kind='target' and i.state_id=s.id where s.workflow_status='draft' and s.status='machine_translated' and s.translation_method='libretranslate' and s.draft_value=to_jsonb('Propuesta exacta local'::text) and s.publication_status='unpublished' and s.lock_version=i.lock_version+1) then raise exception 'La propuesta no creó un borrador individual trazable';end if;
  if not exists(select 1 from public.admin_audit_log where actor_user_id='a5270000-0000-4000-8000-000000000001' and action='translation.exact_group.apply') then raise exception 'Falta auditoría por elemento';end if;
  if exists(select 1 from public.translation_field_state s join exact_apply_ids i on i.state_id=s.id where s.publication_status='published') then raise exception 'La agrupación publicó contenido';end if;
end $$;

rollback;
select 'translation_exact_groups_postgres_test: PASS' result;

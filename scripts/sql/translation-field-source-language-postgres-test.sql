\set ON_ERROR_STOP on

create temporary table before_states as
select id,resource_id,target_language,source_language,source_hash,source_revision,status,workflow_status,
       publication_status,is_protected,protection_reason,draft_value,draft_source_hash,
       draft_source_revision,translated_source_hash,translated_revision,lock_version
from public.translation_field_state
where resource_type='account_plan_translation' and field_name='payout_frequency';

do $$
declare valid_count integer;null_count integer;en_count integer;pt_count integer;es_count integer;
begin
  select count(*) filter(where nullif(btrim(payout_frequency),'') is not null),
         count(*) filter(where payout_frequency is null) into valid_count,null_count
  from public.account_plans;
  if valid_count<>1404 or null_count<>97 then raise exception 'Fixture inesperado: validos %, NULL %',valid_count,null_count;end if;
  select count(*) filter(where target_language='en'),count(*) filter(where target_language='pt'),count(*) filter(where target_language='es')
    into en_count,pt_count,es_count from public.translation_field_state
    where resource_type='account_plan_translation' and field_name='payout_frequency';
  if en_count<>1404 or pt_count<>1404 or es_count<>1404 then raise exception 'Reconciliacion incorrecta EN %, PT %, ES %',en_count,pt_count,es_count;end if;
  if exists(select 1 from public.translation_field_state s join public.account_plans ap on ap.id::text=s.resource_id
    where s.resource_type='account_plan_translation' and s.field_name='payout_frequency' and ap.payout_frequency is null) then
    raise exception 'Los NULL generaron estados editoriales';end if;
  if exists(select 1 from public.translation_field_state where resource_type='account_plan_translation' and field_name='payout_frequency' and target_language='pt' and source_language<>'en') then raise exception 'PT no fue reconciliado a EN';end if;
  if exists(select 1 from public.translation_field_state where resource_type='account_plan_translation' and field_name='payout_frequency' and target_language='es' and source_language<>'en') then raise exception 'ES no usa fuente EN';end if;
end $$;

do $$
begin
  if (select count(*) from public.translation_field_state where resource_type='account_plan_translation' and field_name='payout_frequency' and target_language='en' and status='machine_translated' and workflow_status='draft')<>3 then raise exception 'Se perdieron borradores EN históricos';end if;
  if (select count(*) from public.translation_field_state where resource_type='account_plan_translation' and field_name='payout_frequency' and target_language='pt' and status='machine_translated' and workflow_status='draft')<>2 then raise exception 'Se perdieron borradores PT';end if;
  if not exists(select 1 from public.translation_field_state where resource_type='account_plan_translation' and field_name='payout_frequency' and target_language='en' and publication_status='published' and is_protected) then raise exception 'Se perdió historial EN publicado/protegido';end if;
  if not exists(select 1 from public.translation_field_state where resource_type='account_plan_translation' and field_name='payout_frequency' and target_language='pt' and publication_status='published' and is_protected) then raise exception 'Se perdió PT publicado/protegido';end if;
  if exists(select 1 from before_states b join public.translation_field_state s on s.id=b.id where b.target_language='en' and (row(b.status,b.workflow_status,b.publication_status,b.is_protected,b.draft_value,b.lock_version) is distinct from row(s.status,s.workflow_status,s.publication_status,s.is_protected,s.draft_value,s.lock_version))) then raise exception 'La migracion alteró historial EN';end if;
end $$;

do $$
declare plan_id uuid;old_hash text;old_revision bigint;
begin
  select ap.id into plan_id from public.account_plans ap where ap.payout_frequency is not null order by ap.account_size desc limit 1;
  select source_hash,source_revision into old_hash,old_revision from public.translation_field_state where resource_type='account_plan_translation' and resource_id=plan_id::text and field_name='payout_frequency' and target_language='es';
  update public.account_plans set payout_frequency=payout_frequency||' updated' where id=plan_id;
  if not exists(select 1 from public.translation_field_state where resource_type='account_plan_translation' and resource_id=plan_id::text and field_name='payout_frequency' and target_language='es' and source_hash<>old_hash and source_revision=old_revision+1) then raise exception 'Cambio concurrente de hash/revision no se propagó a ES';end if;
  if not exists(select 1 from public.translation_field_state where resource_type='account_plan_translation' and resource_id=plan_id::text and field_name='payout_frequency' and target_language='pt' and source_language='en' and source_hash<>old_hash and source_revision=old_revision+1) then raise exception 'Cambio concurrente no se propagó a PT';end if;
  if exists(select 1 from public.translation_jobs) then raise exception 'Se crearon jobs automáticamente';end if;
end $$;

set "request.jwt.claim.role"='service_role';
do $$ declare en_total bigint;es_total bigint;pt_total bigint;
begin
  select coalesce(sum(total_fields),0) into en_total from public.translation_admin_language_coverage(array['account_plan_translation']) where target_language='en';
  select coalesce(sum(total_fields),0) into es_total from public.translation_admin_language_coverage(array['account_plan_translation']) where target_language='es';
  select coalesce(sum(total_fields),0) into pt_total from public.translation_admin_language_coverage(array['account_plan_translation']) where target_language='pt';
  if en_total<>0 or es_total<>1404 or pt_total<>1404 then raise exception 'Cobertura incorrecta EN %, ES %, PT %',en_total,es_total,pt_total;end if;
end $$;

select 'translation_field_source_language_postgres_test: PASS' as result;

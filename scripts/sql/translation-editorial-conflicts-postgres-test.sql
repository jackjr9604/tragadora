\set ON_ERROR_STOP on

-- Prueba destructiva solo para el Supabase E2E local aislado.
do $$begin
  if to_regclass('public.tradagora_local_e2e_guard') is null then
    raise exception 'ABORTADO: prueba exclusiva del baseline E2E local';
  end if;
end$$;

create extension if not exists dblink;

create table if not exists public.translation_editorial_race_result(
  phase text not null,
  connection text not null,
  result text not null
);
truncate public.translation_editorial_race_result;

create or replace function public.e2e_editorial_race(
  p_state_id uuid,
  p_expected_lock_version bigint,
  p_action text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  perform set_config('request.jwt.claim.sub','85100000-0000-4000-8000-000000000001',true);
  if p_action = 'approve' then
    perform public.translation_approve_draft(p_state_id,p_expected_lock_version);
  elsif p_action = 'reject' then
    perform public.translation_reject_draft(p_state_id,p_expected_lock_version,'Rechazo concurrente E2E local.');
  elsif p_action = 'publish' then
    perform public.translation_publish_draft(p_state_id,p_expected_lock_version);
  else
    raise exception 'Acción E2E inválida';
  end if;
  return p_action || ':ok';
exception
  when serialization_failure then return p_action || ':conflict';
  when others then return p_action || ':error:' || sqlstate;
end
$$;

do $$
declare s public.translation_field_state%rowtype;
begin
  select * into s from public.translation_field_state
  where resource_type='blog_post_translation'
    and resource_id='85110000-0000-4000-8000-000000000002'
    and field_name='title' and target_language='en';
  if not found then raise exception 'Falta el fixture editorial local'; end if;

  update public.translation_field_state set
    status='machine_translated', workflow_status='in_review', publication_status='unpublished',
    draft_value=to_jsonb('Concurrent draft'::text), draft_source_hash=source_hash,
    draft_source_revision=source_revision, lock_version=40, is_protected=false,
    submitted_at=now(), approved_at=null, approved_by=null, updated_at=now()
  where id=s.id;
end$$;

select dblink_connect('editorial_a','host=127.0.0.1 port=5432 dbname='||current_database()||' user=supabase_admin');
select dblink_connect('editorial_b','host=127.0.0.1 port=5432 dbname='||current_database()||' user=supabase_admin');
select dblink_send_query('editorial_a',format(
  'select public.e2e_editorial_race(%L,40,%L)',
  (select id from public.translation_field_state where resource_type='blog_post_translation' and resource_id='85110000-0000-4000-8000-000000000002' and field_name='title' and target_language='en'),
  'approve'));
select dblink_send_query('editorial_b',format(
  'select public.e2e_editorial_race(%L,40,%L)',
  (select id from public.translation_field_state where resource_type='blog_post_translation' and resource_id='85110000-0000-4000-8000-000000000002' and field_name='title' and target_language='en'),
  'reject'));
insert into public.translation_editorial_race_result select 'review','a',result from dblink_get_result('editorial_a') as t(result text);
insert into public.translation_editorial_race_result select 'review','b',result from dblink_get_result('editorial_b') as t(result text);

do $$begin
  if (select count(*) from public.translation_editorial_race_result where phase='review' and result like '%:ok') <> 1
     or (select count(*) from public.translation_editorial_race_result where phase='review' and result like '%:conflict') <> 1 then
    raise exception 'Dos administradores alteraron el mismo snapshot de revisión: %',
      (select jsonb_agg(to_jsonb(r)) from public.translation_editorial_race_result r where phase='review');
  end if;
end$$;

select dblink_disconnect('editorial_a');
select dblink_disconnect('editorial_b');

update public.translation_field_state set
  workflow_status='approved', publication_status='unpublished', status='machine_translated',
  draft_source_hash=source_hash, draft_source_revision=source_revision,
  lock_version=50, approved_at=now(), approved_by='85100000-0000-4000-8000-000000000001', updated_at=now()
where resource_type='blog_post_translation' and resource_id='85110000-0000-4000-8000-000000000002'
  and field_name='title' and target_language='en';

select dblink_connect('editorial_a','host=127.0.0.1 port=5432 dbname='||current_database()||' user=supabase_admin');
select dblink_connect('editorial_b','host=127.0.0.1 port=5432 dbname='||current_database()||' user=supabase_admin');
select dblink_send_query('editorial_a',format(
  'select public.e2e_editorial_race(%L,50,%L)',
  (select id from public.translation_field_state where resource_type='blog_post_translation' and resource_id='85110000-0000-4000-8000-000000000002' and field_name='title' and target_language='en'),
  'publish'));
select dblink_send_query('editorial_b',format(
  'select public.e2e_editorial_race(%L,50,%L)',
  (select id from public.translation_field_state where resource_type='blog_post_translation' and resource_id='85110000-0000-4000-8000-000000000002' and field_name='title' and target_language='en'),
  'publish'));
insert into public.translation_editorial_race_result select 'publication','a',result from dblink_get_result('editorial_a') as t(result text);
insert into public.translation_editorial_race_result select 'publication','b',result from dblink_get_result('editorial_b') as t(result text);

do $$begin
  if (select count(*) from public.translation_editorial_race_result where phase='publication' and result='publish:ok') <> 1
     or (select count(*) from public.translation_editorial_race_result where phase='publication' and result='publish:conflict') <> 1 then
    raise exception 'Dos administradores publicaron el mismo snapshot: %',
      (select jsonb_agg(to_jsonb(r)) from public.translation_editorial_race_result r where phase='publication');
  end if;
  if not exists(select 1 from public.translation_field_state where resource_type='blog_post_translation'
      and resource_id='85110000-0000-4000-8000-000000000002' and field_name='title' and target_language='en'
      and workflow_status='none' and publication_status='published' and status='reviewed' and lock_version=51) then
    raise exception 'La carrera de publicación dejó un estado incoherente';
  end if;
end$$;

select dblink_disconnect('editorial_a');
select dblink_disconnect('editorial_b');
drop function public.e2e_editorial_race(uuid,bigint,text);
drop table public.translation_editorial_race_result;

select 'translation editorial concurrency tests passed' as result;

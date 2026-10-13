\set ON_ERROR_STOP on

do $$
declare s public.translation_field_state%rowtype;
begin
  select * into s from public.translation_field_state
  where resource_type='blog_post_translation'
    and resource_id=(select id::text from public.blog_posts where slug='market-guide')
    and field_name='title' and target_language='en';
  if s.publication_status <> 'published' or s.status <> 'reviewed' then
    raise exception 'El backfill no conservó la publicación legacy';
  end if;
  if (select title from public.blog_post_translations where blog_post_id=s.resource_id::uuid and language='en') <> 'Legacy published title' then
    raise exception 'La migración modificó el texto legacy';
  end if;
end $$;

select set_config('app.test_permissions','blog.update,blog.view',false);

select public.translation_save_draft(
  id,to_jsonb('Editorial draft title'::text),lock_version
) from public.translation_field_state
where resource_type='blog_post_translation'
  and resource_id=(select id::text from public.blog_posts where slug='market-guide')
  and field_name='title' and target_language='en';

do $$
declare s public.translation_field_state%rowtype;
begin
  select * into s from public.translation_field_state
  where resource_type='blog_post_translation'
    and resource_id=(select id::text from public.blog_posts where slug='market-guide')
    and field_name='title' and target_language='en';
  if s.workflow_status <> 'draft' or s.publication_status <> 'published' then
    raise exception 'Guardar borrador alteró la publicación vigente';
  end if;
  if (select title from public.blog_post_translations where blog_post_id=s.resource_id::uuid and language='en') <> 'Legacy published title' then
    raise exception 'Guardar borrador escribió en la tabla funcional';
  end if;
end $$;

select public.translation_submit_review(id,lock_version) from public.translation_field_state
where resource_type='blog_post_translation' and resource_id=(select id::text from public.blog_posts where slug='market-guide')
  and field_name='title' and target_language='en';
select public.translation_approve_draft(id,lock_version) from public.translation_field_state
where resource_type='blog_post_translation' and resource_id=(select id::text from public.blog_posts where slug='market-guide')
  and field_name='title' and target_language='en';

do $$
begin
  if (select t.title from public.blog_post_translations t join public.blog_posts b on b.id=t.blog_post_id where b.slug='market-guide' and t.language='en') <> 'Legacy published title' then
    raise exception 'Aprobar hizo visible el borrador antes de publicar';
  end if;
end $$;

select public.translation_publish_draft(id,lock_version) from public.translation_field_state
where resource_type='blog_post_translation' and resource_id=(select id::text from public.blog_posts where slug='market-guide')
  and field_name='title' and target_language='en';

do $$
declare s public.translation_field_state%rowtype;
begin
  select * into s from public.translation_field_state
  where resource_type='blog_post_translation' and resource_id=(select id::text from public.blog_posts where slug='market-guide')
    and field_name='title' and target_language='en';
  if s.workflow_status <> 'none' or s.publication_status <> 'published' or s.status <> 'reviewed'
    or not s.is_protected or s.draft_value is not null then
    raise exception 'La publicación no cerró correctamente el flujo';
  end if;
  if (select title from public.blog_post_translations where blog_post_id=s.resource_id::uuid and language='en') <> 'Editorial draft title' then
    raise exception 'La publicación no escribió el valor aprobado';
  end if;
end $$;

-- Optimistic locking: una versión anterior nunca puede sobrescribir el estado.
do $$
declare sid uuid; old_version bigint;
begin
  select id,lock_version into sid,old_version from public.translation_field_state
  where resource_type='blog_post_translation' and resource_id=(select id::text from public.blog_posts where slug='market-guide')
    and field_name='title' and target_language='en';
  perform public.translation_save_draft(sid,to_jsonb('Concurrent draft'::text),old_version);
  begin
    perform public.translation_save_draft(sid,to_jsonb('Lost update'::text),old_version);
    raise exception 'La versión obsoleta fue aceptada';
  exception when serialization_failure then null;
  end;
end $$;

select public.translation_withdraw_publication(id,lock_version) from public.translation_field_state
where resource_type='blog_post_translation' and resource_id=(select id::text from public.blog_posts where slug='market-guide')
  and field_name='title' and target_language='en';

-- Una edición directa de site_content destino invalida la publicación, salvo
-- cuando la realiza la RPC de publicación autorizada.
insert into public.site_content(key,language,value,type) values('test.editorial.guard','es','Fuente','text');
select set_config('app.test_permissions','content.update',false);
select public.translation_save_draft(id,to_jsonb('Approved translation'::text),lock_version)
from public.translation_field_state where resource_type='site_content' and resource_id='test.editorial.guard' and field_name='value' and target_language='en';
select public.translation_submit_review(id,lock_version) from public.translation_field_state where resource_type='site_content' and resource_id='test.editorial.guard' and field_name='value' and target_language='en';
select public.translation_approve_draft(id,lock_version) from public.translation_field_state where resource_type='site_content' and resource_id='test.editorial.guard' and field_name='value' and target_language='en';
select public.translation_publish_draft(id,lock_version) from public.translation_field_state where resource_type='site_content' and resource_id='test.editorial.guard' and field_name='value' and target_language='en';
update public.site_content set value='Direct bypass attempt' where key='test.editorial.guard' and language='en';
do $$
begin
  if exists(select 1 from public.translation_field_state where resource_type='site_content' and resource_id='test.editorial.guard'
    and field_name='value' and target_language='en' and publication_status='published') then
    raise exception 'La edición directa conservó una publicación inválida';
  end if;
end $$;

-- Sin permiso de módulo ninguna transición editorial puede ejecutarse.
select set_config('app.test_permissions','',false);
do $$
begin
  begin
    perform public.translation_save_draft(id,to_jsonb('Unauthorized'::text),lock_version)
    from public.translation_field_state where resource_type='blog_post_translation'
      and resource_id=(select id::text from public.blog_posts where slug='market-guide') and field_name='excerpt' and target_language='en';
    raise exception 'Escritura editorial sin permiso aceptada';
  exception when insufficient_privilege then null;
  end;
end $$;
do $$
begin
  if has_function_privilege('authenticated','public.translation_save_manual(text,text,text,text,jsonb,boolean)','EXECUTE')
    or has_function_privilege('authenticated','public.translation_approve(text,text,text,text,text,text,boolean)','EXECUTE') then
    raise exception 'Las RPC legacy continúan expuestas a authenticated';
  end if;
  if not has_function_privilege('authenticated','public.translation_save_draft(uuid,jsonb,bigint)','EXECUTE') then
    raise exception 'La RPC editorial no está disponible para authenticated';
  end if;
  if exists(select 1 from public.translation_jobs) then raise exception '3E.2 creó jobs automáticos'; end if;
end $$;

select 'translation editorial workflow postgres tests passed' as result;

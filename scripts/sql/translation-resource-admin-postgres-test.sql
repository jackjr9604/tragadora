begin;

insert into public.blog_posts(id,title) values
  ('00000000-0000-0000-0000-000000000001','Alpha article'),
  ('00000000-0000-0000-0000-000000000002','Beta article');

insert into public.translation_field_state(id,resource_type,resource_id,field_name,target_language,status,workflow_status,publication_status,is_protected,updated_at) values
  ('10000000-0000-0000-0000-000000000001','blog_post_translation','00000000-0000-0000-0000-000000000001','title','en','reviewed','none','published',true,'2026-01-01'),
  ('10000000-0000-0000-0000-000000000002','blog_post_translation','00000000-0000-0000-0000-000000000001','title','pt','missing','none','unpublished',false,'2026-01-01'),
  ('10000000-0000-0000-0000-000000000003','blog_post_translation','00000000-0000-0000-0000-000000000002','title','en','stale','none','unpublished',false,'2026-01-02'),
  ('10000000-0000-0000-0000-000000000004','blog_post_translation','00000000-0000-0000-0000-000000000002','title','pt','machine_translated','draft','unpublished',true,'2026-01-02');

do $$
declare row_count integer; first_label text; first_total bigint; first_published bigint;
begin
  select count(*),min(resource_label),sum(total_fields),sum(published_count)
    into row_count,first_label,first_total,first_published
  from public.translation_admin_resource_inventory(array['blog_post_translation'],null,null,null,null,null,'name_asc',1,25);
  if row_count<>2 or first_label<>'Alpha article' or first_total<>4 or first_published<>1 then raise exception 'Agrupación incorrecta'; end if;

  select count(*) into row_count
  from public.translation_admin_resource_inventory(array['blog_post_translation'],null,null,'stale',null,null,'updated_desc',1,25);
  if row_count<>1 then raise exception 'Filtro de estado incorrecto'; end if;

  select count(*) into row_count
  from public.translation_admin_resource_inventory(array['blog_post_translation'],null,null,null,null,'Alpha','name_asc',1,25);
  if row_count<>1 then raise exception 'Búsqueda por título incorrecta'; end if;

  select count(*) into row_count
  from public.translation_admin_resource_inventory(array['blog_post_translation'],null,null,null,null,null,'name_asc',2,1);
  if row_count<>1 then raise exception 'Paginación incorrecta'; end if;
end $$;

set local request.jwt.claim.role='anon';
do $$ begin
  perform * from public.translation_admin_resource_inventory(array['blog_post_translation'],null,null,null,null,null,'name_asc',1,25);
  raise exception 'Anon ejecutó el inventario';
exception when insufficient_privilege then null; end $$;

rollback;

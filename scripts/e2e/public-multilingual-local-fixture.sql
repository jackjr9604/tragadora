\set ON_ERROR_STOP on
set role supabase_admin;

do $$ begin
  if to_regclass('public.tradagora_local_e2e_guard') is null then
    raise exception 'ABORTADO: fixture exclusiva del baseline E2E local';
  end if;
end $$;

update public.blog_posts
set status = 'published', published_at = now(), updated_at = now()
where id = '85110000-0000-4000-8000-000000000002';

do $$ begin
  if not exists (
    select 1 from public.translation_field_state
    where resource_type = 'blog_post_translation'
      and resource_id = '85110000-0000-4000-8000-000000000002'
      and field_name = 'title' and target_language = 'en'
      and publication_status = 'published' and status = 'reviewed'
      and source_hash = translated_source_hash and source_revision = translated_revision
  ) then
    raise exception 'Falta la traducción sintética publicada requerida por el smoke público';
  end if;
end $$;

-- ETAPA 2 / BLOQUE 3D.5: traducciones persistentes de Blog.
-- No modifica slugs, autores, fechas, publicación, media ni el Markdown fuente.
begin;

do $$ begin
  if to_regclass('public.blog_posts') is null then raise exception '3D.5 requiere public.blog_posts'; end if;
  if to_regclass('public.translation_field_state') is null or to_regclass('public.translation_jobs') is null then raise exception '3D.5 requiere Bloque 2'; end if;
  if not exists(select 1 from public.admin_permissions where key='blog.view') or not exists(select 1 from public.admin_permissions where key='blog.update') then raise exception '3D.5 requiere permisos blog.view/blog.update'; end if;
end $$;

create table if not exists public.blog_post_translations(
  blog_post_id uuid not null references public.blog_posts(id) on delete cascade,
  language text not null references public.languages(code) on update cascade on delete restrict,
  title text,
  excerpt text,
  body_markdown text,
  category text,
  tags jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(blog_post_id,language),
  check(title is null or btrim(title)<>''),
  check(excerpt is null or btrim(excerpt)<>''),
  check(body_markdown is null or btrim(body_markdown)<>''),
  check(category is null or btrim(category)<>''),
  check(tags is null or (jsonb_typeof(tags)='array' and jsonb_array_length(tags)>0 and not jsonb_path_exists(tags,'$[*] ? (@.type() != "string")')))
);

insert into public.translation_resource_types(resource_type,description,adapter_key) values
 ('blog_post_translation','Campos editoriales traducibles de artículos del Blog.','blog_post_translation')
on conflict(resource_type) do update set description=excluded.description,adapter_key=excluded.adapter_key;
insert into public.translation_resource_fields(resource_type,field_name,value_kind,max_characters) values
 ('blog_post_translation','title','text',240),
 ('blog_post_translation','excerpt','text',2000),
 ('blog_post_translation','body_markdown','rich_text',100000),
 ('blog_post_translation','category','text',240),
 ('blog_post_translation','tags','text_array',10000)
on conflict(resource_type,field_name) do update set value_kind=excluded.value_kind,max_characters=excluded.max_characters;

create or replace function public.translation_assert_admin_permission(p_resource_type text)
returns void language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare required_permission text;
begin
  required_permission:=case
    when p_resource_type='site_content' then 'content.update'
    when p_resource_type in ('platform_translation','broker_detail_translation','exchange_detail_translation') then 'platforms.update'
    when p_resource_type='offer_translation' then 'offers.update'
    when p_resource_type in ('challenge_phase_translation','challenge_variant_translation','challenge_variant_phase_translation','account_plan_translation','challenge_reward_translation') then 'challenges.update'
    when p_resource_type='tool_translation' then 'tools.update'
    when p_resource_type='community_translation' then 'communities.update'
    when p_resource_type='giveaway_translation' then 'giveaways.update'
    when p_resource_type='blog_post_translation' then 'blog.update'
  end;
  if required_permission is null then raise exception 'Resource type no autorizado' using errcode='22023'; end if;
  if public.has_admin_permission(required_permission) is not true then raise exception 'Forbidden' using errcode='42501'; end if;
end $$;

do $$ begin
  if to_regprocedure('public.translation_read_value_before_blog(text,text,text,text)') is null then execute 'alter function public.translation_read_value(text,text,text,text) rename to translation_read_value_before_blog'; end if;
  if to_regprocedure('public.translation_write_value_before_blog(text,text,text,text,jsonb,uuid)') is null then execute 'alter function public.translation_write_value(text,text,text,text,jsonb,uuid) rename to translation_write_value_before_blog'; end if;
end $$;

create or replace function public.translation_read_blog_value(p_resource_id text,p_field_name text,p_language text)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare value jsonb; source_language text;
begin
  perform public.translation_assert_field('blog_post_translation',p_field_name);
  select code into source_language from public.languages where is_default and is_active order by sort_order,code limit 1;
  if source_language is null then return null; end if;
  if p_language=source_language then
    select case p_field_name when 'title' then to_jsonb(title) when 'excerpt' then to_jsonb(excerpt) when 'body_markdown' then to_jsonb(body_markdown) when 'category' then to_jsonb(category) when 'tags' then to_jsonb(tags) end into value
    from public.blog_posts where id::text=p_resource_id;
  else
    select case p_field_name when 'title' then to_jsonb(title) when 'excerpt' then to_jsonb(excerpt) when 'body_markdown' then to_jsonb(body_markdown) when 'category' then to_jsonb(category) when 'tags' then tags end into value
    from public.blog_post_translations where blog_post_id::text=p_resource_id and language=p_language;
  end if;
  return value;
end $$;

create or replace function public.translation_read_value(p_resource_type text,p_resource_id text,p_field_name text,p_language text)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
begin
  if p_resource_type='blog_post_translation' then return public.translation_read_blog_value(p_resource_id,p_field_name,p_language); end if;
  return public.translation_read_value_before_blog(p_resource_type,p_resource_id,p_field_name,p_language);
end $$;

create or replace function public.translation_write_blog_value(p_resource_id text,p_field_name text,p_language text,p_value jsonb)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare source_language text; text_value text;
begin
  perform public.translation_assert_field('blog_post_translation',p_field_name);
  if p_field_name='tags' then
    if jsonb_typeof(p_value)<>'array' or jsonb_array_length(p_value)=0 or exists(select 1 from jsonb_array_elements(p_value) item where jsonb_typeof(item)<>'string' or btrim(item#>>'{}')='') then raise exception 'tags requiere un array JSONB no vacío de cadenas no vacías' using errcode='22023'; end if;
  elsif jsonb_typeof(p_value)<>'string' or not public.translation_value_present(p_value) then
    raise exception 'El campo % requiere una cadena JSONB no vacía',p_field_name using errcode='22023';
  end if;
  select code into source_language from public.languages where is_default and is_active order by sort_order,code limit 1;
  if source_language is null then raise exception 'Idioma fuente no encontrado' using errcode='P0002'; end if;
  if p_language=source_language or p_language='global' then raise exception 'No se puede escribir el idioma fuente mediante traducciones' using errcode='22023'; end if;
  if not exists(select 1 from public.blog_posts where id::text=p_resource_id) then raise exception 'Artículo no encontrado' using errcode='P0002'; end if;
  if p_field_name<>'tags' then text_value:=p_value#>>'{}'; end if;
  insert into public.blog_post_translations(blog_post_id,language,title,excerpt,body_markdown,category,tags,updated_at)
  values(p_resource_id::uuid,p_language,case when p_field_name='title' then text_value end,case when p_field_name='excerpt' then text_value end,case when p_field_name='body_markdown' then text_value end,case when p_field_name='category' then text_value end,case when p_field_name='tags' then p_value end,now())
  on conflict(blog_post_id,language) do update set
    title=case when p_field_name='title' then excluded.title else blog_post_translations.title end,
    excerpt=case when p_field_name='excerpt' then excluded.excerpt else blog_post_translations.excerpt end,
    body_markdown=case when p_field_name='body_markdown' then excluded.body_markdown else blog_post_translations.body_markdown end,
    category=case when p_field_name='category' then excluded.category else blog_post_translations.category end,
    tags=case when p_field_name='tags' then excluded.tags else blog_post_translations.tags end,
    updated_at=now();
end $$;

create or replace function public.translation_write_value(p_resource_type text,p_resource_id text,p_field_name text,p_language text,p_value jsonb,p_actor uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  if p_resource_type='blog_post_translation' then perform public.translation_write_blog_value(p_resource_id,p_field_name,p_language,p_value); return; end if;
  perform public.translation_write_value_before_blog(p_resource_type,p_resource_id,p_field_name,p_language,p_value,p_actor);
end $$;

create or replace function public.translation_blog_source_insert_trigger()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare field_name text; source_language text;
begin
  select code into source_language from public.languages where is_default and is_active order by sort_order,code limit 1;
  foreach field_name in array array['title','excerpt','body_markdown','category','tags'] loop perform public.translation_register_source_change_internal('blog_post_translation',new.id::text,field_name,source_language); end loop;
  return new;
end $$;

create or replace function public.translation_blog_source_update_trigger()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare field_name text; source_language text; old_value jsonb; new_value jsonb;
begin
  select code into source_language from public.languages where is_default and is_active order by sort_order,code limit 1;
  foreach field_name in array array['title','excerpt','body_markdown','category','tags'] loop
    old_value:=to_jsonb(old)->field_name; new_value:=to_jsonb(new)->field_name;
    if new_value is distinct from old_value then perform public.translation_register_source_change_internal('blog_post_translation',new.id::text,field_name,source_language); end if;
  end loop;
  return new;
end $$;

create or replace function public.translation_blog_source_delete_trigger()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare field_name text; source_language text;
begin
  select code into source_language from public.languages where is_default and is_active order by sort_order,code limit 1;
  foreach field_name in array array['title','excerpt','body_markdown','category','tags'] loop perform public.translation_invalidate_source_internal('blog_post_translation',old.id::text,field_name,source_language,'source_deleted'); end loop;
  return old;
end $$;

drop trigger if exists translation_blog_source_insert on public.blog_posts;
drop trigger if exists translation_blog_source_update on public.blog_posts;
drop trigger if exists translation_blog_source_delete on public.blog_posts;
create trigger translation_blog_source_insert after insert on public.blog_posts for each row execute function public.translation_blog_source_insert_trigger();
create trigger translation_blog_source_update after update of title,excerpt,body_markdown,category,tags on public.blog_posts for each row execute function public.translation_blog_source_update_trigger();
create trigger translation_blog_source_delete after delete on public.blog_posts for each row execute function public.translation_blog_source_delete_trigger();

do $$ declare item record; field_name text; source_language text; begin
  select code into source_language from public.languages where is_default and is_active order by sort_order,code limit 1;
  for item in select id from public.blog_posts loop foreach field_name in array array['title','excerpt','body_markdown','category','tags'] loop perform public.translation_register_source_change_internal('blog_post_translation',item.id::text,field_name,source_language); end loop; end loop;
end $$;

alter table public.blog_post_translations enable row level security;
drop policy if exists tg_blog_post_translations_view on public.blog_post_translations;
create policy tg_blog_post_translations_view on public.blog_post_translations for select to authenticated using(public.has_admin_permission('blog.view'));
revoke all on public.blog_post_translations from public,anon,authenticated;
grant select on public.blog_post_translations to authenticated;
grant all on public.blog_post_translations to service_role;

drop policy if exists tg_translation_resource_types_view on public.translation_resource_types;
create policy tg_translation_resource_types_view on public.translation_resource_types for select to authenticated using(public.has_admin_permission('content.view') or public.has_admin_permission('platforms.view') or public.has_admin_permission('offers.view') or public.has_admin_permission('challenges.view') or public.has_admin_permission('tools.view') or public.has_admin_permission('communities.view') or public.has_admin_permission('giveaways.view') or public.has_admin_permission('blog.view'));
drop policy if exists tg_translation_resource_fields_view on public.translation_resource_fields;
create policy tg_translation_resource_fields_view on public.translation_resource_fields for select to authenticated using(public.has_admin_permission('content.view') or public.has_admin_permission('platforms.view') or public.has_admin_permission('offers.view') or public.has_admin_permission('challenges.view') or public.has_admin_permission('tools.view') or public.has_admin_permission('communities.view') or public.has_admin_permission('giveaways.view') or public.has_admin_permission('blog.view'));
drop policy if exists tg_translation_field_state_view on public.translation_field_state;
create policy tg_translation_field_state_view on public.translation_field_state for select to authenticated using(
 (resource_type='site_content' and public.has_admin_permission('content.view')) or (resource_type in ('platform_translation','broker_detail_translation','exchange_detail_translation') and public.has_admin_permission('platforms.view')) or (resource_type='offer_translation' and public.has_admin_permission('offers.view')) or (resource_type in ('challenge_phase_translation','challenge_variant_translation','challenge_variant_phase_translation','account_plan_translation','challenge_reward_translation') and public.has_admin_permission('challenges.view')) or (resource_type='tool_translation' and public.has_admin_permission('tools.view')) or (resource_type='community_translation' and public.has_admin_permission('communities.view')) or (resource_type='giveaway_translation' and public.has_admin_permission('giveaways.view')) or (resource_type='blog_post_translation' and public.has_admin_permission('blog.view')));
drop policy if exists tg_translation_jobs_view on public.translation_jobs;
create policy tg_translation_jobs_view on public.translation_jobs for select to authenticated using(
 (resource_type='site_content' and public.has_admin_permission('content.view')) or (resource_type in ('platform_translation','broker_detail_translation','exchange_detail_translation') and public.has_admin_permission('platforms.view')) or (resource_type='offer_translation' and public.has_admin_permission('offers.view')) or (resource_type in ('challenge_phase_translation','challenge_variant_translation','challenge_variant_phase_translation','account_plan_translation','challenge_reward_translation') and public.has_admin_permission('challenges.view')) or (resource_type='tool_translation' and public.has_admin_permission('tools.view')) or (resource_type='community_translation' and public.has_admin_permission('communities.view')) or (resource_type='giveaway_translation' and public.has_admin_permission('giveaways.view')) or (resource_type='blog_post_translation' and public.has_admin_permission('blog.view')));

revoke all on function public.translation_assert_admin_permission(text) from public,anon,authenticated;
revoke all on function public.translation_read_value(text,text,text,text) from public,anon,authenticated;
revoke all on function public.translation_write_value(text,text,text,text,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.translation_read_value_before_blog(text,text,text,text) from public,anon,authenticated;
revoke all on function public.translation_write_value_before_blog(text,text,text,text,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.translation_read_value_before_giveaways(text,text,text,text) from public,anon,authenticated;
revoke all on function public.translation_write_value_before_giveaways(text,text,text,text,jsonb,uuid) from public,anon,authenticated;
revoke all on function public.translation_read_blog_value(text,text,text) from public,anon,authenticated;
revoke all on function public.translation_write_blog_value(text,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.translation_blog_source_insert_trigger() from public,anon,authenticated;
revoke all on function public.translation_blog_source_update_trigger() from public,anon,authenticated;
revoke all on function public.translation_blog_source_delete_trigger() from public,anon,authenticated;

do $$ begin
  if exists(select 1 from public.translation_jobs where resource_type='blog_post_translation') then raise exception '3D.5 no debe crear translation_jobs'; end if;
  if exists(select 1 from public.blog_post_translations) then raise exception '3D.5 no debe crear traducciones'; end if;
end $$;
commit;

-- Rollback controlado: retirar triggers/policies/metadata/tabla y restaurar *_before_blog.

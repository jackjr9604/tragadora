begin;

-- 3E.7: site_content conserva escritura administrativa para el idioma fuente y
-- configuración global, pero ningún idioma destino puede saltarse el workflow.
do $$
begin
  if to_regprocedure('public.translation_publish_draft(uuid,bigint)') is null
     or to_regclass('public.translation_field_state') is null then
    raise exception '3E.7 requiere el workflow editorial 3E.2';
  end if;
end $$;

-- RLS es la frontera primaria: authenticated conserva edición del idioma
-- fuente y configuración global, pero nunca DML directo sobre destinos.
drop policy if exists tg_site_content_create on public.site_content;
create policy tg_site_content_create on public.site_content for insert to authenticated
with check (
  public.has_admin_permission('content.create') and (
    language='global' or exists(select 1 from public.languages l where l.code=language and l.is_default)
  )
);
drop policy if exists tg_site_content_update on public.site_content;
create policy tg_site_content_update on public.site_content for update to authenticated
using (
  public.has_admin_permission('content.update') and (
    language='global' or exists(select 1 from public.languages l where l.code=language and l.is_default)
  )
)
with check (
  public.has_admin_permission('content.update') and (
    language='global' or exists(select 1 from public.languages l where l.code=language and l.is_default)
  )
);
drop policy if exists tg_site_content_delete on public.site_content;
create policy tg_site_content_delete on public.site_content for delete to authenticated
using (
  public.has_admin_permission('content.delete') and (
    language='global' or exists(select 1 from public.languages l where l.code=language and l.is_default)
  )
);

create or replace function public.translation_site_content_editorial_write_guard()
returns trigger
language plpgsql security definer
set search_path=pg_catalog,public
as $$
declare
  v_target_key text;
  v_target_language text;
  state_id uuid;
begin
  if tg_op='DELETE' then
    v_target_key:=old.key; v_target_language:=old.language;
  elsif tg_op='INSERT' then
    v_target_key:=new.key; v_target_language:=new.language;
  elsif new.language<>'global' and not exists(select 1 from public.languages where code=new.language and is_default) then
    v_target_key:=new.key; v_target_language:=new.language;
  else
    v_target_key:=old.key; v_target_language:=old.language;
  end if;

  if v_target_language='global'
     or exists(select 1 from public.languages where code=v_target_language and is_default) then
    return case when tg_op='DELETE' then old else new end;
  end if;

  select id into state_id from public.translation_field_state
  where resource_type='site_content' and resource_id=v_target_key
    and field_name='value' and target_language=v_target_language;

  if state_id is not null
     and current_setting('app.translation_editor_publish_state',true)=state_id::text then
    return case when tg_op='DELETE' then old else new end;
  end if;

  raise exception 'Las traducciones de site_content solo pueden escribirse mediante el workflow editorial'
    using errcode='42501';
end $$;

drop trigger if exists translation_site_content_editorial_write_guard on public.site_content;
create trigger translation_site_content_editorial_write_guard
before insert or update or delete on public.site_content
for each row execute function public.translation_site_content_editorial_write_guard();

revoke all on function public.translation_site_content_editorial_write_guard() from public,anon,authenticated;

commit;

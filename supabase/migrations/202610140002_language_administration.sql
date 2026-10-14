-- ETAPA 2 / BLOQUE 3E.6: administración transaccional y segura de idiomas.
begin;

alter table public.languages
  add column if not exists ui_catalog_available boolean not null default false,
  add column if not exists seo_ready boolean not null default false,
  add column if not exists libretranslate_status text not null default 'unknown',
  add column if not exists libretranslate_checked_at timestamptz,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists lock_version bigint not null default 1;

alter table public.languages
  drop constraint if exists languages_libretranslate_status_check;
alter table public.languages add constraint languages_libretranslate_status_check
  check (libretranslate_status in ('unknown','supported','unsupported'));

-- Los idiomas públicos existentes conservan exactamente su disponibilidad.
update public.languages set ui_catalog_available=true,seo_ready=true,updated_at=now()
where code in ('es','en','pt') and publication_status='published';

alter table public.languages
  drop constraint if exists languages_publication_readiness_check;
alter table public.languages add constraint languages_publication_readiness_check
  check (publication_status <> 'published' or (is_active and ui_catalog_available and seo_ready));

-- La escritura deja de estar disponible mediante DML directo del navegador.
drop policy if exists tg_languages_create on public.languages;
drop policy if exists tg_languages_update on public.languages;
drop policy if exists tg_languages_delete on public.languages;
revoke insert,update,delete on public.languages from public,anon,authenticated;

create or replace function public.translation_admin_language_inventory()
returns table(
  code text,name text,native_name text,is_active boolean,is_default boolean,sort_order integer,
  auto_translate boolean,publication_status text,ui_catalog_available boolean,seo_ready boolean,
  libretranslate_status text,libretranslate_checked_at timestamptz,updated_at timestamptz,
  lock_version bigint,content_count bigint,state_count bigint,published_field_count bigint,job_count bigint
)
language plpgsql security definer set search_path=pg_catalog,public
as $$
begin
  if auth.role()<>'service_role' then raise exception 'Forbidden' using errcode='42501'; end if;
  return query select l.code,l.name,l.native_name,l.is_active,l.is_default,l.sort_order,l.auto_translate,
    l.publication_status,l.ui_catalog_available,l.seo_ready,l.libretranslate_status,
    l.libretranslate_checked_at,l.updated_at,l.lock_version,
    (select count(*) from public.site_content c where c.language=l.code),
    (select count(*) from public.translation_field_state s where s.source_language=l.code or s.target_language=l.code),
    (select count(*) from public.translation_field_state s where s.target_language=l.code and s.publication_status='published'),
    (select count(*) from public.translation_jobs j where j.source_language=l.code or j.target_language=l.code)
  from public.languages l order by l.sort_order,l.name,l.code;
end $$;

create or replace function public.translation_admin_create_language(
  p_code text,p_name text,p_native_name text,p_sort_order integer,p_actor uuid
)
returns public.languages
language plpgsql security definer set search_path=pg_catalog,public
as $$
declare result public.languages%rowtype;
begin
  if auth.role()<>'service_role' then raise exception 'Forbidden' using errcode='42501'; end if;
  p_code:=lower(btrim(p_code)); p_name:=btrim(p_name); p_native_name:=btrim(p_native_name);
  if p_code!~'^[a-z]{2,3}(-[a-z0-9]{2,8})?$' or p_name='' or p_native_name='' then
    raise exception 'Datos del idioma inválidos' using errcode='22023';
  end if;
  insert into public.languages(code,name,native_name,is_active,is_default,sort_order,auto_translate,
    publication_status,ui_catalog_available,seo_ready,libretranslate_status,updated_at,lock_version)
  values(p_code,p_name,p_native_name,false,false,coalesce(p_sort_order,100),false,
    'draft',false,false,'unknown',now(),1) returning * into result;
  insert into public.admin_audit_log(actor_user_id,action,module,new_value)
  values(p_actor,'language.create','content',to_jsonb(result));
  return result;
end $$;

create or replace function public.translation_admin_update_language(
  p_code text,p_expected_lock_version bigint,p_name text,p_native_name text,p_sort_order integer,
  p_auto_translate boolean,p_seo_ready boolean,p_actor uuid
)
returns public.languages
language plpgsql security definer set search_path=pg_catalog,public
as $$
declare current_row public.languages%rowtype; result public.languages%rowtype;
begin
  if auth.role()<>'service_role' then raise exception 'Forbidden' using errcode='42501'; end if;
  select * into current_row from public.languages where code=lower(btrim(p_code)) for update;
  if not found then raise exception 'Idioma no encontrado' using errcode='P0002'; end if;
  if current_row.lock_version<>p_expected_lock_version then raise exception 'El idioma cambió en otra sesión' using errcode='40001'; end if;
  if btrim(p_name)='' or btrim(p_native_name)='' then raise exception 'Los nombres son obligatorios' using errcode='22023'; end if;
  if coalesce(p_auto_translate,false) and current_row.libretranslate_status<>'supported' then
    raise exception 'LibreTranslate no ha confirmado compatibilidad con este idioma' using errcode='22023';
  end if;
  update public.languages set name=btrim(p_name),native_name=btrim(p_native_name),sort_order=p_sort_order,
    auto_translate=coalesce(p_auto_translate,false),seo_ready=coalesce(p_seo_ready,false),
    updated_at=now(),lock_version=lock_version+1 where code=current_row.code returning * into result;
  insert into public.admin_audit_log(actor_user_id,action,module,previous_value,new_value)
  values(p_actor,'language.update','content',to_jsonb(current_row),to_jsonb(result));
  return result;
end $$;

create or replace function public.translation_admin_set_language_state(
  p_code text,p_expected_lock_version bigint,p_is_active boolean,p_publication_status text,
  p_confirm_withdraw boolean,p_actor uuid
)
returns public.languages
language plpgsql security definer set search_path=pg_catalog,public
as $$
declare current_row public.languages%rowtype; result public.languages%rowtype;
begin
  if auth.role()<>'service_role' then raise exception 'Forbidden' using errcode='42501'; end if;
  if p_publication_status not in ('draft','translating','review','ready','published') then
    raise exception 'Estado editorial inválido' using errcode='22023';
  end if;
  select * into current_row from public.languages where code=lower(btrim(p_code)) for update;
  if not found then raise exception 'Idioma no encontrado' using errcode='P0002'; end if;
  if current_row.lock_version<>p_expected_lock_version then raise exception 'El idioma cambió en otra sesión' using errcode='40001'; end if;
  if current_row.is_default and (not p_is_active or p_publication_status<>'published') then
    raise exception 'El idioma fuente no puede desactivarse ni retirarse' using errcode='42501';
  end if;
  if current_row.publication_status='published' and p_publication_status<>'published' and not p_confirm_withdraw then
    raise exception 'La retirada de un idioma publicado requiere confirmación explícita' using errcode='22023';
  end if;
  if p_publication_status='published' and (not p_is_active or not current_row.ui_catalog_available or not current_row.seo_ready) then
    raise exception 'El idioma necesita estar activo y contar con catálogo UI y SEO antes de publicarse' using errcode='22023';
  end if;
  update public.languages set is_active=p_is_active,publication_status=p_publication_status,
    published_at=case when p_publication_status='published' then coalesce(published_at,now()) else published_at end,
    published_by=case when p_publication_status='published' then auth.uid() else published_by end,
    auto_translate=case when p_is_active then auto_translate else false end,
    updated_at=now(),lock_version=lock_version+1 where code=current_row.code returning * into result;
  insert into public.admin_audit_log(actor_user_id,action,module,previous_value,new_value)
  values(p_actor,case when current_row.publication_status='published' and result.publication_status<>'published' then 'language.withdraw' else 'language.state' end,
    'content',to_jsonb(current_row),to_jsonb(result));
  return result;
end $$;

create or replace function public.translation_admin_delete_language(p_code text,p_expected_lock_version bigint,p_actor uuid)
returns void
language plpgsql security definer set search_path=pg_catalog,public
as $$
declare current_row public.languages%rowtype; dependencies bigint;
begin
  if auth.role()<>'service_role' then raise exception 'Forbidden' using errcode='42501'; end if;
  select * into current_row from public.languages where code=lower(btrim(p_code)) for update;
  if not found then raise exception 'Idioma no encontrado' using errcode='P0002'; end if;
  if current_row.lock_version<>p_expected_lock_version then raise exception 'El idioma cambió en otra sesión' using errcode='40001'; end if;
  if current_row.is_default or current_row.is_active or current_row.publication_status='published' then
    raise exception 'Solo puede eliminarse un idioma inactivo, no publicado y que no sea el idioma fuente' using errcode='42501';
  end if;
  select
    (select count(*) from public.site_content c where c.language=current_row.code)+
    (select count(*) from public.translation_field_state s where s.source_language=current_row.code or s.target_language=current_row.code)+
    (select count(*) from public.translation_jobs j where j.source_language=current_row.code or j.target_language=current_row.code)
  into dependencies;
  if dependencies>0 then raise exception 'El idioma tiene contenido, traducciones o trabajos relacionados' using errcode='23503'; end if;
  insert into public.admin_audit_log(actor_user_id,action,module,previous_value)
  values(p_actor,'language.delete','content',to_jsonb(current_row));
  delete from public.languages where code=current_row.code;
end $$;

create or replace function public.translation_worker_report_languages(p_supported_codes text[])
returns void
language plpgsql security definer set search_path=pg_catalog,public
as $$
begin
  if auth.role()<>'service_role' then raise exception 'Forbidden' using errcode='42501'; end if;
  update public.languages set
    libretranslate_status=case when code=any(coalesce(p_supported_codes,array[]::text[])) then 'supported' else 'unsupported' end,
    libretranslate_checked_at=now(),
    updated_at=case when libretranslate_status is distinct from (case when code=any(coalesce(p_supported_codes,array[]::text[])) then 'supported' else 'unsupported' end) then now() else updated_at end,
    lock_version=case when libretranslate_status is distinct from (case when code=any(coalesce(p_supported_codes,array[]::text[])) then 'supported' else 'unsupported' end) then lock_version+1 else lock_version end;
end $$;

create or replace function public.translation_admin_sync_ui_catalog(p_available_codes text[])
returns void
language plpgsql security definer set search_path=pg_catalog,public
as $$
begin
  if auth.role()<>'service_role' then raise exception 'Forbidden' using errcode='42501'; end if;
  update public.languages set ui_catalog_available=(split_part(code,'-',1)=any(coalesce(p_available_codes,array[]::text[]))),
    updated_at=case when ui_catalog_available is distinct from (split_part(code,'-',1)=any(coalesce(p_available_codes,array[]::text[]))) then now() else updated_at end,
    lock_version=case when ui_catalog_available is distinct from (split_part(code,'-',1)=any(coalesce(p_available_codes,array[]::text[]))) then lock_version+1 else lock_version end;
end $$;

revoke all on function public.translation_admin_language_inventory() from public,anon,authenticated;
revoke all on function public.translation_admin_create_language(text,text,text,integer,uuid) from public,anon,authenticated;
revoke all on function public.translation_admin_update_language(text,bigint,text,text,integer,boolean,boolean,uuid) from public,anon,authenticated;
revoke all on function public.translation_admin_set_language_state(text,bigint,boolean,text,boolean,uuid) from public,anon,authenticated;
revoke all on function public.translation_admin_delete_language(text,bigint,uuid) from public,anon,authenticated;
revoke all on function public.translation_worker_report_languages(text[]) from public,anon,authenticated;
revoke all on function public.translation_admin_sync_ui_catalog(text[]) from public,anon,authenticated;
grant execute on function public.translation_admin_language_inventory() to service_role;
grant execute on function public.translation_admin_create_language(text,text,text,integer,uuid) to service_role;
grant execute on function public.translation_admin_update_language(text,bigint,text,text,integer,boolean,boolean,uuid) to service_role;
grant execute on function public.translation_admin_set_language_state(text,bigint,boolean,text,boolean,uuid) to service_role;
grant execute on function public.translation_admin_delete_language(text,bigint,uuid) to service_role;
grant execute on function public.translation_worker_report_languages(text[]) to service_role;
grant execute on function public.translation_admin_sync_ui_catalog(text[]) to service_role;

commit;

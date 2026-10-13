begin;

-- Bloque 3E.2: flujo editorial por campo. El valor publicado continúa en la
-- tabla funcional; el borrador vive únicamente en translation_field_state.
alter table public.translation_field_state
  add column if not exists publication_status text not null default 'unpublished',
  add column if not exists workflow_status text not null default 'none',
  add column if not exists draft_value jsonb,
  add column if not exists draft_source_hash text,
  add column if not exists draft_source_revision bigint,
  add column if not exists lock_version bigint not null default 1,
  add column if not exists draft_updated_at timestamptz,
  add column if not exists draft_updated_by uuid,
  add column if not exists submitted_at timestamptz,
  add column if not exists submitted_by uuid,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid,
  add column if not exists published_at timestamptz,
  add column if not exists published_by uuid,
  add column if not exists withdrawn_at timestamptz,
  add column if not exists withdrawn_by uuid;

alter table public.translation_field_state
  drop constraint if exists translation_field_state_publication_status_check,
  add constraint translation_field_state_publication_status_check
    check (publication_status in ('unpublished','published')),
  drop constraint if exists translation_field_state_workflow_status_check,
  add constraint translation_field_state_workflow_status_check
    check (workflow_status in ('none','draft','in_review','approved')),
  drop constraint if exists translation_field_state_draft_source_hash_check,
  add constraint translation_field_state_draft_source_hash_check
    check (draft_source_hash is null or draft_source_hash ~ '^[0-9a-f]{64}$'),
  drop constraint if exists translation_field_state_draft_revision_check,
  add constraint translation_field_state_draft_revision_check
    check (draft_source_revision is null or draft_source_revision > 0),
  drop constraint if exists translation_field_state_lock_version_check,
  add constraint translation_field_state_lock_version_check
    check (lock_version > 0),
  drop constraint if exists translation_field_state_draft_consistency_check,
  add constraint translation_field_state_draft_consistency_check check (
    (workflow_status = 'none' and draft_value is null and draft_source_hash is null and draft_source_revision is null)
    or
    (workflow_status <> 'none' and draft_value is not null and draft_source_hash is not null and draft_source_revision is not null)
  );

create index if not exists translation_field_state_editorial_idx
  on public.translation_field_state (publication_status, workflow_status, target_language, updated_at desc);

-- Preserva exactamente la visibilidad previa. No modifica ningún texto.
update public.translation_field_state
set publication_status = 'published',
    published_at = coalesce(reviewed_at, translated_at, updated_at)
where publication_status = 'unpublished'
  and translated_source_hash = source_hash
  and translated_revision = source_revision
  and (
    status in ('reviewed','machine_translated')
    or (status = 'imported_unreviewed' and is_protected)
  );

create or replace function public.translation_validate_editor_value(
  p_resource_type text, p_field_name text, p_value jsonb
)
returns void
language plpgsql stable security definer
set search_path = pg_catalog, public
as $$
declare
  field_kind text;
  max_length integer;
  text_length integer;
begin
  perform public.translation_assert_field(p_resource_type,p_field_name);
  select value_kind,max_characters into field_kind,max_length
  from public.translation_resource_fields
  where resource_type=p_resource_type and field_name=p_field_name and enabled;
  if not found then raise exception 'Campo traducible no disponible' using errcode='22023'; end if;
  if not public.translation_value_present(p_value) then
    raise exception 'La traducción no puede estar vacía' using errcode='22023';
  end if;
  if field_kind in ('text','rich_text') then
    if jsonb_typeof(p_value) <> 'string' then raise exception 'El campo requiere texto' using errcode='22023'; end if;
    text_length := char_length(p_value #>> '{}');
  elsif field_kind = 'text_array' then
    if jsonb_typeof(p_value) <> 'array' or exists(
      select 1 from jsonb_array_elements(p_value) item where jsonb_typeof(item) <> 'string' or btrim(item #>> '{}') = ''
    ) then raise exception 'El campo requiere un array no vacío de textos' using errcode='22023'; end if;
    select coalesce(sum(char_length(item #>> '{}')),0) into text_length from jsonb_array_elements(p_value) item;
  else
    raise exception 'Tipo de campo no soportado por el editor' using errcode='22023';
  end if;
  if max_length is not null and text_length > max_length then
    raise exception 'La traducción supera el máximo de % caracteres',max_length using errcode='22023';
  end if;
end
$$;

create or replace function public.translation_editor_assert_version(
  p_state public.translation_field_state, p_expected_lock_version bigint
)
returns void
language plpgsql stable security definer
set search_path = pg_catalog, public
as $$
begin
  if p_expected_lock_version is null or p_state.lock_version <> p_expected_lock_version then
    raise exception 'La traducción cambió en otra sesión; recargue antes de continuar' using errcode='40001';
  end if;
end
$$;

create or replace function public.translation_editor_assert_source(
  p_state public.translation_field_state
)
returns void
language plpgsql stable security definer
set search_path = pg_catalog, public
as $$
declare source_value jsonb;
begin
  source_value := public.translation_read_value(p_state.resource_type,p_state.resource_id,p_state.field_name,p_state.source_language);
  if not public.translation_value_present(source_value) or public.translation_hash(source_value) <> p_state.source_hash then
    raise exception 'El texto fuente cambió; recargue el registro antes de editar' using errcode='40001';
  end if;
end
$$;

create or replace function public.translation_save_draft(
  p_state_id uuid, p_value jsonb, p_expected_lock_version bigint
)
returns bigint
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare state_row public.translation_field_state%rowtype;
begin
  select * into state_row from public.translation_field_state where id=p_state_id for update;
  if not found then raise exception 'Estado no encontrado' using errcode='P0002'; end if;
  perform public.translation_assert_admin_permission(state_row.resource_type);
  perform public.translation_editor_assert_version(state_row,p_expected_lock_version);
  perform public.translation_editor_assert_source(state_row);
  perform public.translation_validate_editor_value(state_row.resource_type,state_row.field_name,p_value);
  update public.translation_field_state set
    draft_value=p_value,draft_source_hash=source_hash,draft_source_revision=source_revision,
    workflow_status='draft',draft_updated_at=now(),draft_updated_by=auth.uid(),
    submitted_at=null,submitted_by=null,approved_at=null,approved_by=null,
    is_protected=true,protection_reason='manual',translation_method='manual',
    lock_version=lock_version+1,updated_at=now()
  where id=state_row.id returning lock_version into p_expected_lock_version;
  update public.translation_jobs set status='cancelled',completed_at=now(),error_code='manual_draft',
    last_error='Existe un borrador manual.',locked_at=null,locked_by=null,lease_expires_at=null,updated_at=now()
  where resource_type=state_row.resource_type and resource_id=state_row.resource_id
    and field_name=state_row.field_name and target_language=state_row.target_language
    and status in ('queued','running','retry_wait');
  return p_expected_lock_version;
end
$$;

create or replace function public.translation_submit_review(p_state_id uuid,p_expected_lock_version bigint)
returns bigint language plpgsql security definer set search_path=pg_catalog,public as $$
declare state_row public.translation_field_state%rowtype;
begin
  select * into state_row from public.translation_field_state where id=p_state_id for update;
  if not found then raise exception 'Estado no encontrado' using errcode='P0002'; end if;
  perform public.translation_assert_admin_permission(state_row.resource_type);
  perform public.translation_editor_assert_version(state_row,p_expected_lock_version);
  perform public.translation_editor_assert_source(state_row);
  if state_row.workflow_status <> 'draft' or state_row.draft_value is null then raise exception 'No existe un borrador listo para revisión' using errcode='22023'; end if;
  if state_row.draft_source_hash <> state_row.source_hash or state_row.draft_source_revision <> state_row.source_revision then raise exception 'El borrador corresponde a una fuente anterior' using errcode='40001'; end if;
  update public.translation_field_state set workflow_status='in_review',submitted_at=now(),submitted_by=auth.uid(),
    approved_at=null,approved_by=null,lock_version=lock_version+1,updated_at=now()
  where id=state_row.id returning lock_version into p_expected_lock_version;
  return p_expected_lock_version;
end $$;

create or replace function public.translation_approve_draft(p_state_id uuid,p_expected_lock_version bigint)
returns bigint language plpgsql security definer set search_path=pg_catalog,public as $$
declare state_row public.translation_field_state%rowtype;
begin
  select * into state_row from public.translation_field_state where id=p_state_id for update;
  if not found then raise exception 'Estado no encontrado' using errcode='P0002'; end if;
  perform public.translation_assert_admin_permission(state_row.resource_type);
  perform public.translation_editor_assert_version(state_row,p_expected_lock_version);
  perform public.translation_editor_assert_source(state_row);
  if state_row.workflow_status <> 'in_review' or state_row.draft_value is null then raise exception 'El borrador no está en revisión' using errcode='22023'; end if;
  if state_row.draft_source_hash <> state_row.source_hash or state_row.draft_source_revision <> state_row.source_revision then raise exception 'El borrador corresponde a una fuente anterior' using errcode='40001'; end if;
  update public.translation_field_state set workflow_status='approved',approved_at=now(),approved_by=auth.uid(),
    lock_version=lock_version+1,updated_at=now()
  where id=state_row.id returning lock_version into p_expected_lock_version;
  return p_expected_lock_version;
end $$;

create or replace function public.translation_publish_draft(p_state_id uuid,p_expected_lock_version bigint)
returns bigint language plpgsql security definer set search_path=pg_catalog,public as $$
declare state_row public.translation_field_state%rowtype;
begin
  select * into state_row from public.translation_field_state where id=p_state_id for update;
  if not found then raise exception 'Estado no encontrado' using errcode='P0002'; end if;
  perform public.translation_assert_admin_permission(state_row.resource_type);
  perform public.translation_editor_assert_version(state_row,p_expected_lock_version);
  perform public.translation_editor_assert_source(state_row);
  if state_row.workflow_status <> 'approved' or state_row.draft_value is null then raise exception 'El borrador no está aprobado' using errcode='22023'; end if;
  if state_row.draft_source_hash <> state_row.source_hash or state_row.draft_source_revision <> state_row.source_revision then raise exception 'El borrador corresponde a una fuente anterior' using errcode='40001'; end if;
  perform set_config('app.translation_editor_publish_state',state_row.id::text,true);
  perform public.translation_write_value(state_row.resource_type,state_row.resource_id,state_row.field_name,state_row.target_language,state_row.draft_value,auth.uid());
  update public.translation_field_state set
    status='reviewed',translation_method='manual',provider=null,
    translated_source_hash=source_hash,translated_revision=source_revision,
    translated_at=now(),reviewed_at=coalesce(approved_at,now()),reviewed_by=coalesce(approved_by,auth.uid()),
    is_protected=true,protection_reason='manual',publication_status='published',
    published_at=now(),published_by=auth.uid(),withdrawn_at=null,withdrawn_by=null,
    workflow_status='none',draft_value=null,draft_source_hash=null,draft_source_revision=null,
    draft_updated_at=null,draft_updated_by=null,submitted_at=null,submitted_by=null,approved_at=null,approved_by=null,
    last_error_code=null,last_error=null,lock_version=lock_version+1,updated_at=now()
  where id=state_row.id returning lock_version into p_expected_lock_version;
  return p_expected_lock_version;
end $$;

-- site_content y platform_translations contienen a la vez el idioma fuente y
-- los valores traducidos. Una escritura administrativa directa sobre un
-- idioma destino no puede conservar accidentalmente una publicación previa.
-- La marca local solo la establece translation_publish_draft dentro de la
-- misma transacción y para el estado exacto que se está publicando.
create or replace function public.translation_invalidate_direct_target_edit(
  p_resource_type text,p_resource_id text,p_field_name text,p_target_language text,
  p_missing boolean default false
)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare state_id uuid;
begin
  select id into state_id from public.translation_field_state
  where resource_type=p_resource_type and resource_id=p_resource_id
    and field_name=p_field_name and target_language=p_target_language;
  if not found or current_setting('app.translation_editor_publish_state',true)=state_id::text then return; end if;
  update public.translation_field_state set
    status=case when p_missing then 'missing' else 'imported_unreviewed' end,
    translated_source_hash=null,translated_revision=null,translated_at=null,reviewed_at=null,reviewed_by=null,
    publication_status='unpublished',withdrawn_at=case when publication_status='published' then now() else withdrawn_at end,
    withdrawn_by=null,workflow_status='none',draft_value=null,draft_source_hash=null,draft_source_revision=null,
    draft_updated_at=null,draft_updated_by=null,submitted_at=null,submitted_by=null,approved_at=null,approved_by=null,
    is_protected=true,protection_reason='manual',translation_method='manual',
    lock_version=lock_version+1,updated_at=now()
  where id=state_id;
end $$;

create or replace function public.translation_site_content_target_guard()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare old_target boolean:=false; new_target boolean:=false;
begin
  if tg_op <> 'INSERT' then
    old_target := old.language <> 'global' and not exists(select 1 from public.languages where code=old.language and is_default);
  end if;
  if tg_op <> 'DELETE' then
    new_target := new.language <> 'global' and not exists(select 1 from public.languages where code=new.language and is_default);
  end if;
  if old_target and (tg_op='DELETE' or not new_target or new.key is distinct from old.key or new.language is distinct from old.language) then
    perform public.translation_invalidate_direct_target_edit('site_content',old.key,'value',old.language,true);
  end if;
  if new_target and (tg_op='INSERT' or not old_target or new.key is distinct from old.key or new.language is distinct from old.language or new.value is distinct from old.value) then
    perform public.translation_invalidate_direct_target_edit('site_content',new.key,'value',new.language,false);
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;

create or replace function public.translation_platform_target_guard()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare old_target boolean:=false; new_target boolean:=false; field_name text;
begin
  if tg_op <> 'INSERT' then old_target:=not exists(select 1 from public.languages where code=old.language and is_default); end if;
  if tg_op <> 'DELETE' then new_target:=not exists(select 1 from public.languages where code=new.language and is_default); end if;
  if old_target and (tg_op='DELETE' or not new_target or new.platform_id is distinct from old.platform_id or new.language is distinct from old.language) then
    foreach field_name in array array['short_description','description','pros','cons','seo_title','seo_description'] loop
      perform public.translation_invalidate_direct_target_edit('platform_translation',old.platform_id::text,field_name,old.language,true);
    end loop;
  end if;
  if new_target then
    if tg_op='INSERT' or not old_target or new.platform_id is distinct from old.platform_id or new.language is distinct from old.language or new.short_description is distinct from old.short_description then perform public.translation_invalidate_direct_target_edit('platform_translation',new.platform_id::text,'short_description',new.language,false); end if;
    if tg_op='INSERT' or not old_target or new.platform_id is distinct from old.platform_id or new.language is distinct from old.language or new.description is distinct from old.description then perform public.translation_invalidate_direct_target_edit('platform_translation',new.platform_id::text,'description',new.language,false); end if;
    if tg_op='INSERT' or not old_target or new.platform_id is distinct from old.platform_id or new.language is distinct from old.language or new.pros is distinct from old.pros then perform public.translation_invalidate_direct_target_edit('platform_translation',new.platform_id::text,'pros',new.language,false); end if;
    if tg_op='INSERT' or not old_target or new.platform_id is distinct from old.platform_id or new.language is distinct from old.language or new.cons is distinct from old.cons then perform public.translation_invalidate_direct_target_edit('platform_translation',new.platform_id::text,'cons',new.language,false); end if;
    if tg_op='INSERT' or not old_target or new.platform_id is distinct from old.platform_id or new.language is distinct from old.language or new.seo_title is distinct from old.seo_title then perform public.translation_invalidate_direct_target_edit('platform_translation',new.platform_id::text,'seo_title',new.language,false); end if;
    if tg_op='INSERT' or not old_target or new.platform_id is distinct from old.platform_id or new.language is distinct from old.language or new.seo_description is distinct from old.seo_description then perform public.translation_invalidate_direct_target_edit('platform_translation',new.platform_id::text,'seo_description',new.language,false); end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists translation_site_content_target_guard on public.site_content;
create trigger translation_site_content_target_guard after insert or update or delete on public.site_content
for each row execute function public.translation_site_content_target_guard();
drop trigger if exists translation_platform_target_guard on public.platform_translations;
create trigger translation_platform_target_guard after insert or update or delete on public.platform_translations
for each row execute function public.translation_platform_target_guard();

create or replace function public.translation_withdraw_publication(p_state_id uuid,p_expected_lock_version bigint)
returns bigint language plpgsql security definer set search_path=pg_catalog,public as $$
declare state_row public.translation_field_state%rowtype;
begin
  select * into state_row from public.translation_field_state where id=p_state_id for update;
  if not found then raise exception 'Estado no encontrado' using errcode='P0002'; end if;
  perform public.translation_assert_admin_permission(state_row.resource_type);
  perform public.translation_editor_assert_version(state_row,p_expected_lock_version);
  if state_row.publication_status <> 'published' then raise exception 'La traducción no está publicada' using errcode='22023'; end if;
  update public.translation_field_state set publication_status='unpublished',withdrawn_at=now(),withdrawn_by=auth.uid(),
    lock_version=lock_version+1,updated_at=now()
  where id=state_row.id returning lock_version into p_expected_lock_version;
  return p_expected_lock_version;
end $$;

-- Una fuente nueva retira inmediatamente la publicación y devuelve cualquier
-- revisión pendiente a borrador. Nunca publica ni crea trabajos.
create or replace function public.translation_editorial_state_guard()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
  if new.status in ('missing','stale','error')
    or new.translated_source_hash is distinct from new.source_hash
    or new.translated_revision is distinct from new.source_revision then
    if new.publication_status='published' then
      new.publication_status:='unpublished'; new.withdrawn_at:=now(); new.withdrawn_by:=null;
    end if;
  end if;
  if new.workflow_status in ('in_review','approved') and (
    new.draft_source_hash is distinct from new.source_hash or new.draft_source_revision is distinct from new.source_revision
  ) then
    new.workflow_status:='draft'; new.submitted_at:=null; new.submitted_by:=null; new.approved_at:=null; new.approved_by:=null;
  end if;
  return new;
end $$;

drop trigger if exists translation_editorial_state_guard on public.translation_field_state;
create trigger translation_editorial_state_guard before update on public.translation_field_state
for each row execute function public.translation_editorial_state_guard();

revoke all on function public.translation_validate_editor_value(text,text,jsonb) from public,anon,authenticated;
revoke all on function public.translation_editor_assert_version(public.translation_field_state,bigint) from public,anon,authenticated;
revoke all on function public.translation_editor_assert_source(public.translation_field_state) from public,anon,authenticated;
revoke all on function public.translation_editorial_state_guard() from public,anon,authenticated;
revoke all on function public.translation_invalidate_direct_target_edit(text,text,text,text,boolean) from public,anon,authenticated;
revoke all on function public.translation_site_content_target_guard() from public,anon,authenticated;
revoke all on function public.translation_platform_target_guard() from public,anon,authenticated;

revoke all on function public.translation_save_draft(uuid,jsonb,bigint) from public,anon,authenticated;
revoke all on function public.translation_submit_review(uuid,bigint) from public,anon,authenticated;
revoke all on function public.translation_approve_draft(uuid,bigint) from public,anon,authenticated;
revoke all on function public.translation_publish_draft(uuid,bigint) from public,anon,authenticated;
revoke all on function public.translation_withdraw_publication(uuid,bigint) from public,anon,authenticated;
grant execute on function public.translation_save_draft(uuid,jsonb,bigint) to authenticated;
grant execute on function public.translation_submit_review(uuid,bigint) to authenticated;
grant execute on function public.translation_approve_draft(uuid,bigint) to authenticated;
grant execute on function public.translation_publish_draft(uuid,bigint) to authenticated;
grant execute on function public.translation_withdraw_publication(uuid,bigint) to authenticated;

-- Evita que las RPC legacy omitan el flujo editorial desde clientes autenticados.
revoke execute on function public.translation_save_manual(text,text,text,text,jsonb,boolean) from authenticated;
revoke execute on function public.translation_approve(text,text,text,text,text,text,boolean) from authenticated;

do $$
begin
  if exists(select 1 from public.translation_jobs where created_at >= transaction_timestamp()) then
    raise exception '3E.2 no debe crear translation_jobs';
  end if;
  if exists(select 1 from public.translation_field_state where publication_status='published' and (
    translated_source_hash is distinct from source_hash or translated_revision is distinct from source_revision
    or not (status in ('reviewed','machine_translated') or (status='imported_unreviewed' and is_protected))
  )) then raise exception 'Backfill publicó un estado no elegible'; end if;
end $$;

commit;

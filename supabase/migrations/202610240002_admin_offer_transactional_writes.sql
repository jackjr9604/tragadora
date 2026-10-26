-- 3E.10.3.2C.5C.1: escrituras administrativas atómicas para ofertas.
-- No publica traducciones ni crea jobs. Los triggers editoriales existentes se
-- ejecutan dentro de la misma transacción que cada RPC.
begin;

do $$
begin
  if to_regclass('public.offers') is null
     or to_regclass('public.platforms') is null
     or to_regclass('public.challenges') is null
     or to_regclass('public.affiliate_links') is null
     or to_regclass('public.languages') is null
     or to_regclass('public.countries') is null
     or to_regclass('public.admin_audit_log') is null
     or to_regprocedure('public.has_admin_permission(text)') is null then
    raise exception 'Faltan dependencias para las escrituras transaccionales de ofertas';
  end if;
end $$;

alter table public.offers
  add column if not exists updated_at timestamptz not null default now();

create table public.offer_admin_creation_requests (
  request_id uuid primary key,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  payload_hash text not null,
  offer_id uuid not null unique references public.offers(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.offer_admin_creation_requests enable row level security;
revoke all on table public.offer_admin_creation_requests from public,anon,authenticated,service_role;

-- La validacion procedural de admin_save_offer evita errores amigablemente,
-- pero solo una restriccion estructural puede impedir que otro proceso cambie
-- despues la plataforma del challenge o del enlace afiliado. Las columnas
-- referenciadas necesitan una clave unica compuesta aunque id ya sea PK.
do $$
begin
  if exists(
    select 1
    from public.offers o
    left join public.challenges c on c.id = o.challenge_id
    where o.challenge_id is not null
      and (c.id is null or c.platform_id is distinct from o.platform_id)
  ) then
    raise exception 'Existen ofertas con challenge ausente o perteneciente a otra plataforma';
  end if;
  if exists(
    select 1
    from public.offers o
    left join public.affiliate_links a on a.id = o.affiliate_link_id
    where o.affiliate_link_id is not null
      and (a.id is null or a.platform_id is distinct from o.platform_id)
  ) then
    raise exception 'Existen ofertas con enlace afiliado ausente o perteneciente a otra plataforma';
  end if;
end $$;

alter table public.challenges
  add constraint challenges_id_platform_id_key unique (id, platform_id);

alter table public.affiliate_links
  add constraint affiliate_links_id_platform_id_key unique (id, platform_id);

alter table public.offers
  add constraint offers_challenge_platform_fkey
    foreign key (challenge_id, platform_id)
    references public.challenges (id, platform_id)
    on update restrict
    on delete set null (challenge_id);

-- Sustituye la FK simple para conservar exactamente su SET NULL, pero sin
-- permitir que SET NULL borre tambien offers.platform_id.
alter table public.offers
  drop constraint offers_affiliate_link_id_fkey,
  add constraint offers_affiliate_link_platform_fkey
    foreign key (affiliate_link_id, platform_id)
    references public.affiliate_links (id, platform_id)
    on update restrict
    on delete set null (affiliate_link_id);

create or replace function public.offer_touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  -- El valor enviado por el cliente se ignora y cada UPDATE obtiene una versión
  -- estrictamente posterior, incluso dentro de la misma transacción.
  if tg_op='INSERT' then
    new.updated_at := clock_timestamp();
  else
    new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  end if;
  return new;
end $$;

drop trigger if exists offer_touch_updated_at on public.offers;
create trigger offer_touch_updated_at
before insert or update on public.offers
for each row execute function public.offer_touch_updated_at();

create or replace function public.admin_save_offer(
  p_offer_id uuid,
  p_expected_updated_at timestamptz,
  p_creation_request_id uuid,
  p_payload jsonb
) returns table(
  offer_id uuid,
  operation text,
  current_updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor uuid := auth.uid();
  current_row public.offers%rowtype;
  saved_row public.offers%rowtype;
  creation_request public.offer_admin_creation_requests%rowtype;
  next_platform_id uuid;
  next_challenge_id uuid;
  next_affiliate_link_id uuid;
  next_title text;
  next_description text;
  next_discount_value numeric;
  next_discount_type text;
  next_promo_code text;
  next_includes_free_account boolean;
  next_free_account_label text;
  next_is_featured boolean;
  next_hot_badge text;
  next_short_highlight text;
  next_country_code text;
  next_language text;
  next_starts_at timestamptz;
  next_expires_at timestamptz;
  next_priority integer;
  next_status boolean;
  action_name text;
  normalized_payload_hash text;
  affected integer;
begin
  if actor is null then raise exception 'Unauthorized' using errcode='28000'; end if;
  if (p_offer_id is null and (p_expected_updated_at is not null or p_creation_request_id is null))
     or (p_offer_id is not null and (p_expected_updated_at is null or p_creation_request_id is not null)) then
    raise exception 'Identidad o snapshot de la operación no válido' using errcode='22023';
  end if;
  if public.has_admin_permission(case when p_offer_id is null then 'offers.create' else 'offers.update' end) is not true then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'El payload de la oferta debe ser un objeto' using errcode='22023';
  end if;
  if exists(
    select 1 from jsonb_object_keys(p_payload) key
    where key not in (
      'platform_id','challenge_id','affiliate_link_id','title','description','discount_value','discount_type',
      'promo_code','includes_free_account','free_account_label','is_featured','hot_badge','short_highlight',
      'country_code','language','starts_at','expires_at','priority','status'
    )
  ) then raise exception 'El payload contiene campos no permitidos' using errcode='22023'; end if;
  if not (p_payload ?& array['platform_id','title','discount_value','discount_type','includes_free_account','is_featured','priority','status']) then
    raise exception 'Faltan campos obligatorios de la oferta' using errcode='22023';
  end if;
  if jsonb_typeof(p_payload->'platform_id') <> 'string'
     or (p_payload->>'platform_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or jsonb_typeof(p_payload->'title') <> 'string'
     or jsonb_typeof(p_payload->'discount_value') <> 'number'
     or jsonb_typeof(p_payload->'discount_type') <> 'string'
     or jsonb_typeof(p_payload->'includes_free_account') <> 'boolean'
     or jsonb_typeof(p_payload->'is_featured') <> 'boolean'
     or jsonb_typeof(p_payload->'priority') <> 'number'
     or jsonb_typeof(p_payload->'status') <> 'boolean' then
    raise exception 'Tipos de datos de oferta no válidos' using errcode='22023';
  end if;
  if exists(
    select 1 from (values
      ('challenge_id'),('affiliate_link_id'),('description'),('promo_code'),('free_account_label'),
      ('hot_badge'),('short_highlight'),('country_code'),('language'),('starts_at'),('expires_at')
    ) optional_field(name)
    where p_payload ? optional_field.name
      and jsonb_typeof(p_payload->optional_field.name) not in ('string','null')
  ) then raise exception 'Tipos de campos opcionales no válidos' using errcode='22023'; end if;

  begin
    next_platform_id := (p_payload->>'platform_id')::uuid;
    next_challenge_id := nullif(p_payload->>'challenge_id','')::uuid;
    next_affiliate_link_id := nullif(p_payload->>'affiliate_link_id','')::uuid;
    next_discount_value := (p_payload->>'discount_value')::numeric;
    next_priority := (p_payload->>'priority')::integer;
    next_status := (p_payload->>'status')::boolean;
    next_includes_free_account := (p_payload->>'includes_free_account')::boolean;
    next_is_featured := (p_payload->>'is_featured')::boolean;
    next_starts_at := nullif(p_payload->>'starts_at','')::timestamptz;
    next_expires_at := nullif(p_payload->>'expires_at','')::timestamptz;
  exception when invalid_text_representation or invalid_datetime_format or numeric_value_out_of_range then
    raise exception 'Formato de datos de oferta no válido' using errcode='22023';
  end;

  next_title := btrim(p_payload->>'title');
  next_description := nullif(btrim(p_payload->>'description'),'');
  next_discount_type := p_payload->>'discount_type';
  next_promo_code := nullif(upper(btrim(p_payload->>'promo_code')),'');
  next_free_account_label := case when next_includes_free_account then nullif(btrim(p_payload->>'free_account_label'),'') end;
  next_hot_badge := nullif(btrim(p_payload->>'hot_badge'),'');
  next_short_highlight := nullif(btrim(p_payload->>'short_highlight'),'');
  next_country_code := nullif(upper(btrim(p_payload->>'country_code')),'');
  next_language := nullif(lower(btrim(p_payload->>'language')),'');

  if length(next_title) not between 1 and 500
     or (next_description is not null and length(next_description) > 10000)
     or next_discount_type not in ('percentage','fixed')
     or next_discount_value < 0 or next_discount_value > 1000000000
     or (next_discount_type='percentage' and next_discount_value > 100)
     or (next_promo_code is not null and length(next_promo_code) > 240)
     or (next_free_account_label is not null and length(next_free_account_label) > 500)
     or (next_hot_badge is not null and length(next_hot_badge) > 200)
     or (next_short_highlight is not null and length(next_short_highlight) > 1000)
     or (p_payload->>'priority')::numeric <> trunc((p_payload->>'priority')::numeric)
     or next_priority < 0 or next_priority > 10000
     or (next_country_code is not null and next_country_code !~ '^[A-Z]{2}$')
     or (next_language is not null and next_language !~ '^[a-z]{2,12}(-[a-z0-9]{2,12})*$')
     or (next_starts_at is not null and not isfinite(next_starts_at))
     or (next_expires_at is not null and not isfinite(next_expires_at))
     or (next_starts_at is not null and next_expires_at is not null and next_starts_at > next_expires_at) then
    raise exception 'Datos de oferta no válidos' using errcode='22023';
  end if;

  perform 1 from public.platforms p
  where p.id=next_platform_id and p.type in ('prop_firm','broker','exchange')
  for share;
  if not found then raise exception 'Plataforma no válida' using errcode='23503'; end if;
  if next_challenge_id is not null then
    perform 1 from public.challenges c where c.id=next_challenge_id and c.platform_id=next_platform_id for share;
    if not found then raise exception 'El challenge no pertenece a la plataforma' using errcode='23503'; end if;
  end if;
  if next_affiliate_link_id is not null then
    -- Un affiliate_link_id explícito conserva la semántica vigente de /go/:
    -- pertenece a la plataforma y actúa como override comercial. /go/ exige
    -- que siga activo, pero no reaplica challenge, país ni idioma al exactLink.
    perform 1 from public.affiliate_links a where a.id=next_affiliate_link_id and a.platform_id=next_platform_id for share;
    if not found then raise exception 'El enlace afiliado no pertenece a la plataforma' using errcode='23503'; end if;
  end if;
  if next_country_code is not null then
    perform 1 from public.countries c where c.code=next_country_code for share;
    if not found then raise exception 'País no válido' using errcode='23503'; end if;
  end if;
  if next_language is not null then
    perform 1 from public.languages l where l.code=next_language and l.is_active for share;
    if not found then raise exception 'Idioma no válido o inactivo' using errcode='23503'; end if;
  end if;

  normalized_payload_hash := pg_catalog.md5(pg_catalog.jsonb_build_object(
    'platform_id',next_platform_id,'challenge_id',next_challenge_id,'affiliate_link_id',next_affiliate_link_id,
    'title',next_title,'description',next_description,'discount_value',next_discount_value,
    'discount_type',next_discount_type,'promo_code',next_promo_code,
    'includes_free_account',next_includes_free_account,'free_account_label',next_free_account_label,
    'is_featured',next_is_featured,'hot_badge',next_hot_badge,'short_highlight',next_short_highlight,
    'country_code',next_country_code,'language',next_language,'starts_at',next_starts_at,
    'expires_at',next_expires_at,'priority',next_priority,'status',next_status
  )::text);

  if p_offer_id is null then
    action_name := 'created';
    select r.* into creation_request
    from public.offer_admin_creation_requests r
    where r.request_id=p_creation_request_id
    for update;
    if found then
      if creation_request.actor_user_id is distinct from actor
         or creation_request.payload_hash is distinct from normalized_payload_hash then
        raise exception 'La identidad de creación ya fue utilizada con otros datos' using errcode='23505';
      end if;
      select o.* into current_row from public.offers o where o.id=creation_request.offer_id;
      if not found then raise exception 'La creación idempotente perdió su oferta' using errcode='P0001'; end if;
      return query select current_row.id,'replayed'::text,current_row.updated_at;
      return;
    end if;
    begin
      insert into public.offers(
        platform_id,challenge_id,affiliate_link_id,title,description,discount_value,discount_type,promo_code,
        includes_free_account,free_account_label,is_featured,hot_badge,short_highlight,country_code,language,
        starts_at,expires_at,priority,status
      ) values(
        next_platform_id,next_challenge_id,next_affiliate_link_id,next_title,next_description,next_discount_value,
        next_discount_type,next_promo_code,next_includes_free_account,next_free_account_label,next_is_featured,
        next_hot_badge,next_short_highlight,next_country_code,next_language,next_starts_at,next_expires_at,next_priority,next_status
      ) returning * into saved_row;
      insert into public.offer_admin_creation_requests(request_id,actor_user_id,payload_hash,offer_id)
      values(p_creation_request_id,actor,normalized_payload_hash,saved_row.id);
    exception when unique_violation then
      select r.* into creation_request
      from public.offer_admin_creation_requests r
      where r.request_id=p_creation_request_id
      for update;
      if not found
         or creation_request.actor_user_id is distinct from actor
         or creation_request.payload_hash is distinct from normalized_payload_hash then
        raise exception 'La identidad de creación ya fue utilizada con otros datos' using errcode='23505';
      end if;
      select o.* into current_row from public.offers o where o.id=creation_request.offer_id;
      if not found then raise exception 'La creación idempotente perdió su oferta' using errcode='P0001'; end if;
      return query select current_row.id,'replayed'::text,current_row.updated_at;
      return;
    end;
  else
    action_name := 'updated';
    select o.* into current_row from public.offers o where o.id=p_offer_id for update;
    if not found then raise exception 'Oferta no encontrada' using errcode='P0002'; end if;
    if p_expected_updated_at is null or current_row.updated_at is distinct from p_expected_updated_at then
      raise exception 'La oferta cambió; recarga antes de guardar' using errcode='40001';
    end if;
    update public.offers o set
      platform_id=next_platform_id,challenge_id=next_challenge_id,affiliate_link_id=next_affiliate_link_id,
      title=next_title,description=next_description,discount_value=next_discount_value,discount_type=next_discount_type,
      promo_code=next_promo_code,includes_free_account=next_includes_free_account,free_account_label=next_free_account_label,
      is_featured=next_is_featured,hot_badge=next_hot_badge,short_highlight=next_short_highlight,
      country_code=next_country_code,language=next_language,starts_at=next_starts_at,expires_at=next_expires_at,
      priority=next_priority,status=next_status
    where o.id=p_offer_id returning o.* into saved_row;
    get diagnostics affected=row_count;
    if affected<>1 then raise exception 'No fue posible actualizar exactamente una oferta' using errcode='P0001'; end if;
  end if;

  insert into public.admin_audit_log(actor_user_id,action,module,previous_value,new_value)
  values(actor,'offer.'||action_name,'offers',
    case when current_row.id is null then null else jsonb_build_object(
      'id',current_row.id,'platform_id',current_row.platform_id,'challenge_id',current_row.challenge_id,
      'affiliate_link_id',current_row.affiliate_link_id,'status',current_row.status,'updated_at',current_row.updated_at
    ) end,
    jsonb_build_object(
      'id',saved_row.id,'platform_id',saved_row.platform_id,'challenge_id',saved_row.challenge_id,
      'affiliate_link_id',saved_row.affiliate_link_id,'status',saved_row.status,'updated_at',saved_row.updated_at
    ));
  return query select saved_row.id,action_name,saved_row.updated_at;
exception
  when unique_violation then raise exception 'La oferta entra en conflicto con un registro existente' using errcode='23505';
  when foreign_key_violation then raise exception 'Una referencia de la oferta ya no existe' using errcode='23503';
  when check_violation then raise exception 'La oferta no cumple las restricciones' using errcode='23514';
end $$;

create or replace function public.admin_set_offer_status(
  p_offer_id uuid,
  p_expected_updated_at timestamptz,
  p_status boolean
) returns table(
  offer_id uuid,
  status boolean,
  current_updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor uuid := auth.uid();
  current_row public.offers%rowtype;
  saved_row public.offers%rowtype;
  affected integer;
begin
  if actor is null then raise exception 'Unauthorized' using errcode='28000'; end if;
  if public.has_admin_permission('offers.update') is not true then raise exception 'Forbidden' using errcode='42501'; end if;
  if p_offer_id is null or p_expected_updated_at is null or p_status is null then
    raise exception 'Snapshot de oferta no válido' using errcode='22023';
  end if;
  select o.* into current_row from public.offers o where o.id=p_offer_id for update;
  if not found then raise exception 'Oferta no encontrada' using errcode='P0002'; end if;
  if current_row.updated_at is distinct from p_expected_updated_at then
    raise exception 'La oferta cambió; recarga antes de cambiar su estado' using errcode='40001';
  end if;
  update public.offers o set status=p_status where o.id=p_offer_id returning o.* into saved_row;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'No fue posible actualizar exactamente una oferta' using errcode='P0001'; end if;
  insert into public.admin_audit_log(actor_user_id,action,module,previous_value,new_value)
  values(actor,'offer.status_changed','offers',
    jsonb_build_object('id',current_row.id,'status',current_row.status,'updated_at',current_row.updated_at),
    jsonb_build_object('id',saved_row.id,'status',saved_row.status,'updated_at',saved_row.updated_at));
  return query select saved_row.id,saved_row.status,saved_row.updated_at;
end $$;

revoke all on function public.offer_touch_updated_at() from public,anon,authenticated,service_role;
revoke all on function public.admin_save_offer(uuid,timestamptz,uuid,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.admin_set_offer_status(uuid,timestamptz,boolean) from public,anon,authenticated,service_role;
grant execute on function public.admin_save_offer(uuid,timestamptz,uuid,jsonb) to authenticated;
grant execute on function public.admin_set_offer_status(uuid,timestamptz,boolean) to authenticated;

-- Las mutaciones administrativas se realizan exclusivamente mediante las RPC
-- anteriores. Se conservan SELECT y las políticas públicas existentes.
revoke insert,update,delete on table public.offers from public,anon,authenticated;

commit;

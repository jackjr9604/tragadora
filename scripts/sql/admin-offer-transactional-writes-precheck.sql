-- READ ONLY. Ejecutar antes de 202610240002.
begin transaction read only;

select required.object_name,to_regclass(required.object_name) is not null as exists
from (values
  ('public.offers'),('public.offer_translations'),('public.platforms'),('public.challenges'),
  ('public.affiliate_links'),('public.translation_field_state'),('public.admin_audit_log'),
  ('public.languages'),('public.countries')
) required(object_name);

select to_regprocedure('public.has_admin_permission(text)') is not null as permission_helper_exists;

do $$
declare missing_objects text[];
begin
  select array_agg(object_name order by object_name) into missing_objects
  from (values
    ('public.offers'),('public.offer_translations'),('public.platforms'),('public.challenges'),
    ('public.affiliate_links'),('public.translation_field_state'),('public.admin_audit_log'),
    ('public.languages'),('public.countries')
  ) required(object_name)
  where to_regclass(object_name) is null;
  if missing_objects is not null then
    raise exception 'PRECHECK: faltan dependencias: %', missing_objects;
  end if;
  if to_regprocedure('public.has_admin_permission(text)') is null then
    raise exception 'PRECHECK: falta public.has_admin_permission(text)';
  end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='offers' and column_name='updated_at') then
    raise exception 'PRECHECK: offers.updated_at ya existe; verificar despliegue previo antes de continuar';
  end if;
  if to_regprocedure('public.admin_save_offer(uuid,timestamp with time zone,uuid,jsonb)') is not null
     or to_regprocedure('public.admin_set_offer_status(uuid,timestamp with time zone,boolean)') is not null
     or to_regprocedure('public.offer_touch_updated_at()') is not null then
    raise exception 'PRECHECK: ya existen funciones de 202610240002';
  end if;
  if (select count(*) from information_schema.triggers where trigger_schema='public' and event_object_table='offers'
      and trigger_name in ('translation_offer_source_insert','translation_offer_source_update','translation_offer_source_delete')) <> 3 then
    raise exception 'PRECHECK: faltan triggers editoriales de offers';
  end if;
  if exists(
    select 1 from public.offers o left join public.challenges c on c.id=o.challenge_id
    where o.challenge_id is not null and (c.id is null or c.platform_id is distinct from o.platform_id)
  ) then
    raise exception 'PRECHECK: existen ofertas con challenge ausente o de otra plataforma';
  end if;
  if exists(
    select 1 from public.offers o left join public.affiliate_links a on a.id=o.affiliate_link_id
    where o.affiliate_link_id is not null and (a.id is null or a.platform_id is distinct from o.platform_id)
  ) then
    raise exception 'PRECHECK: existen ofertas con enlace afiliado ausente o de otra plataforma';
  end if;
  if exists(
    select 1 from pg_constraint
    where (conrelid='public.challenges'::regclass and conname='challenges_id_platform_id_key')
       or (conrelid='public.affiliate_links'::regclass and conname='affiliate_links_id_platform_id_key')
       or (conrelid='public.offers'::regclass and conname in ('offers_challenge_platform_fkey','offers_affiliate_link_platform_fkey'))
  ) then
    raise exception 'PRECHECK: ya existen restricciones estructurales de 202610240002';
  end if;
  if exists(
    select 1
    from pg_attribute attribute
    cross join lateral aclexplode(attribute.attacl) privilege
    where attribute.attrelid='public.offers'::regclass
      and attribute.attnum>0 and not attribute.attisdropped
      and privilege.grantee='authenticated'::regrole
      and privilege.privilege_type in ('INSERT','UPDATE')
  ) then
    raise exception 'PRECHECK: existen grants DML por columna para authenticated; requieren revisión explícita';
  end if;
  if to_regclass('public.offer_admin_creation_requests') is not null then
    raise exception 'PRECHECK: ya existe la tabla idempotente de 202610240002';
  end if;
end $$;

select column_name,data_type,is_nullable,column_default
from information_schema.columns
where table_schema='public' and table_name='offers'
order by ordinal_position;

select conname,pg_get_constraintdef(oid) definition
from pg_constraint where conrelid='public.offers'::regclass order by conname;

select trigger_name,event_manipulation,action_timing
from information_schema.triggers where trigger_schema='public' and event_object_table='offers'
order by trigger_name,event_manipulation;

select
  count(*) filter(where discount_type is null or discount_value is null) as offers_with_null_discount,
  count(*) filter(where coupon_code is not null) as offers_with_legacy_coupon,
  count(*) filter(where start_date is not null) as offers_with_legacy_start_date,
  count(*) filter(where end_date is not null) as offers_with_legacy_end_date
from public.offers;

select
  count(*) filter(where o.challenge_id is not null and c.id is null) as missing_challenge,
  count(*) filter(where c.id is not null and c.platform_id <> o.platform_id) as challenge_platform_mismatch,
  count(*) filter(where o.affiliate_link_id is not null and a.id is null) as missing_affiliate_link,
  count(*) filter(where a.id is not null and a.platform_id <> o.platform_id) as affiliate_platform_mismatch,
  count(*) filter(where o.country_code is not null and co.code is null) as missing_country,
  count(*) filter(where o.language is not null and l.code is null) as missing_language,
  count(*) filter(where l.code is not null and not l.is_active) as inactive_language
from public.offers o
left join public.challenges c on c.id=o.challenge_id
left join public.affiliate_links a on a.id=o.affiliate_link_id
left join public.countries co on co.code=o.country_code
left join public.languages l on l.code=o.language;

rollback;

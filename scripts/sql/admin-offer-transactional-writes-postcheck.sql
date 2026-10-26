-- READ ONLY. Ejecutar después de 202610240002.
begin transaction read only;

select column_name,data_type,is_nullable,column_default
from information_schema.columns
where table_schema='public' and table_name='offers' and column_name='updated_at';

select p.proname,
  pg_get_userbyid(p.proowner) as owner,
  p.prosecdef as security_definer,
  p.proconfig @> array['search_path=pg_catalog, public'] as safe_search_path,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
  has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
  has_function_privilege('service_role',p.oid,'EXECUTE') as service_role_execute,
  exists(
    select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) privilege
    where privilege.grantee=0 and privilege.privilege_type='EXECUTE'
  ) as public_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('admin_save_offer','admin_set_offer_status')
order by p.proname;

do $$
declare fn record;
begin
  if not exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='offers' and column_name='updated_at'
      and data_type='timestamp with time zone' and is_nullable='NO' and column_default='now()'
  ) then raise exception 'POSTCHECK: offers.updated_at incompatible'; end if;
  if to_regclass('public.offer_admin_creation_requests') is null
     or not (select relrowsecurity from pg_class where oid='public.offer_admin_creation_requests'::regclass)
     or has_table_privilege('anon','public.offer_admin_creation_requests','SELECT')
     or has_table_privilege('anon','public.offer_admin_creation_requests','INSERT')
     or has_table_privilege('authenticated','public.offer_admin_creation_requests','SELECT')
     or has_table_privilege('authenticated','public.offer_admin_creation_requests','INSERT')
     or has_table_privilege('authenticated','public.offer_admin_creation_requests','UPDATE')
     or has_table_privilege('authenticated','public.offer_admin_creation_requests','DELETE')
     or has_table_privilege('service_role','public.offer_admin_creation_requests','SELECT')
     or has_table_privilege('service_role','public.offer_admin_creation_requests','INSERT') then
    raise exception 'POSTCHECK: almacenamiento idempotente expuesto o incompatible';
  end if;
  if to_regprocedure('public.admin_save_offer(uuid,timestamp with time zone,uuid,jsonb)') is null
     or to_regprocedure('public.admin_set_offer_status(uuid,timestamp with time zone,boolean)') is null
     or to_regprocedure('public.offer_touch_updated_at()') is null then
    raise exception 'POSTCHECK: faltan firmas de funciones';
  end if;
  for fn in
    select p.oid,p.proname,pg_get_userbyid(p.proowner) owner,p.prosecdef,p.proconfig
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('admin_save_offer','admin_set_offer_status')
  loop
    if fn.owner <> 'postgres' or not fn.prosecdef
       or not (fn.proconfig @> array['search_path=pg_catalog, public'])
       or not has_function_privilege('authenticated',fn.oid,'EXECUTE')
       or has_function_privilege('anon',fn.oid,'EXECUTE')
       or has_function_privilege('service_role',fn.oid,'EXECUTE')
       or exists(select 1 from aclexplode(coalesce((select proacl from pg_proc where oid=fn.oid),acldefault('f',(select proowner from pg_proc where oid=fn.oid)))) a where a.grantee=0 and a.privilege_type='EXECUTE') then
      raise exception 'POSTCHECK: seguridad inválida para %',fn.proname;
    end if;
  end loop;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname in ('admin_save_offer','admin_set_offer_status')) <> 2 then
    raise exception 'POSTCHECK: cantidad inesperada de RPC';
  end if;
  if (select count(*) from information_schema.triggers where trigger_schema='public' and event_object_table='offers'
      and ((trigger_name='offer_touch_updated_at' and event_manipulation in ('INSERT','UPDATE') and action_timing='BEFORE')
        or (trigger_name in ('translation_offer_source_insert','translation_offer_source_update','translation_offer_source_delete') and action_timing='AFTER'))) <> 5 then
    raise exception 'POSTCHECK: triggers de offers incompletos';
  end if;
  if not exists(select 1 from information_schema.triggers where trigger_schema='public' and event_object_table='offers' and trigger_name='offer_touch_updated_at' and event_manipulation='INSERT' and action_timing='BEFORE')
     or not exists(select 1 from information_schema.triggers where trigger_schema='public' and event_object_table='offers' and trigger_name='offer_touch_updated_at' and event_manipulation='UPDATE' and action_timing='BEFORE')
     or not exists(select 1 from information_schema.triggers where trigger_schema='public' and event_object_table='offers' and trigger_name='translation_offer_source_insert' and event_manipulation='INSERT' and action_timing='AFTER')
     or not exists(select 1 from information_schema.triggers where trigger_schema='public' and event_object_table='offers' and trigger_name='translation_offer_source_update' and event_manipulation='UPDATE' and action_timing='AFTER')
     or not exists(select 1 from information_schema.triggers where trigger_schema='public' and event_object_table='offers' and trigger_name='translation_offer_source_delete' and event_manipulation='DELETE' and action_timing='AFTER') then
    raise exception 'POSTCHECK: eventos exactos de triggers de offers incorrectos';
  end if;
  if not exists(select 1 from pg_constraint where conrelid='public.challenges'::regclass and conname='challenges_id_platform_id_key' and contype='u')
     or not exists(select 1 from pg_constraint where conrelid='public.affiliate_links'::regclass and conname='affiliate_links_id_platform_id_key' and contype='u')
     or not exists(select 1 from pg_constraint where conrelid='public.offers'::regclass and conname='offers_challenge_platform_fkey' and contype='f'
       and pg_get_constraintdef(oid)='FOREIGN KEY (challenge_id, platform_id) REFERENCES challenges(id, platform_id) ON UPDATE RESTRICT ON DELETE SET NULL (challenge_id)')
     or not exists(select 1 from pg_constraint where conrelid='public.offers'::regclass and conname='offers_affiliate_link_platform_fkey' and contype='f'
       and pg_get_constraintdef(oid)='FOREIGN KEY (affiliate_link_id, platform_id) REFERENCES affiliate_links(id, platform_id) ON UPDATE RESTRICT ON DELETE SET NULL (affiliate_link_id)') then
    raise exception 'POSTCHECK: restricciones relacionales estructurales incorrectas';
  end if;
  if exists(select 1 from pg_constraint where conrelid='public.offers'::regclass and conname='offers_affiliate_link_id_fkey') then
    raise exception 'POSTCHECK: permanece la FK simple reemplazada de affiliate_link_id';
  end if;
  if exists(
    select 1 from public.offers o left join public.challenges c on (c.id,c.platform_id)=(o.challenge_id,o.platform_id)
    where o.challenge_id is not null and c.id is null
  ) or exists(
    select 1 from public.offers o left join public.affiliate_links a on (a.id,a.platform_id)=(o.affiliate_link_id,o.platform_id)
    where o.affiliate_link_id is not null and a.id is null
  ) then
    raise exception 'POSTCHECK: integridad relacional de ofertas incumplida';
  end if;
  if not exists(select 1 from pg_constraint where conrelid='public.offer_admin_creation_requests'::regclass and contype='p')
     or not exists(select 1 from pg_constraint where conrelid='public.offer_admin_creation_requests'::regclass and contype='f' and confrelid='public.offers'::regclass and confdeltype='c') then
    raise exception 'POSTCHECK: constraints del almacenamiento idempotente incompatibles';
  end if;
  if has_table_privilege('authenticated','public.offers','INSERT')
     or has_table_privilege('authenticated','public.offers','UPDATE')
     or has_table_privilege('authenticated','public.offers','DELETE')
     or exists(
       select 1
       from pg_attribute attribute
       cross join lateral aclexplode(attribute.attacl) privilege
       where attribute.attrelid='public.offers'::regclass
         and attribute.attnum>0 and not attribute.attisdropped
         and privilege.grantee='authenticated'::regrole
         and privilege.privilege_type in ('INSERT','UPDATE')
     ) then
    raise exception 'POSTCHECK: authenticated conserva DML directo sobre offers';
  end if;
  if not has_table_privilege('authenticated','public.offers','SELECT') then
    raise exception 'POSTCHECK: se perdió SELECT de authenticated sobre offers';
  end if;
end $$;

select trigger_name,event_manipulation,action_timing
from information_schema.triggers
where trigger_schema='public' and event_object_table='offers'
order by trigger_name,event_manipulation;

select count(*) as offer_jobs_total
from public.translation_jobs
where resource_type='offer_translation';

rollback;

\set ON_ERROR_STOP on
begin;
set role supabase_admin;
do $$ begin if to_regclass('public.tradagora_local_e2e_guard') is null then raise exception 'Solo E2E local'; end if; end $$;

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('a5200000-0000-4000-8000-000000000001','authenticated','authenticated','offer-rpc@local.invalid',crypt('LocalOnly!',gen_salt('bf')),now(),'{}','{}',now(),now())
on conflict(id) do nothing;
select set_config('request.jwt.claim.role','service_role',false);
update public.profiles set role='user' where id='a5200000-0000-4000-8000-000000000001';
insert into public.countries(code,name,region) values('XZ','E2E local','E2E') on conflict(code) do nothing;
insert into public.platforms(id,type,name,slug,status) values
 ('a5200000-0000-4000-8000-000000000010','prop_firm','Offer Platform A','offer-platform-a','active'),
 ('a5200000-0000-4000-8000-000000000011','prop_firm','Offer Platform B','offer-platform-b','active')
on conflict(id) do nothing;
insert into public.challenges(id,platform_id,name,slug,challenge_type,phases,status) values
 ('a5200000-0000-4000-8000-000000000020','a5200000-0000-4000-8000-000000000010','Challenge A','challenge-a','two_step',2,'active'),
 ('a5200000-0000-4000-8000-000000000021','a5200000-0000-4000-8000-000000000011','Challenge B','challenge-b','two_step',2,'active')
on conflict(id) do nothing;
insert into public.affiliate_links(id,platform_id,url,status) values
 ('a5200000-0000-4000-8000-000000000030','a5200000-0000-4000-8000-000000000010','https://local.invalid/a',true),
 ('a5200000-0000-4000-8000-000000000031','a5200000-0000-4000-8000-000000000011','https://local.invalid/b',true)
on conflict(id) do nothing;

select set_config('request.jwt.claim.role','authenticated',false);
select set_config('request.jwt.claim.sub','a5200000-0000-4000-8000-000000000001',false);

do $$
declare
  created record; replayed record; edited record; status_row record; jobs_before bigint; jobs_after bigint; audit_before bigint;
  forced_timestamp timestamptz;
  payload jsonb := jsonb_build_object(
    'platform_id','a5200000-0000-4000-8000-000000000010','challenge_id','a5200000-0000-4000-8000-000000000020',
    'affiliate_link_id','a5200000-0000-4000-8000-000000000030','title','Oferta E2E','description','Descripción',
    'discount_value',20,'discount_type','percentage','promo_code','E2E20','includes_free_account',true,
    'free_account_label','Cuenta E2E','is_featured',true,'hot_badge','Hot','short_highlight','Highlight',
    'country_code','XZ','language','es','starts_at','2026-01-01T00:00:00Z','expires_at','2027-01-01T00:00:00Z',
    'priority',1,'status',true
  );
begin
  select count(*) into jobs_before from public.translation_jobs where resource_type='offer_translation';
  select count(*) into audit_before from public.admin_audit_log where module='offers';

  insert into public.user_permission_overrides(user_id,permission_key,allowed) values
    ('a5200000-0000-4000-8000-000000000001','offers.create',true),
    ('a5200000-0000-4000-8000-000000000001','offers.update',false)
  on conflict(user_id,permission_key) do update set allowed=excluded.allowed;
  select * into created from public.admin_save_offer(null,null,'a5200000-0000-4000-8000-000000000040',payload);
  if created.operation<>'created' or created.current_updated_at is null then raise exception 'Creación autorizada falló'; end if;
  select * into replayed from public.admin_save_offer(null,null,'a5200000-0000-4000-8000-000000000040',payload);
  if replayed.operation<>'replayed' or replayed.offer_id<>created.offer_id then raise exception 'Replay idempotente falló'; end if;
  begin perform public.admin_save_offer(null,null,'a5200000-0000-4000-8000-000000000040',payload||jsonb_build_object('title','Payload distinto')); raise exception 'Token reutilizado con otro payload fue aceptado';
  exception when unique_violation then null; end;
  if (select count(*) from public.translation_field_state where resource_type='offer_translation' and resource_id=created.offer_id::text)<>10 then raise exception 'Trigger editorial no creó estados'; end if;
  insert into public.offers(platform_id,title,discount_value,discount_type,status,priority,updated_at)
  values('a5200000-0000-4000-8000-000000000010','Timestamp protegido',1,'fixed',false,1,'2000-01-01')
  returning updated_at into forced_timestamp;
  if forced_timestamp < now()-interval '1 minute' then raise exception 'updated_at de INSERT fue controlado por el cliente'; end if;

  update public.user_permission_overrides set allowed=false
  where user_id='a5200000-0000-4000-8000-000000000001' and permission_key='offers.create';
  begin perform public.admin_save_offer(null,null,'a5200000-0000-4000-8000-000000000041',payload||jsonb_build_object('promo_code','DENIED')); raise exception 'Creación sin permiso aceptada';
  exception when insufficient_privilege then null; end;

  update public.user_permission_overrides set allowed=(permission_key='offers.update')
  where user_id='a5200000-0000-4000-8000-000000000001';
  select * into edited from public.admin_save_offer(created.offer_id,created.current_updated_at,null,payload||jsonb_build_object('title','Oferta editada'));
  if edited.operation<>'updated' or edited.current_updated_at<=created.current_updated_at then raise exception 'updated_at no avanzó'; end if;
  select * into status_row from public.admin_set_offer_status(edited.offer_id,edited.current_updated_at,false);
  if status_row.status or status_row.current_updated_at<=edited.current_updated_at then raise exception 'Cambio de estado falló'; end if;

  update public.user_permission_overrides set allowed=false where user_id='a5200000-0000-4000-8000-000000000001' and permission_key='offers.update';
  begin perform public.admin_save_offer(status_row.offer_id,status_row.current_updated_at,null,payload); raise exception 'Edición sin permiso aceptada';
  exception when insufficient_privilege then null; end;
  update public.user_permission_overrides set allowed=true where user_id='a5200000-0000-4000-8000-000000000001' and permission_key='offers.update';

  begin perform public.admin_set_offer_status(status_row.offer_id,edited.current_updated_at,true); raise exception 'Snapshot obsoleto aceptado';
  exception when serialization_failure then null; end;
  begin perform public.admin_save_offer(status_row.offer_id,status_row.current_updated_at,null,payload||jsonb_build_object('challenge_id','a5200000-0000-4000-8000-000000000021')); raise exception 'Challenge cruzado aceptado';
  exception when foreign_key_violation then null; end;
  begin perform public.admin_save_offer(status_row.offer_id,status_row.current_updated_at,null,payload||jsonb_build_object('affiliate_link_id','a5200000-0000-4000-8000-000000000031')); raise exception 'Afiliado cruzado aceptado';
  exception when foreign_key_violation then null; end;
  begin perform public.admin_save_offer(status_row.offer_id,status_row.current_updated_at,null,payload||jsonb_build_object('unexpected','x')); raise exception 'Mass assignment aceptado';
  exception when invalid_parameter_value then null; end;
  begin perform public.admin_save_offer(status_row.offer_id,status_row.current_updated_at,null,payload||jsonb_build_object('discount_value',101)); raise exception 'Descuento inválido aceptado';
  exception when invalid_parameter_value then null; end;
  begin perform public.admin_save_offer(status_row.offer_id,status_row.current_updated_at,null,payload||jsonb_build_object('starts_at','2028-01-01T00:00:00Z','expires_at','2027-01-01T00:00:00Z')); raise exception 'Fechas inválidas aceptadas';
  exception when invalid_parameter_value then null; end;
  begin perform public.admin_save_offer(status_row.offer_id,status_row.current_updated_at,null,payload||jsonb_build_object('starts_at','infinity')); raise exception 'Infinity aceptado';
  exception when invalid_parameter_value then null; end;
  begin perform public.admin_save_offer(status_row.offer_id,status_row.current_updated_at,null,payload||jsonb_build_object('expires_at','-infinity')); raise exception '-Infinity aceptado';
  exception when invalid_parameter_value then null; end;

  create function pg_temp.reject_offer_audit() returns trigger language plpgsql as $f$ begin raise exception 'late failure'; end $f$;
  create trigger reject_offer_audit before insert on public.admin_audit_log for each row execute function pg_temp.reject_offer_audit();
  update public.user_permission_overrides set allowed=true
  where user_id='a5200000-0000-4000-8000-000000000001' and permission_key='offers.create';
  begin perform public.admin_save_offer(null,null,'a5200000-0000-4000-8000-000000000042',payload||jsonb_build_object('promo_code','ROLLBACK')); exception when others then null; end;
  drop trigger reject_offer_audit on public.admin_audit_log;
  if exists(select 1 from public.offers where promo_code='ROLLBACK') then raise exception 'Rollback tardío incompleto'; end if;

  select count(*) into jobs_after from public.translation_jobs where resource_type='offer_translation';
  if jobs_after<>jobs_before then raise exception 'Se crearon jobs automáticos'; end if;
  if (select count(*) from public.admin_audit_log where module='offers') < audit_before+3 then raise exception 'Auditoría incompleta'; end if;
end $$;

-- ACL real: no basta con cambiar claims mientras la sesión sigue como
-- supabase_admin. Las llamadas siguientes usan los roles SQL de la API.
do $$ begin
  if has_table_privilege('authenticated','public.offers','INSERT')
     or has_table_privilege('authenticated','public.offers','UPDATE')
     or has_table_privilege('authenticated','public.offers','DELETE') then
    raise exception 'authenticated conserva DML directo sobre offers';
  end if;
  if not has_table_privilege('authenticated','public.offers','SELECT') then
    raise exception 'authenticated perdió SELECT sobre offers';
  end if;
end $$;
create temp table offer_role_fixture as
select id,updated_at from public.offers where promo_code='E2E20';
grant select on offer_role_fixture to authenticated;
set local role authenticated;
do $$ begin
  begin
    insert into public.offers(platform_id,title,discount_value,discount_type,status,priority)
    values('a5200000-0000-4000-8000-000000000010','DML directo',1,'fixed',false,1);
    raise exception 'authenticated pudo insertar directamente';
  exception when insufficient_privilege then null; end;
  begin
    update public.offers set title='DML directo' where id=(select id from offer_role_fixture);
    raise exception 'authenticated pudo actualizar directamente';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.offers where id=(select id from offer_role_fixture);
    raise exception 'authenticated pudo eliminar directamente';
  exception when insufficient_privilege then null; end;
end $$;
select * from public.admin_set_offer_status(
  (select id from offer_role_fixture),
  (select updated_at from offer_role_fixture),true
);
reset role;
update offer_role_fixture f set updated_at=o.updated_at
from public.offers o where o.id=f.id;

set local role anon;
do $$ begin
  perform public.admin_set_offer_status(null,null,true);
  raise exception 'anon pudo ejecutar la RPC';
exception when insufficient_privilege then null; end $$;
reset role;

set local role service_role;
do $$ begin
  perform public.admin_set_offer_status(null,null,true);
  raise exception 'service_role pudo ejecutar la RPC';
exception when insufficient_privilege then null; end $$;
reset role;

-- offers.update es obligatorio también para admin_set_offer_status.
update public.user_permission_overrides set allowed=false
where user_id='a5200000-0000-4000-8000-000000000001' and permission_key='offers.update';
set local role authenticated;
do $$ begin
  perform public.admin_set_offer_status(
    (select id from offer_role_fixture),
    (select updated_at from offer_role_fixture),false
  );
  raise exception 'Cambio de estado sin offers.update aceptado';
exception when insufficient_privilege then null; end $$;
reset role;

-- Las eliminaciones conservan offers.platform_id: solo anulan la referencia
-- opcional. Eliminar la plataforma mantiene el CASCADE histórico de offers.
do $$
declare offer_platform uuid;
begin
  delete from public.affiliate_links where id='a5200000-0000-4000-8000-000000000030';
  select platform_id into offer_platform from public.offers where id=(select id from offer_role_fixture);
  if offer_platform<>'a5200000-0000-4000-8000-000000000010'
     or (select affiliate_link_id from public.offers where id=(select id from offer_role_fixture)) is not null then
    raise exception 'ON DELETE del enlace no preservó platform_id';
  end if;
  delete from public.challenges where id='a5200000-0000-4000-8000-000000000020';
  if (select platform_id from public.offers where id=(select id from offer_role_fixture))<>'a5200000-0000-4000-8000-000000000010'
     or (select challenge_id from public.offers where id=(select id from offer_role_fixture)) is not null then
    raise exception 'ON DELETE del challenge no preservó platform_id';
  end if;
  delete from public.platforms where id='a5200000-0000-4000-8000-000000000010';
  if exists(select 1 from public.offers where id=(select id from offer_role_fixture)) then
    raise exception 'ON DELETE CASCADE de plataforma dejó la oferta';
  end if;
end $$;

select 'PASS' as result;
rollback;

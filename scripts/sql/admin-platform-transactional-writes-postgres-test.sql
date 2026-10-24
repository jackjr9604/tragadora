\set ON_ERROR_STOP on
begin; set role supabase_admin;
do $$ begin if to_regclass('public.tradagora_local_e2e_guard') is null then raise exception 'Solo E2E local'; end if; end $$;
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values('a5100000-0000-4000-8000-000000000001','authenticated','authenticated','platform-rpc@local.invalid',crypt('LocalOnly!',gen_salt('bf')),now(),'{}','{}',now(),now()) on conflict(id) do nothing;
select set_config('request.jwt.claim.role','service_role',false);
update public.profiles set role='user' where id='a5100000-0000-4000-8000-000000000001';
insert into public.countries values('XZ','E2E local','E2E',null) on conflict do nothing;
insert into public.trading_platforms(id,name,slug) values('a5100000-0000-4000-8000-000000000010','E2E Terminal','e2e-terminal') on conflict do nothing;
select set_config('request.jwt.claim.role','authenticated',false); select set_config('request.jwt.claim.sub','a5100000-0000-4000-8000-000000000001',false);
do $$ declare bid uuid; ver timestamptz; jobs bigint; begin
 insert into public.user_permission_overrides(user_id,permission_key,allowed) values
 ('a5100000-0000-4000-8000-000000000001','platforms.create',true),('a5100000-0000-4000-8000-000000000001','platforms.update',false),('a5100000-0000-4000-8000-000000000001','platforms.delete',false)
 on conflict(user_id,permission_key) do update set allowed=excluded.allowed;
 select platform_id,current_updated_at into bid,ver from public.admin_save_broker(null,null,'Broker E2E','broker-e2e-atomic','Fuente',null,null,'draft','XZ',2020,100,'USD',null,null,false,10,array['cfd'],array['a5100000-0000-4000-8000-000000000010']::uuid[]);
 if (select count(*) from public.platform_markets where platform_id=bid)<>1 then raise exception 'Relaciones incompletas'; end if;
 begin perform public.admin_save_broker(bid,ver,'x','x','x',null,null,'draft',null,null,null,null,null,null,false,1,array[]::text[],array[]::uuid[]); raise exception 'Update sin permiso'; exception when insufficient_privilege then null; end;
 update public.user_permission_overrides set allowed=(permission_key='platforms.update') where user_id='a5100000-0000-4000-8000-000000000001';
 select current_updated_at into ver from public.admin_save_broker(bid,ver,'Broker editado','broker-e2e-edited','Fuente',null,null,'active','XZ',2021,200,'USD',null,null,true,20,array['crypto'],array[]::uuid[]);
 if exists(select 1 from public.platform_trading_platforms where platform_id=bid) or not exists(select 1 from public.platform_markets where platform_id=bid and market='crypto') then raise exception 'Reemplazo no atómico'; end if;
 begin perform public.admin_save_broker(bid,ver-interval '1 second','x','stale-write','x',null,null,'draft',null,null,null,null,null,null,false,1,array[]::text[],array[]::uuid[]); raise exception 'Snapshot obsoleto'; exception when serialization_failure then null; end;
 create function pg_temp.reject_e2e() returns trigger language plpgsql as $f$ begin raise exception 'late failure'; end $f$; create trigger reject_e2e before insert on public.broker_details for each row execute function pg_temp.reject_e2e();
 update public.user_permission_overrides set allowed=(permission_key='platforms.create') where user_id='a5100000-0000-4000-8000-000000000001';
 begin perform public.admin_save_broker(null,null,'Rollback','rollback-e2e','x',null,null,'draft',null,null,null,null,null,null,false,1,array[]::text[],array[]::uuid[]); exception when others then null; end; drop trigger reject_e2e on public.broker_details;
 if exists(select 1 from public.platforms where slug='rollback-e2e') then raise exception 'Rollback incompleto'; end if;
 select count(*) into jobs from public.translation_jobs;
 update public.user_permission_overrides set allowed=(permission_key='platforms.delete') where user_id='a5100000-0000-4000-8000-000000000001';
 insert into public.affiliate_links(platform_id,url) values(bid,'https://local.invalid');
 begin perform public.admin_delete_platform(bid,'broker','broker-e2e-edited',ver); raise exception 'Dependencia no bloqueada'; exception when foreign_key_violation then null; end;
 delete from public.affiliate_links where platform_id=bid; perform public.admin_delete_platform(bid,'broker','broker-e2e-edited',ver);
 if (select count(*) from public.translation_jobs)<>jobs then raise exception 'Jobs automáticos'; end if;
end $$;
do $$ declare s text; begin foreach s in array array['public.admin_delete_platform(uuid,public.platform_type,text,timestamptz)'] loop if not has_function_privilege('authenticated',s,'EXECUTE') or has_function_privilege('anon',s,'EXECUTE') or has_function_privilege('service_role',s,'EXECUTE') then raise exception 'Grants inválidos'; end if; end loop; end $$;
select 'PASS' result; rollback;

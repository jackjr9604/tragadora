\set ON_ERROR_STOP on
\if :{?DBNAME}
\else
  \echo 'DBNAME es obligatorio'
  \quit 1
\endif

do $$ begin
  if to_regclass('public.tradagora_local_e2e_guard') is null then
    raise exception 'Solo E2E local';
  end if;
end $$;

create extension if not exists dblink;

begin;
set role supabase_admin;
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('a5210000-0000-4000-8000-000000000001','authenticated','authenticated','offer-concurrency@local.invalid',crypt('LocalOnly!',gen_salt('bf')),now(),'{}','{}',now(),now())
on conflict(id) do nothing;
select set_config('request.jwt.claim.role','service_role',false);
update public.profiles set role='user' where id='a5210000-0000-4000-8000-000000000001';
insert into public.user_permission_overrides(user_id,permission_key,allowed) values
('a5210000-0000-4000-8000-000000000001','offers.create',true),
('a5210000-0000-4000-8000-000000000001','offers.update',true)
on conflict(user_id,permission_key) do update set allowed=excluded.allowed;
insert into public.countries(code,name,region) values('XY','Concurrency local','E2E') on conflict(code) do nothing;
insert into public.languages(code,name,native_name,is_active,is_default,sort_order,publication_status,ui_catalog_available,seo_ready)
values('xy','Concurrency local','Concurrency local',true,false,999,'draft',false,false)
on conflict(code) do update set is_active=true,is_default=false,publication_status='draft',ui_catalog_available=false,seo_ready=false;
insert into public.platforms(id,type,name,slug,status) values
('a5210000-0000-4000-8000-000000000010','prop_firm','Concurrency A','offer-concurrency-a','active'),
('a5210000-0000-4000-8000-000000000011','prop_firm','Concurrency B','offer-concurrency-b','active')
on conflict(id) do nothing;
insert into public.challenges(id,platform_id,name,slug,challenge_type,phases,status) values
('a5210000-0000-4000-8000-000000000020','a5210000-0000-4000-8000-000000000010','Concurrency challenge','offer-concurrency-challenge','two_step',2,'active')
on conflict(id) do nothing;
insert into public.affiliate_links(id,platform_id,url,status) values
('a5210000-0000-4000-8000-000000000030','a5210000-0000-4000-8000-000000000010','https://local.invalid/concurrency',true)
on conflict(id) do nothing;
insert into public.offers(id,platform_id,challenge_id,affiliate_link_id,title,discount_value,discount_type,status,priority,country_code,language)
values('a5210000-0000-4000-8000-000000000040','a5210000-0000-4000-8000-000000000010',null,null,'Concurrency offer',10,'percentage',false,1,'XY','xy')
on conflict(id) do nothing;
commit;

\if :{?E2E_FORCE_FAILURE}
  \echo 'E2E_FORCE_FAILURE: fallo deliberado después de crear fixtures'
  select 1/0;
\endif

create table public.offer_concurrency_results(test text,connection text,result text);

create or replace function public.e2e_offer_save_hold(p_suffix text,p_hold_seconds numeric default 1)
returns text language plpgsql set search_path=pg_catalog,public as $$
declare o public.offers%rowtype;
begin
  select * into o from public.offers where id='a5210000-0000-4000-8000-000000000040';
  perform public.admin_save_offer(o.id,o.updated_at,null,jsonb_build_object(
    'platform_id',o.platform_id,'challenge_id',o.challenge_id,'affiliate_link_id',o.affiliate_link_id,
    'title','Concurrency offer '||p_suffix,'description',o.description,'discount_value',o.discount_value,
    'discount_type',o.discount_type,'promo_code',o.promo_code,'includes_free_account',o.includes_free_account,
    'free_account_label',o.free_account_label,'is_featured',o.is_featured,'hot_badge',o.hot_badge,
    'short_highlight',o.short_highlight,'country_code',o.country_code,'language',o.language,
    'starts_at',o.starts_at,'expires_at',o.expires_at,'priority',o.priority,'status',o.status));
  -- Señal de sesión visible inmediatamente para que el coordinador sepa que
  -- admin_save_offer terminó y sus locks siguen retenidos antes de lanzar B.
  perform pg_advisory_lock(95210001);
  perform pg_sleep(p_hold_seconds);
  perform pg_advisory_unlock(95210001);
  return 'saved';
exception when serialization_failure then
  perform pg_advisory_unlock_all();
  return 'conflict';
end $$;

create or replace function public.e2e_offer_relation_mutation(p_kind text)
returns text language plpgsql set search_path=pg_catalog,public as $$
declare
  rejected_constraint_name text;
  expected_constraint_name text;
begin
  case p_kind
    when 'platform_type' then update public.platforms set type='broker' where id='a5210000-0000-4000-8000-000000000010';
    when 'challenge_platform' then update public.challenges set platform_id='a5210000-0000-4000-8000-000000000011' where id='a5210000-0000-4000-8000-000000000020';
    when 'affiliate_platform' then update public.affiliate_links set platform_id='a5210000-0000-4000-8000-000000000011' where id='a5210000-0000-4000-8000-000000000030';
    when 'language_active' then update public.languages set is_active=false where code='xy';
    when 'country_delete' then delete from public.countries where code='XY';
    when 'unrelated_check' then
      raise exception 'CHECK sintético no relacionado'
        using errcode='23514',constraint='unrelated_offer_check';
    else raise exception 'Mutación desconocida';
  end case;
  return 'committed';
exception
  when foreign_key_violation then
    get stacked diagnostics rejected_constraint_name=constraint_name;
    expected_constraint_name := case p_kind
      when 'challenge_platform' then 'offers_challenge_platform_fkey'
      when 'affiliate_platform' then 'offers_affiliate_link_platform_fkey'
      else null end;
    if expected_constraint_name is null or rejected_constraint_name is distinct from expected_constraint_name then
      raise exception 'Constraint inesperada para %: %',p_kind,coalesce(rejected_constraint_name,'<sin nombre>');
    end if;
    return 'rejected_constraint:'||rejected_constraint_name;
end $$;

create or replace function public.e2e_offer_create_hold(p_suffix text,p_hold_seconds numeric default 1)
returns text language plpgsql set search_path=pg_catalog,public as $$
begin
  perform public.admin_save_offer(null,null,
    case p_suffix
      when 'platform_type' then 'a5210000-0000-4000-8000-000000000051'::uuid
      when 'challenge_platform' then 'a5210000-0000-4000-8000-000000000052'::uuid
      when 'affiliate_platform' then 'a5210000-0000-4000-8000-000000000053'::uuid
      when 'language_active' then 'a5210000-0000-4000-8000-000000000054'::uuid
      when 'country_delete' then 'a5210000-0000-4000-8000-000000000055'::uuid
    end,
    jsonb_build_object(
    'platform_id','a5210000-0000-4000-8000-000000000010',
    'challenge_id',case when p_suffix='challenge_platform' then 'a5210000-0000-4000-8000-000000000020' end,
    'affiliate_link_id',case when p_suffix='affiliate_platform' then 'a5210000-0000-4000-8000-000000000030' end,
    'title','Concurrency create '||p_suffix,'description','Local concurrency fixture',
    'discount_value',10,'discount_type','percentage','promo_code','RACE_'||upper(p_suffix),
    'includes_free_account',false,'is_featured',false,
    'country_code',case when p_suffix='country_delete' then 'XY' end,
    'language',case when p_suffix='language_active' then 'xy' end,
    'priority',1,'status',false));
  perform pg_advisory_lock(95210001);
  perform pg_sleep(p_hold_seconds);
  perform pg_advisory_unlock(95210001);
  return 'saved';
exception when others then
  perform pg_advisory_unlock_all();
  raise;
end $$;

create or replace function public.e2e_wait_for_backend_lock(
  p_backend_pid integer,
  p_timeout_seconds numeric default 10
) returns text language plpgsql set search_path=pg_catalog,public as $$
declare deadline timestamptz := clock_timestamp() + make_interval(secs => p_timeout_seconds);
begin
  loop
    if exists(
      select 1 from pg_locks
      where pid=p_backend_pid and locktype='advisory' and granted
    ) then return 'save_completed_with_locks_held'; end if;
    if clock_timestamp() >= deadline then raise exception 'No se observó la señal posterior a admin_save_offer para PID %',p_backend_pid; end if;
    perform pg_sleep(.02);
  end loop;
end $$;

create or replace function public.e2e_wait_for_backend_waiting(
  p_backend_pid integer,
  p_timeout_seconds numeric default 10
) returns text language plpgsql set search_path=pg_catalog,public as $$
declare deadline timestamptz := clock_timestamp() + make_interval(secs => p_timeout_seconds);
begin
  loop
    if exists(select 1 from pg_stat_activity where pid=p_backend_pid and wait_event_type='Lock') then
      return 'waiting';
    end if;
    if clock_timestamp() >= deadline then raise exception 'PID % no quedó esperando un lock',p_backend_pid; end if;
    perform pg_sleep(.02);
  end loop;
end $$;

select dblink_connect('offer_a','host=127.0.0.1 port=5432 dbname='||current_database()||' user=supabase_admin');
select dblink_connect('offer_b','host=127.0.0.1 port=5432 dbname='||current_database()||' user=supabase_admin');
select dblink_exec('offer_a',$q$set request.jwt.claim.sub='a5210000-0000-4000-8000-000000000001'; set request.jwt.claim.role='authenticated'$q$);
select dblink_exec('offer_b',$q$set request.jwt.claim.sub='a5210000-0000-4000-8000-000000000001'; set request.jwt.claim.role='authenticated'$q$);
\if :{?E2E_FORCE_TIMEOUT}
select dblink_exec('offer_a',$q$set statement_timeout='100ms'$q$);
select dblink_exec('offer_b',$q$set statement_timeout='100ms'$q$);
\else
select dblink_exec('offer_a',$q$set statement_timeout='15s'$q$);
select dblink_exec('offer_b',$q$set statement_timeout='15s'$q$);
\endif
select pid as offer_a_pid from dblink('offer_a','select pg_backend_pid()') as t(pid integer) \gset
select pid as offer_b_pid from dblink('offer_b','select pg_backend_pid()') as t(pid integer) \gset

-- Dos snapshots reales sobre la misma oferta: solo uno puede confirmar. A se
-- observa con el lock de offers antes de lanzar B; no se coordina con sleeps.
select dblink_send_query('offer_a',$q$select public.e2e_offer_save_hold('A',1)$q$);
select public.e2e_wait_for_backend_lock(
  :offer_a_pid
);
select dblink_send_query('offer_b',$q$select public.e2e_offer_save_hold('B',0)$q$);
select public.e2e_wait_for_backend_waiting(
  :offer_b_pid
);
insert into public.offer_concurrency_results select 'same_offer','a',result from dblink_get_result('offer_a') as t(result text);
insert into public.offer_concurrency_results select 'same_offer','b',result from dblink_get_result('offer_b') as t(result text);
select dblink_disconnect('offer_a');
select dblink_disconnect('offer_b');

-- Dos solicitudes de creación con la misma identidad producen una sola fila.
create or replace function public.e2e_offer_idempotent_create(p_hold_seconds numeric default 1)
returns text language plpgsql set search_path=pg_catalog,public as $$
declare saved record;
begin
  select * into saved from public.admin_save_offer(
    null,null,'a5210000-0000-4000-8000-000000000056',
    jsonb_build_object(
      'platform_id','a5210000-0000-4000-8000-000000000010','title','Idempotent concurrent create',
      'description','Local concurrency fixture','discount_value',10,'discount_type','percentage',
      'promo_code','IDEMPOTENT_RACE','includes_free_account',false,'is_featured',false,
      'priority',1,'status',false));
  perform pg_advisory_lock(95210002);
  perform pg_sleep(p_hold_seconds);
  perform pg_advisory_unlock(95210002);
  return saved.operation||':'||saved.offer_id::text;
exception when others then
  perform pg_advisory_unlock_all();
  raise;
end $$;

select dblink_connect('offer_a','host=127.0.0.1 port=5432 dbname='||current_database()||' user=supabase_admin');
select dblink_connect('offer_b','host=127.0.0.1 port=5432 dbname='||current_database()||' user=supabase_admin');
select dblink_exec('offer_a',$q$set request.jwt.claim.sub='a5210000-0000-4000-8000-000000000001'; set request.jwt.claim.role='authenticated'; set statement_timeout='15s'$q$);
select dblink_exec('offer_b',$q$set request.jwt.claim.sub='a5210000-0000-4000-8000-000000000001'; set request.jwt.claim.role='authenticated'; set statement_timeout='15s'$q$);
select pid as offer_a_pid from dblink('offer_a','select pg_backend_pid()') as t(pid integer) \gset
select pid as offer_b_pid from dblink('offer_b','select pg_backend_pid()') as t(pid integer) \gset
select dblink_send_query('offer_a',$q$select public.e2e_offer_idempotent_create(1)$q$);
select public.e2e_wait_for_backend_lock(:offer_a_pid);
select dblink_send_query('offer_b',$q$select public.e2e_offer_idempotent_create(0)$q$);
select public.e2e_wait_for_backend_waiting(:offer_b_pid);
insert into public.offer_concurrency_results select 'idempotent_create','a',result from dblink_get_result('offer_a') as t(result text);
insert into public.offer_concurrency_results select 'idempotent_create','b',result from dblink_get_result('offer_b') as t(result text);
select dblink_disconnect('offer_a');
select dblink_disconnect('offer_b');
select dblink_connect('offer_a','host=127.0.0.1 port=5432 dbname='||current_database()||' user=supabase_admin');
select dblink_exec('offer_a',$q$set request.jwt.claim.sub='a5210000-0000-4000-8000-000000000001'; set request.jwt.claim.role='authenticated'; set statement_timeout='15s'$q$);
insert into public.offer_concurrency_results
select 'idempotent_retry','authenticated',result
from dblink('offer_a',$q$select public.e2e_offer_idempotent_create(0)$q$) as t(result text);
select dblink_disconnect('offer_a');

-- Cada carrera se invoca en una sentencia/transacción coordinadora separada.
-- Así los locks y snapshots del coordinador anterior no contaminan la siguiente.
create or replace function public.e2e_run_offer_relation_race(kind text,p_expect_wait boolean)
returns void language plpgsql set search_path=pg_catalog,public as $outer$
declare
  pid_a integer;
  pid_b integer;
begin
  perform dblink_connect('offer_a','host=127.0.0.1 port=5432 dbname='||current_database()||' user=supabase_admin');
  perform dblink_connect('offer_b','host=127.0.0.1 port=5432 dbname='||current_database()||' user=supabase_admin');
  perform dblink_exec('offer_a',$q$set request.jwt.claim.sub='a5210000-0000-4000-8000-000000000001'; set request.jwt.claim.role='authenticated'$q$);
  perform dblink_exec('offer_b',$q$set request.jwt.claim.sub='a5210000-0000-4000-8000-000000000001'; set request.jwt.claim.role='authenticated'$q$);
  perform dblink_exec('offer_a',$q$set statement_timeout='15s'$q$);
  perform dblink_exec('offer_b',$q$set statement_timeout='15s'$q$);
  select pid into pid_a from dblink('offer_a','select pg_backend_pid()') as t(pid integer);
  select pid into pid_b from dblink('offer_b','select pg_backend_pid()') as t(pid integer);
  perform dblink_send_query('offer_a',format('select public.e2e_offer_create_hold(%L,3)',kind));
  perform public.e2e_wait_for_backend_lock(pid_a);
  perform dblink_send_query('offer_b',format('select public.e2e_offer_relation_mutation(%L)',kind));
  if p_expect_wait then
    begin
      perform public.e2e_wait_for_backend_waiting(pid_b);
    exception when others then
      raise exception 'La carrera % no observó espera de B: %',kind,sqlerrm;
    end;
    insert into public.offer_concurrency_results values(kind,'coordination','waiting');
  else
    insert into public.offer_concurrency_results values(kind,'coordination','non_structural');
  end if;
  insert into public.offer_concurrency_results select kind,'a',result from dblink_get_result('offer_a') as t(result text);
  insert into public.offer_concurrency_results select kind,'b',result from dblink_get_result('offer_b') as t(result text);
  perform dblink_disconnect('offer_a');
  perform dblink_disconnect('offer_b');
exception when others then
  begin perform dblink_disconnect('offer_a'); exception when others then null; end;
  begin perform dblink_disconnect('offer_b'); exception when others then null; end;
  raise;
end $outer$;

select public.e2e_run_offer_relation_race('affiliate_platform',true);
select public.e2e_run_offer_relation_race('challenge_platform',true);
select public.e2e_run_offer_relation_race('platform_type',false);
select public.e2e_run_offer_relation_race('language_active',false);
select public.e2e_run_offer_relation_race('country_delete',false);

-- Un CHECK ajeno debe propagarse como error y nunca convertirse en el PASS
-- reservado para las dos FK compuestas exactas.
do $$
declare observed_constraint_name text;
begin
  begin
    perform public.e2e_offer_relation_mutation('unrelated_check');
    raise exception 'CHECK ajeno fue aceptado como rechazo estructural';
  exception when check_violation then
    get stacked diagnostics observed_constraint_name=constraint_name;
    if observed_constraint_name is distinct from 'unrelated_offer_check' then
      raise;
    end if;
  end;
end $$;

do $$ begin
  if (select count(*) from public.offer_concurrency_results where test='same_offer' and result='saved')<>1
     or (select count(*) from public.offer_concurrency_results where test='same_offer' and result='conflict')<>1 then
    raise exception 'Concurrencia optimista no produjo saved/conflict';
  end if;
  if (select count(*) from public.offer_concurrency_results where test='idempotent_create' and result like 'created:%')<>1
     or (select count(*) from public.offer_concurrency_results where test='idempotent_create' and result like 'replayed:%')<>1
     or (select count(*) from public.offer_concurrency_results where test='idempotent_retry' and result like 'replayed:%')<>1
     or (select count(*) from public.offer_admin_creation_requests where request_id='a5210000-0000-4000-8000-000000000056')<>1
     or (select count(*) from public.offers where promo_code='IDEMPOTENT_RACE')<>1
     or (select count(*) from public.admin_audit_log where action='offer.created'
       and new_value->>'id'=(select offer_id::text from public.offer_admin_creation_requests where request_id='a5210000-0000-4000-8000-000000000056'))<>1 then
    raise exception 'Creación idempotente concurrente produjo un resultado inesperado';
  end if;
  if exists(select 1 from public.offer_concurrency_results where test in ('challenge_platform','affiliate_platform') and connection='coordination' and result<>'waiting')
     or exists(select 1 from public.offer_concurrency_results where test in ('platform_type','language_active','country_delete') and connection='coordination' and result<>'non_structural')
     or exists(select 1 from public.offer_concurrency_results where test not in ('same_offer','idempotent_create') and connection='a' and result<>'saved')
     or exists(select 1 from public.offer_concurrency_results where test='challenge_platform' and connection='b' and result<>'rejected_constraint:offers_challenge_platform_fkey')
     or exists(select 1 from public.offer_concurrency_results where test='affiliate_platform' and connection='b' and result<>'rejected_constraint:offers_affiliate_link_platform_fkey')
     or exists(select 1 from public.offer_concurrency_results where test in ('platform_type','language_active','country_delete') and connection='b' and result<>'committed') then
    raise exception 'Resultado relacional concurrente inesperado: %',(select jsonb_agg(r) from public.offer_concurrency_results r where test<>'same_offer');
  end if;
  if (select type from public.platforms where id='a5210000-0000-4000-8000-000000000010')<>'broker'
     or (select platform_id from public.challenges where id='a5210000-0000-4000-8000-000000000020')<>'a5210000-0000-4000-8000-000000000010'
     or (select platform_id from public.affiliate_links where id='a5210000-0000-4000-8000-000000000030')<>'a5210000-0000-4000-8000-000000000010'
     or (select is_active from public.languages where code='xy')
     or exists(select 1 from public.countries where code='XY') then
    raise exception 'Estado relacional inconsistente tras carreras';
  end if;
end $$;

table public.offer_concurrency_results;

begin;
delete from public.translation_field_state
where resource_type='offer_translation'
  and resource_id in (
    select id::text from public.offers
    where promo_code like 'RACE\_%' escape '\' or promo_code='IDEMPOTENT_RACE'
  );
delete from public.offers where promo_code like 'RACE\_%' escape '\' or promo_code='IDEMPOTENT_RACE';
delete from public.offers where id='a5210000-0000-4000-8000-000000000040';
delete from public.translation_field_state where resource_type='offer_translation' and resource_id='a5210000-0000-4000-8000-000000000040';
delete from public.affiliate_links where id='a5210000-0000-4000-8000-000000000030';
delete from public.challenges where id='a5210000-0000-4000-8000-000000000020';
delete from public.platforms where id in ('a5210000-0000-4000-8000-000000000010','a5210000-0000-4000-8000-000000000011');
delete from public.countries where code='XY';
delete from public.languages where code='xy';
delete from public.admin_audit_log where actor_user_id='a5210000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.role','service_role',false);
delete from auth.users where id='a5210000-0000-4000-8000-000000000001';
drop function public.e2e_offer_save_hold(text,numeric);
drop function public.e2e_offer_idempotent_create(numeric);
drop function public.e2e_offer_create_hold(text,numeric);
drop function public.e2e_offer_relation_mutation(text);
drop function public.e2e_wait_for_backend_lock(integer,numeric);
drop function public.e2e_wait_for_backend_waiting(integer,numeric);
drop function public.e2e_run_offer_relation_race(text,boolean);
drop table public.offer_concurrency_results;
commit;

select 'PASS' as result;

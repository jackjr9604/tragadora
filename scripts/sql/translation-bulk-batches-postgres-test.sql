\set ON_ERROR_STOP on

select set_config('app.test_role','authenticated',false);
select set_config('app.test_user_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
select set_config('app.test_permissions','blog.view,blog.update',false);

do $$
declare selection jsonb; preview jsonb; batch_one uuid; batch_two uuid;
begin
  select jsonb_agg(jsonb_build_object('state_id',id,'expected_lock_version',lock_version) order by field_name,target_language)
    into selection from (select id,lock_version,field_name,target_language from public.translation_field_state
      where resource_type='blog_post_translation' order by field_name,target_language limit 4) selected;
  preview:=public.translation_admin_bulk_preview(selection,1,2,20,100000);
  if (preview->>'selection_count')::integer<>4 or jsonb_array_length(preview->'items')<>2
     or (preview->>'pages')::integer<>2 then raise exception 'Preview o paginacion incorrecta: %',preview; end if;
  batch_one:=public.translation_admin_create_batch('11111111-1111-4111-8111-111111111111',selection,20,100000);
  batch_two:=public.translation_admin_create_batch('11111111-1111-4111-8111-111111111111',selection,20,100000);
  if batch_one<>batch_two or (select count(*) from public.translation_batches where id=batch_one)<>1
     or (select count(*) from public.translation_batch_items where batch_id=batch_one)<>4 then
    raise exception 'Creacion idempotente incorrecta';
  end if;
  if exists(select 1 from public.translation_jobs where metadata->>'batch_id'=batch_one::text) then
    raise exception '3E.8.4A creo jobs';
  end if;
  if exists(select 1 from public.translation_batch_items where batch_id=batch_one
    and (source_hash is null or source_revision<1 or state_lock_version<1)) then
    raise exception 'Snapshot tecnico incompleto';
  end if;
end $$;

-- Seleccion obsoleta y proteccion editorial quedan excluidas, no se ignoran.
do $$
declare s public.translation_field_state%rowtype; selection jsonb; preview jsonb; active_job public.translation_jobs; v_batch_id uuid;
begin
  select * into s from public.translation_field_state where resource_type='blog_post_translation'
    and target_language='pt' order by field_name limit 1;
  active_job:=public.translation_request_ai_draft(s.id,s.lock_version,12,3,100,1000000,false);
  update public.translation_field_state set is_protected=true,protection_reason='manual' where id=s.id;
  selection:=jsonb_build_array(jsonb_build_object('state_id',s.id,'expected_lock_version',s.lock_version));
  preview:=public.translation_admin_bulk_preview(selection,1,50,20,100000);
  if preview#>>'{items,0,reason}'<>'protected' then raise exception 'Proteccion no detectada'; end if;
  v_batch_id:=public.translation_admin_create_batch('33333333-3333-4333-8333-333333333333',selection,20,100000);
  if (select b.reused_count from public.translation_batches b where b.id=v_batch_id)<>0
     or exists(select 1 from public.translation_batch_items i where i.batch_id=v_batch_id and i.job_id is not null) then
    raise exception 'Un job activo de contenido excluido fue contado como reutilizable';
  end if;
  update public.translation_field_state set is_protected=false,protection_reason=null,lock_version=lock_version+1 where id=s.id;
  preview:=public.translation_admin_bulk_preview(selection,1,50,20,100000);
  if preview#>>'{items,0,reason}'<>'stale_selection' then raise exception 'Seleccion obsoleta no detectada'; end if;
end $$;

-- Permisos por recurso se validan en cada elemento.
select set_config('app.test_permissions','blog.view',false);
do $$
declare s public.translation_field_state%rowtype; selection jsonb;
begin
  select * into s from public.translation_field_state where resource_type='blog_post_translation' limit 1;
  selection:=jsonb_build_array(jsonb_build_object('state_id',s.id,'expected_lock_version',s.lock_version));
  begin
    perform public.translation_admin_bulk_preview(selection,1,50,20,100000);
    raise exception 'Usuario sin update obtuvo preview';
  exception when insufficient_privilege then null;
  end;
end $$;
select set_config('app.test_permissions','blog.view,blog.update',false);

-- Entradas vacias, duplicadas o excesivas se rechazan.
do $$
declare s public.translation_field_state%rowtype; duplicate_selection jsonb;
begin
  begin perform public.translation_admin_bulk_preview('[]'::jsonb,1,50,20,100000);
    raise exception 'Seleccion vacia aceptada'; exception when invalid_parameter_value then null; end;
  select * into s from public.translation_field_state where resource_type='blog_post_translation' limit 1;
  duplicate_selection:=jsonb_build_array(
    jsonb_build_object('state_id',s.id,'expected_lock_version',s.lock_version),
    jsonb_build_object('state_id',s.id,'expected_lock_version',s.lock_version));
  begin perform public.translation_admin_bulk_preview(duplicate_selection,1,50,20,100000);
    raise exception 'Duplicados aceptados'; exception when invalid_parameter_value then null; end;
end $$;

-- RLS y privilegios: tablas cerradas, RPC solo para authenticated.
do $$
begin
  if has_table_privilege('authenticated','public.translation_batches','SELECT')
     or has_table_privilege('authenticated','public.translation_batch_items','SELECT') then
    raise exception 'Tablas de lotes expuestas';
  end if;
  if has_function_privilege('anon','public.translation_admin_bulk_preview(jsonb,integer,integer,integer,integer)','EXECUTE')
     or has_function_privilege('service_role','public.translation_admin_create_batch(uuid,jsonb,integer,integer)','EXECUTE') then
    raise exception 'RPC expuesta a rol incorrecto';
  end if;
  if not has_function_privilege('authenticated','public.translation_admin_bulk_preview(jsonb,integer,integer,integer,integer)','EXECUTE')
     or not has_function_privilege('authenticated','public.translation_admin_create_batch(uuid,jsonb,integer,integer)','EXECUTE') then
    raise exception 'RPC no disponible para authenticated';
  end if;
end $$;

-- Dos conexiones con la misma clave convergen en un solo lote.
create extension if not exists dblink;
create function public.test_create_translation_batch(p_key uuid,p_selection jsonb) returns text
language plpgsql as $$ begin
  perform set_config('app.test_role','authenticated',true);
  perform set_config('app.test_user_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
  perform set_config('app.test_permissions','blog.view,blog.update',true);
  return public.translation_admin_create_batch(p_key,p_selection,20,100000)::text;
exception when others then return 'error:'||sqlstate; end $$;
do $$
declare s public.translation_field_state%rowtype; selection jsonb;
begin
  select * into s from public.translation_field_state where resource_type='blog_post_translation'
    and target_language='en' order by field_name desc limit 1;
  selection:=jsonb_build_array(jsonb_build_object('state_id',s.id,'expected_lock_version',s.lock_version));
  perform dblink_connect('bulk_a','dbname='||current_database());
  perform dblink_connect('bulk_b','dbname='||current_database());
  perform dblink_send_query('bulk_a',format('select public.test_create_translation_batch(%L,%L::jsonb)',
    '22222222-2222-4222-8222-222222222222',selection::text));
  perform dblink_send_query('bulk_b',format('select public.test_create_translation_batch(%L,%L::jsonb)',
    '22222222-2222-4222-8222-222222222222',selection::text));
end $$;
select * from dblink_get_result('bulk_a') as t(result text);
select * from dblink_get_result('bulk_b') as t(result text);
select dblink_disconnect('bulk_a'); select dblink_disconnect('bulk_b');
do $$ begin
  if (select count(*) from public.translation_batches where idempotency_key='22222222-2222-4222-8222-222222222222')<>1
  then raise exception 'Concurrencia creo lotes duplicados'; end if;
end $$;
drop function public.test_create_translation_batch(uuid,jsonb);

select 'translation bulk batches 3E.8.4A: ok' as result;

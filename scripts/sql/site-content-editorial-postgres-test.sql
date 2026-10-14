\set ON_ERROR_STOP on

insert into public.site_content(key,language,value,type) values('home.hero.subtitle','es','Otra fuente','text');
insert into public.site_content(key,language,value,type) values('home.hero.enabled','global','true','config');

set role authenticated;
select set_config('request.jwt.claim.role','authenticated',false);
insert into public.site_content(key,language,value,type) values('home.hero.cta','es','Fuente autenticada','text');
do $$ begin
  begin
    insert into public.site_content(key,language,value,type) values('home.hero.cta','pt','Bypass RLS','text');
    raise exception 'RLS permitió INSERT destino autenticado';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

do $$ begin
  begin
    insert into public.site_content(key,language,value,type) values('home.hero.title','en','Bypass','text');
    raise exception 'INSERT destino directo fue aceptado';
  exception when insufficient_privilege then null; end;
end $$;

select public.translation_publish_draft(id,lock_version) from public.translation_field_state
where resource_type='site_content' and resource_id='home.hero.title' and target_language='en';

do $$ begin
  if (select value from public.site_content where key='home.hero.title' and language='en')<>'Publicada' then
    raise exception 'La publicación editorial autorizada fue bloqueada';
  end if;
  begin
    update public.site_content set value='Bypass update' where key='home.hero.title' and language='en';
    raise exception 'UPDATE destino directo fue aceptado';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.site_content where key='home.hero.title' and language='en';
    raise exception 'DELETE destino directo fue aceptado';
  exception when insufficient_privilege then null; end;
  if (select value from public.site_content where key='home.hero.title' and language='en')<>'Publicada' then
    raise exception 'Los intentos directos alteraron la traducción';
  end if;
  if exists(select 1 from public.translation_jobs) then raise exception '3E.7 creó jobs'; end if;
  if has_function_privilege('anon','public.translation_site_content_editorial_write_guard()','EXECUTE')
     or has_function_privilege('authenticated','public.translation_site_content_editorial_write_guard()','EXECUTE') then
    raise exception 'El helper del trigger quedó expuesto';
  end if;
end $$;

select 'site_content editorial enforcement postgres tests passed' as result;

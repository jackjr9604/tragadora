-- 3E.10.3.2C.5B: escrituras administrativas atómicas para plataformas.
-- Cada llamada RPC se ejecuta en una única transacción PostgreSQL. No crea jobs
-- ni publica traducciones; los triggers editoriales existentes conservan hashes,
-- revisiones y estados stale/missing.
begin;

do $$
begin
  if to_regclass('public.platforms') is null
     or to_regclass('public.platform_translations') is null
     or to_regclass('public.prop_firm_details') is null
     or to_regclass('public.broker_details') is null
     or to_regclass('public.exchange_details') is null
     or to_regclass('public.platform_markets') is null
     or to_regclass('public.platform_trading_platforms') is null
     or to_regclass('public.platform_instruments') is null
     or to_regclass('public.platform_transaction_methods') is null
     or to_regprocedure('public.has_admin_permission(text)') is null then
    raise exception 'Faltan dependencias para las escrituras transaccionales de plataformas';
  end if;
end $$;

create or replace function public.admin_save_prop_firm(
  p_platform_id uuid,
  p_expected_updated_at timestamptz,
  p_name text,
  p_slug text,
  p_description text,
  p_website_url text,
  p_logo_media_id uuid,
  p_status public.platform_status,
  p_score numeric,
  p_origin_country_code text,
  p_ceo_name text,
  p_founded_at date,
  p_broker_provider text,
  p_inactivity_days integer,
  p_is_new boolean,
  p_profit_split_min numeric,
  p_profit_split_max numeric,
  p_supports_ea boolean,
  p_allows_news boolean,
  p_allows_weekend boolean,
  p_allows_scalping boolean,
  p_allows_day_trading boolean,
  p_allows_copy_trading boolean,
  p_time_limit_policy text,
  p_consistency_rules text,
  p_special_rules text,
  p_markets text[],
  p_trading_platform_ids uuid[],
  p_instrument_category_ids uuid[],
  p_transaction_method_ids uuid[],
  p_transaction_method_deposit boolean[],
  p_transaction_method_payout boolean[]
) returns table(
  platform_id uuid,
  operation text,
  previous_slug text,
  current_slug text,
  current_updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor uuid := auth.uid();
  current_row public.platforms%rowtype;
  saved_row public.platforms%rowtype;
  next_id uuid;
  action_name text;
  item_count integer;
begin
  if actor is null then raise exception 'Unauthorized' using errcode='28000'; end if;
  if public.has_admin_permission(case when p_platform_id is null then 'platforms.create' else 'platforms.update' end) is not true then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  if p_name is null or length(btrim(p_name)) not between 1 and 240
     or p_slug is null or length(p_slug) > 200 or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
     or p_description is null or length(p_description) > 5000
     or (p_website_url is not null and (length(p_website_url) > 2000 or p_website_url !~* '^https?://[^[:space:]]+$'))
     or (p_score is not null and (p_score < 0 or p_score > 10))
     or (p_origin_country_code is not null and p_origin_country_code !~ '^[A-Z]{2}$')
     or (p_ceo_name is not null and length(p_ceo_name) > 240)
     or (p_broker_provider is not null and length(p_broker_provider) > 500)
     or (p_inactivity_days is not null and (p_inactivity_days < 0 or p_inactivity_days > 100000))
     or (p_profit_split_min is not null and (p_profit_split_min < 0 or p_profit_split_min > 100))
     or (p_profit_split_max is not null and (p_profit_split_max < 0 or p_profit_split_max > 100))
     or (p_time_limit_policy is not null and length(p_time_limit_policy) > 10000)
     or (p_consistency_rules is not null and length(p_consistency_rules) > 10000)
     or (p_special_rules is not null and length(p_special_rules) > 10000) then
    raise exception 'Datos de Prop Firm no válidos' using errcode='22023';
  end if;
  if p_profit_split_min is not null and p_profit_split_max is not null and p_profit_split_min > p_profit_split_max then
    raise exception 'El profit split mínimo no puede superar el máximo' using errcode='22023';
  end if;
  if p_is_new is null then raise exception 'is_new es obligatorio' using errcode='22023'; end if;
  p_markets := coalesce(p_markets, array[]::text[]);
  p_trading_platform_ids := coalesce(p_trading_platform_ids, array[]::uuid[]);
  p_instrument_category_ids := coalesce(p_instrument_category_ids, array[]::uuid[]);
  p_transaction_method_ids := coalesce(p_transaction_method_ids, array[]::uuid[]);
  p_transaction_method_deposit := coalesce(p_transaction_method_deposit, array[]::boolean[]);
  p_transaction_method_payout := coalesce(p_transaction_method_payout, array[]::boolean[]);
  if cardinality(p_markets) > 4 or cardinality(p_trading_platform_ids) > 100
     or cardinality(p_instrument_category_ids) > 100 or cardinality(p_transaction_method_ids) > 100
     or cardinality(p_transaction_method_ids) <> cardinality(p_transaction_method_deposit)
     or cardinality(p_transaction_method_ids) <> cardinality(p_transaction_method_payout) then
    raise exception 'Relaciones de Prop Firm no válidas' using errcode='22023';
  end if;
  if exists(select 1 from unnest(p_markets) value where value not in ('cfd','futures','crypto','options'))
     or cardinality(p_markets) <> (select count(distinct value) from unnest(p_markets) value)
     or cardinality(p_trading_platform_ids) <> (select count(distinct value) from unnest(p_trading_platform_ids) value)
     or cardinality(p_instrument_category_ids) <> (select count(distinct value) from unnest(p_instrument_category_ids) value)
     or cardinality(p_transaction_method_ids) <> (select count(distinct value) from unnest(p_transaction_method_ids) value) then
    raise exception 'Relaciones duplicadas o no permitidas' using errcode='22023';
  end if;
  if exists(select 1 from generate_subscripts(p_transaction_method_ids,1) i where not (p_transaction_method_deposit[i] or p_transaction_method_payout[i])) then
    raise exception 'Cada método debe permitir depósito o retiro' using errcode='22023';
  end if;
  if p_origin_country_code is not null and not exists(select 1 from public.countries where code=p_origin_country_code) then raise exception 'País no válido' using errcode='23503'; end if;
  if p_logo_media_id is not null and not exists(select 1 from public.media where id=p_logo_media_id) then raise exception 'Medio no válido' using errcode='23503'; end if;
  select count(*) into item_count from public.trading_platforms where id=any(p_trading_platform_ids);
  if item_count <> cardinality(p_trading_platform_ids) then raise exception 'Plataforma de trading no válida' using errcode='23503'; end if;
  select count(*) into item_count from public.instrument_categories where id=any(p_instrument_category_ids);
  if item_count <> cardinality(p_instrument_category_ids) then raise exception 'Instrumento no válido' using errcode='23503'; end if;
  select count(*) into item_count from public.transaction_methods where id=any(p_transaction_method_ids);
  if item_count <> cardinality(p_transaction_method_ids) then raise exception 'Método de transacción no válido' using errcode='23503'; end if;

  if p_platform_id is null then
    action_name := 'created';
    insert into public.platforms(type,name,slug,website_url,logo_media_id,status,score,origin_country_code)
    values('prop_firm',btrim(p_name),p_slug,nullif(btrim(p_website_url),''),p_logo_media_id,p_status,p_score,p_origin_country_code)
    returning * into saved_row;
    next_id := saved_row.id;
  else
    action_name := 'updated';
    select * into current_row from public.platforms where id=p_platform_id for update;
    if not found or current_row.type <> 'prop_firm' then raise exception 'Prop Firm no encontrada' using errcode='P0002'; end if;
    if p_expected_updated_at is null or current_row.updated_at is distinct from p_expected_updated_at then raise exception 'La Prop Firm cambió; recarga antes de guardar' using errcode='40001'; end if;
    update public.platforms set name=btrim(p_name),slug=p_slug,website_url=nullif(btrim(p_website_url),''),logo_media_id=p_logo_media_id,
      status=p_status,score=p_score,origin_country_code=p_origin_country_code where id=p_platform_id returning * into saved_row;
    next_id := p_platform_id;
  end if;

  insert into public.prop_firm_details(platform_id,ceo_name,founded_at,broker_provider,inactivity_days,is_new,
    profit_split_min,profit_split_max,supports_ea,allows_news_trading,allows_weekend_holding,allows_scalping,
    allows_day_trading,allows_copy_trading,time_limit_policy,consistency_rules,special_rules)
  values(next_id,nullif(btrim(p_ceo_name),''),p_founded_at,nullif(btrim(p_broker_provider),''),p_inactivity_days,p_is_new,
    p_profit_split_min,p_profit_split_max,p_supports_ea,p_allows_news,p_allows_weekend,p_allows_scalping,
    p_allows_day_trading,p_allows_copy_trading,nullif(btrim(p_time_limit_policy),''),nullif(btrim(p_consistency_rules),''),nullif(btrim(p_special_rules),''))
  on conflict on constraint prop_firm_details_platform_id_key do update set ceo_name=excluded.ceo_name,founded_at=excluded.founded_at,broker_provider=excluded.broker_provider,
    inactivity_days=excluded.inactivity_days,is_new=excluded.is_new,profit_split_min=excluded.profit_split_min,
    profit_split_max=excluded.profit_split_max,supports_ea=excluded.supports_ea,allows_news_trading=excluded.allows_news_trading,
    allows_weekend_holding=excluded.allows_weekend_holding,allows_scalping=excluded.allows_scalping,
    allows_day_trading=excluded.allows_day_trading,allows_copy_trading=excluded.allows_copy_trading,
    time_limit_policy=excluded.time_limit_policy,consistency_rules=excluded.consistency_rules,special_rules=excluded.special_rules;

  insert into public.platform_translations(platform_id,language,short_description)
  values(next_id,'es',nullif(btrim(p_description),''))
  on conflict on constraint platform_translations_platform_id_language_key do update set short_description=excluded.short_description;

  delete from public.platform_markets pm where pm.platform_id=next_id;
  insert into public.platform_markets(platform_id,market) select next_id,value from unnest(p_markets) value;
  delete from public.platform_trading_platforms ptp where ptp.platform_id=next_id;
  insert into public.platform_trading_platforms(platform_id,trading_platform_id) select next_id,value from unnest(p_trading_platform_ids) value;
  delete from public.platform_instruments pi where pi.platform_id=next_id;
  insert into public.platform_instruments(platform_id,instrument_category_id) select next_id,value from unnest(p_instrument_category_ids) value;
  delete from public.platform_transaction_methods ptm where ptm.platform_id=next_id;
  insert into public.platform_transaction_methods(platform_id,transaction_method_id,supports_deposit,supports_payout)
  select next_id,p_transaction_method_ids[i],p_transaction_method_deposit[i],p_transaction_method_payout[i]
  from generate_subscripts(p_transaction_method_ids,1) i;

  insert into public.admin_audit_log(actor_user_id,action,module,previous_value,new_value)
  values(actor,'platform.'||action_name,'platforms',
    case when current_row.id is null then null else jsonb_build_object('id',current_row.id,'type',current_row.type,'slug',current_row.slug,'status',current_row.status,'updated_at',current_row.updated_at) end,
    jsonb_build_object('id',saved_row.id,'type',saved_row.type,'slug',saved_row.slug,'status',saved_row.status,'updated_at',saved_row.updated_at,
      'markets',cardinality(p_markets),'trading_platforms',cardinality(p_trading_platform_ids),'instruments',cardinality(p_instrument_category_ids),'transaction_methods',cardinality(p_transaction_method_ids)));
  return query select saved_row.id,action_name,current_row.slug,saved_row.slug,saved_row.updated_at;
exception
  when unique_violation then raise exception 'El slug ya está en uso' using errcode='23505';
  when foreign_key_violation then raise exception 'Una referencia relacionada ya no existe' using errcode='23503';
  when check_violation then raise exception 'Los datos no cumplen las restricciones' using errcode='23514';
end $$;

create or replace function public.admin_save_broker(
  p_platform_id uuid,p_expected_updated_at timestamptz,p_name text,p_slug text,p_description text,
  p_website_url text,p_logo_media_id uuid,p_status public.platform_status,p_country_code text,
  p_founded_year integer,p_minimum_deposit numeric,p_minimum_deposit_currency text,
  p_regulation_summary text,p_regulation_source_url text,p_is_featured boolean,p_display_order integer,
  p_markets text[],p_trading_platform_ids uuid[]
) returns table(platform_id uuid,operation text,previous_slug text,current_slug text,current_updated_at timestamptz)
language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor uuid:=auth.uid(); current_row public.platforms%rowtype; saved_row public.platforms%rowtype; next_id uuid; action_name text; item_count integer;
begin
  if actor is null then raise exception 'Unauthorized' using errcode='28000'; end if;
  if public.has_admin_permission(case when p_platform_id is null then 'platforms.create' else 'platforms.update' end) is not true then raise exception 'Forbidden' using errcode='42501'; end if;
  if p_name is null or length(btrim(p_name)) not between 1 and 240 or p_slug is null or length(p_slug)>200 or p_slug!~'^[a-z0-9]+(-[a-z0-9]+)*$'
    or p_description is not null and length(p_description)>5000 or p_website_url is not null and (length(p_website_url)>2000 or p_website_url!~*'^https?://[^[:space:]]+$')
    or p_country_code is not null and p_country_code!~'^[A-Z]{2}$' or p_founded_year is not null and (p_founded_year<1800 or p_founded_year>2200)
    or p_minimum_deposit is not null and (p_minimum_deposit<0 or p_minimum_deposit>1000000000000)
    or p_minimum_deposit_currency is not null and p_minimum_deposit_currency!~'^[A-Z]{3}$'
    or p_regulation_summary is not null and length(p_regulation_summary)>10000
    or p_regulation_source_url is not null and (length(p_regulation_source_url)>2000 or p_regulation_source_url!~*'^https?://[^[:space:]]+$')
    or p_is_featured is null or p_display_order is null or p_display_order<0 or p_display_order>1000000 then raise exception 'Datos de broker no válidos' using errcode='22023'; end if;
  if (p_minimum_deposit is null) <> (p_minimum_deposit_currency is null) then raise exception 'Depósito y moneda deben definirse juntos' using errcode='22023'; end if;
  p_markets:=coalesce(p_markets,array[]::text[]); p_trading_platform_ids:=coalesce(p_trading_platform_ids,array[]::uuid[]);
  if cardinality(p_markets)>4 or cardinality(p_trading_platform_ids)>100
    or exists(select 1 from unnest(p_markets) value where value not in('cfd','futures','crypto','options'))
    or cardinality(p_markets)<>(select count(distinct value) from unnest(p_markets)value)
    or cardinality(p_trading_platform_ids)<>(select count(distinct value) from unnest(p_trading_platform_ids)value) then raise exception 'Relaciones de broker no válidas' using errcode='22023'; end if;
  if p_country_code is not null and not exists(select 1 from public.countries where code=p_country_code) then raise exception 'País no válido' using errcode='23503'; end if;
  if p_logo_media_id is not null and not exists(select 1 from public.media where id=p_logo_media_id) then raise exception 'Medio no válido' using errcode='23503'; end if;
  select count(*) into item_count from public.trading_platforms where id=any(p_trading_platform_ids);
  if item_count<>cardinality(p_trading_platform_ids) then raise exception 'Plataforma de trading no válida' using errcode='23503'; end if;
  if p_platform_id is null then
    action_name:='created'; insert into public.platforms(type,name,slug,website_url,logo_media_id,status,origin_country_code)
      values('broker',btrim(p_name),p_slug,nullif(btrim(p_website_url),''),p_logo_media_id,p_status,p_country_code) returning * into saved_row; next_id:=saved_row.id;
  else
    action_name:='updated'; select * into current_row from public.platforms where id=p_platform_id for update;
    if not found or current_row.type<>'broker' then raise exception 'Broker no encontrado' using errcode='P0002'; end if;
    if p_expected_updated_at is null or current_row.updated_at is distinct from p_expected_updated_at then raise exception 'El broker cambió; recarga antes de guardar' using errcode='40001'; end if;
    update public.platforms set name=btrim(p_name),slug=p_slug,website_url=nullif(btrim(p_website_url),''),logo_media_id=p_logo_media_id,status=p_status,origin_country_code=p_country_code
      where id=p_platform_id returning * into saved_row; next_id:=p_platform_id;
  end if;
  insert into public.broker_details(platform_id,founded_year,minimum_deposit,minimum_deposit_currency,regulation_summary,regulation_source_url,is_featured,display_order)
    values(next_id,p_founded_year,p_minimum_deposit,p_minimum_deposit_currency,nullif(btrim(p_regulation_summary),''),nullif(btrim(p_regulation_source_url),''),p_is_featured,p_display_order)
    on conflict on constraint broker_details_pkey do update set founded_year=excluded.founded_year,minimum_deposit=excluded.minimum_deposit,minimum_deposit_currency=excluded.minimum_deposit_currency,
      regulation_summary=excluded.regulation_summary,regulation_source_url=excluded.regulation_source_url,is_featured=excluded.is_featured,display_order=excluded.display_order;
  insert into public.platform_translations(platform_id,language,short_description) values(next_id,'es',nullif(btrim(p_description),''))
    on conflict on constraint platform_translations_platform_id_language_key do update set short_description=excluded.short_description;
  delete from public.platform_markets pm where pm.platform_id=next_id;
  insert into public.platform_markets(platform_id,market) select next_id,value from unnest(p_markets)value;
  delete from public.platform_trading_platforms ptp where ptp.platform_id=next_id;
  insert into public.platform_trading_platforms(platform_id,trading_platform_id) select next_id,value from unnest(p_trading_platform_ids)value;
  insert into public.admin_audit_log(actor_user_id,action,module,previous_value,new_value) values(actor,'platform.'||action_name,'platforms',
    case when current_row.id is null then null else jsonb_build_object('id',current_row.id,'type',current_row.type,'slug',current_row.slug,'status',current_row.status,'updated_at',current_row.updated_at) end,
    jsonb_build_object('id',saved_row.id,'type',saved_row.type,'slug',saved_row.slug,'status',saved_row.status,'updated_at',saved_row.updated_at,'markets',cardinality(p_markets),'trading_platforms',cardinality(p_trading_platform_ids)));
  return query select saved_row.id,action_name,current_row.slug,saved_row.slug,saved_row.updated_at;
exception when unique_violation then raise exception 'El slug ya está en uso' using errcode='23505'; when foreign_key_violation then raise exception 'Una referencia relacionada ya no existe' using errcode='23503'; when check_violation then raise exception 'Los datos no cumplen las restricciones' using errcode='23514';
end $$;

create or replace function public.admin_save_exchange(
  p_platform_id uuid,p_expected_updated_at timestamptz,p_name text,p_slug text,p_description text,
  p_website_url text,p_logo_media_id uuid,p_status public.platform_status,p_country_code text,
  p_founded_year integer,p_exchange_type text,p_product_summary text,p_fiat_support boolean,
  p_regulation_summary text,p_regulation_source_url text,p_is_featured boolean,p_display_order integer
) returns table(platform_id uuid,operation text,previous_slug text,current_slug text,current_updated_at timestamptz)
language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor uuid:=auth.uid(); current_row public.platforms%rowtype; saved_row public.platforms%rowtype; next_id uuid; action_name text;
begin
  if actor is null then raise exception 'Unauthorized' using errcode='28000'; end if;
  if public.has_admin_permission(case when p_platform_id is null then 'platforms.create' else 'platforms.update' end) is not true then raise exception 'Forbidden' using errcode='42501'; end if;
  if p_name is null or length(btrim(p_name)) not between 1 and 240 or p_slug is null or length(p_slug)>200 or p_slug!~'^[a-z0-9]+(-[a-z0-9]+)*$'
    or p_description is not null and length(p_description)>5000 or p_website_url is not null and (length(p_website_url)>2000 or p_website_url!~*'^https?://[^[:space:]]+$')
    or p_country_code is not null and p_country_code!~'^[A-Z]{2}$' or p_founded_year is not null and (p_founded_year<1800 or p_founded_year>2200)
    or p_exchange_type not in('centralized','decentralized') or p_product_summary is not null and length(p_product_summary)>5000
    or p_regulation_summary is not null and length(p_regulation_summary)>10000
    or p_regulation_source_url is not null and (length(p_regulation_source_url)>2000 or p_regulation_source_url!~*'^https?://[^[:space:]]+$')
    or p_is_featured is null or p_display_order is null or p_display_order<0 or p_display_order>1000000 then raise exception 'Datos de exchange no válidos' using errcode='22023'; end if;
  if p_country_code is not null and not exists(select 1 from public.countries where code=p_country_code) then raise exception 'País no válido' using errcode='23503'; end if;
  if p_logo_media_id is not null and not exists(select 1 from public.media where id=p_logo_media_id) then raise exception 'Medio no válido' using errcode='23503'; end if;
  if p_platform_id is null then
    action_name:='created'; insert into public.platforms(type,name,slug,website_url,logo_media_id,status,origin_country_code)
      values('exchange',btrim(p_name),p_slug,nullif(btrim(p_website_url),''),p_logo_media_id,p_status,p_country_code) returning * into saved_row; next_id:=saved_row.id;
  else
    action_name:='updated'; select * into current_row from public.platforms where id=p_platform_id for update;
    if not found or current_row.type<>'exchange' then raise exception 'Exchange no encontrado' using errcode='P0002'; end if;
    if p_expected_updated_at is null or current_row.updated_at is distinct from p_expected_updated_at then raise exception 'El exchange cambió; recarga antes de guardar' using errcode='40001'; end if;
    update public.platforms set name=btrim(p_name),slug=p_slug,website_url=nullif(btrim(p_website_url),''),logo_media_id=p_logo_media_id,status=p_status,origin_country_code=p_country_code
      where id=p_platform_id returning * into saved_row; next_id:=p_platform_id;
  end if;
  insert into public.exchange_details(platform_id,founded_year,exchange_type,product_summary,fiat_support,regulation_summary,regulation_source_url,is_featured,display_order)
    values(next_id,p_founded_year,p_exchange_type,nullif(btrim(p_product_summary),''),p_fiat_support,nullif(btrim(p_regulation_summary),''),nullif(btrim(p_regulation_source_url),''),p_is_featured,p_display_order)
    on conflict on constraint exchange_details_pkey do update set founded_year=excluded.founded_year,exchange_type=excluded.exchange_type,product_summary=excluded.product_summary,
      fiat_support=excluded.fiat_support,regulation_summary=excluded.regulation_summary,regulation_source_url=excluded.regulation_source_url,is_featured=excluded.is_featured,display_order=excluded.display_order;
  insert into public.platform_translations(platform_id,language,short_description) values(next_id,'es',nullif(btrim(p_description),''))
    on conflict on constraint platform_translations_platform_id_language_key do update set short_description=excluded.short_description;
  insert into public.admin_audit_log(actor_user_id,action,module,previous_value,new_value) values(actor,'platform.'||action_name,'platforms',
    case when current_row.id is null then null else jsonb_build_object('id',current_row.id,'type',current_row.type,'slug',current_row.slug,'status',current_row.status,'updated_at',current_row.updated_at) end,
    jsonb_build_object('id',saved_row.id,'type',saved_row.type,'slug',saved_row.slug,'status',saved_row.status,'updated_at',saved_row.updated_at));
  return query select saved_row.id,action_name,current_row.slug,saved_row.slug,saved_row.updated_at;
exception when unique_violation then raise exception 'El slug ya está en uso' using errcode='23505'; when foreign_key_violation then raise exception 'Una referencia relacionada ya no existe' using errcode='23503'; when check_violation then raise exception 'Los datos no cumplen las restricciones' using errcode='23514';
end $$;

create or replace function public.admin_delete_platform(
  p_platform_id uuid,
  p_expected_type public.platform_type,
  p_expected_slug text,
  p_expected_updated_at timestamptz
) returns table(platform_id uuid,operation text,previous_slug text,current_slug text,current_updated_at timestamptz)
language plpgsql security definer set search_path=pg_catalog,public as $$
declare actor uuid:=auth.uid(); current_row public.platforms%rowtype; dependency_count bigint;
begin
  if actor is null then raise exception 'Unauthorized' using errcode='28000'; end if;
  if public.has_admin_permission('platforms.delete') is not true then raise exception 'Forbidden' using errcode='42501'; end if;
  if p_expected_type not in('prop_firm','broker','exchange') or p_expected_slug is null or p_expected_updated_at is null then raise exception 'Snapshot de eliminación no válido' using errcode='22023'; end if;
  select * into current_row from public.platforms where id=p_platform_id for update;
  if not found or current_row.type<>p_expected_type then raise exception 'Plataforma no encontrada' using errcode='P0002'; end if;
  if current_row.slug is distinct from p_expected_slug or current_row.updated_at is distinct from p_expected_updated_at then raise exception 'La plataforma cambió; recarga antes de eliminar' using errcode='40001'; end if;
  select
    (select count(*) from public.offers x where x.platform_id=p_platform_id)+
    (select count(*) from public.challenges x where x.platform_id=p_platform_id)+
    (select count(*) from public.payouts x where x.platform_id=p_platform_id)+
    (select count(*) from public.payout_sources x where x.platform_id=p_platform_id)+
    (select count(*) from public.platform_payout_metrics x where x.platform_id=p_platform_id)+
    (select count(*) from public.affiliate_links x where x.platform_id=p_platform_id)+
    (select count(*) from public.external_platform_mappings x where x.platform_id=p_platform_id)+
    (select count(*) from public.giveaways where sponsor_platform_id=p_platform_id)+
    (select count(*) from public.favorites x where x.platform_id=p_platform_id)+
    (select count(*) from public.home_featured_platforms x where x.platform_id=p_platform_id)+
    (select count(*) from public.platform_research_status x where x.platform_id=p_platform_id)
  into dependency_count;
  if dependency_count>0 then raise exception 'La plataforma tiene dependencias y debe retirarse en lugar de eliminarse' using errcode='23503'; end if;
  insert into public.admin_audit_log(actor_user_id,action,module,previous_value,new_value)
    values(actor,'platform.deleted','platforms',jsonb_build_object('id',current_row.id,'type',current_row.type,'slug',current_row.slug,'status',current_row.status,'updated_at',current_row.updated_at),null);
  delete from public.platforms where id=p_platform_id;
  if not found then raise exception 'Plataforma no encontrada' using errcode='P0002'; end if;
  return query select current_row.id,'deleted'::text,current_row.slug,null::text,current_row.updated_at;
end $$;

revoke all on function public.admin_save_prop_firm(uuid,timestamptz,text,text,text,text,uuid,public.platform_status,numeric,text,text,date,text,integer,boolean,numeric,numeric,boolean,boolean,boolean,boolean,boolean,boolean,text,text,text,text[],uuid[],uuid[],uuid[],boolean[],boolean[]) from public,anon,authenticated,service_role;
revoke all on function public.admin_save_broker(uuid,timestamptz,text,text,text,text,uuid,public.platform_status,text,integer,numeric,text,text,text,boolean,integer,text[],uuid[]) from public,anon,authenticated,service_role;
revoke all on function public.admin_save_exchange(uuid,timestamptz,text,text,text,text,uuid,public.platform_status,text,integer,text,text,boolean,text,text,boolean,integer) from public,anon,authenticated,service_role;
revoke all on function public.admin_delete_platform(uuid,public.platform_type,text,timestamptz) from public,anon,authenticated,service_role;
grant execute on function public.admin_save_prop_firm(uuid,timestamptz,text,text,text,text,uuid,public.platform_status,numeric,text,text,date,text,integer,boolean,numeric,numeric,boolean,boolean,boolean,boolean,boolean,boolean,text,text,text,text[],uuid[],uuid[],uuid[],boolean[],boolean[]) to authenticated;
grant execute on function public.admin_save_broker(uuid,timestamptz,text,text,text,text,uuid,public.platform_status,text,integer,numeric,text,text,text,boolean,integer,text[],uuid[]) to authenticated;
grant execute on function public.admin_save_exchange(uuid,timestamptz,text,text,text,text,uuid,public.platform_status,text,integer,text,text,boolean,text,text,boolean,integer) to authenticated;
grant execute on function public.admin_delete_platform(uuid,public.platform_type,text,timestamptz) to authenticated;

comment on function public.admin_save_prop_firm(uuid,timestamptz,text,text,text,text,uuid,public.platform_status,numeric,text,text,date,text,integer,boolean,numeric,numeric,boolean,boolean,boolean,boolean,boolean,boolean,text,text,text,text[],uuid[],uuid[],uuid[],boolean[],boolean[]) is 'Guarda atómicamente una Prop Firm y su agregado con permiso granular.';
comment on function public.admin_save_broker(uuid,timestamptz,text,text,text,text,uuid,public.platform_status,text,integer,numeric,text,text,text,boolean,integer,text[],uuid[]) is 'Guarda atómicamente un broker y su agregado con permiso granular.';
comment on function public.admin_save_exchange(uuid,timestamptz,text,text,text,text,uuid,public.platform_status,text,integer,text,text,boolean,text,text,boolean,integer) is 'Guarda atómicamente un exchange y su agregado con permiso granular.';
comment on function public.admin_delete_platform(uuid,public.platform_type,text,timestamptz) is 'Elimina una plataforma sin dependencias comerciales, con snapshot y permiso delete.';

commit;

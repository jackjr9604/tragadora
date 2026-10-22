begin;

create table if not exists public.affiliate_click_throttles (
  visitor_hash text primary key,
  window_started_at timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  last_seen_at timestamptz not null
);

create table if not exists public.affiliate_click_deduplication (
  visitor_hash text not null,
  affiliate_link_id uuid not null references public.affiliate_links(id) on delete cascade,
  last_recorded_at timestamptz not null,
  request_count integer not null default 1 check (request_count >= 1),
  last_seen_at timestamptz not null,
  primary key (visitor_hash, affiliate_link_id)
);

create index if not exists affiliate_click_throttles_last_seen_idx
  on public.affiliate_click_throttles(last_seen_at);
create index if not exists affiliate_click_deduplication_last_seen_idx
  on public.affiliate_click_deduplication(last_seen_at);

alter table public.affiliate_click_throttles enable row level security;
alter table public.affiliate_click_deduplication enable row level security;

revoke all on public.affiliate_click_throttles from public, anon, authenticated;
revoke all on public.affiliate_click_deduplication from public, anon, authenticated;
grant all on public.affiliate_click_throttles to service_role;
grant all on public.affiliate_click_deduplication to service_role;

-- El registro público debe pasar exclusivamente por la RPC atómica. La función
-- SECURITY DEFINER conserva el INSERT como propietaria, mientras service_role
-- mantiene sus lecturas existentes para métricas y administración.
revoke insert on public.affiliate_clicks from public, anon, authenticated, service_role;

create or replace function public.affiliate_record_click(
  p_affiliate_link_id uuid,
  p_visitor_hash text,
  p_country_code text default null,
  p_language text default null,
  p_source_page text default null
)
returns table(recorded boolean, reason text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_rate_count integer;
  v_last_recorded_at timestamptz;
  v_country_code text := p_country_code;
begin
  if auth.role() <> 'service_role' then
    raise exception 'affiliate_tracking_forbidden' using errcode = '42501';
  end if;
  if p_visitor_hash is null or p_visitor_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'affiliate_tracking_invalid_visitor' using errcode = '22023';
  end if;
  if p_country_code is not null and p_country_code !~ '^[A-Z]{2}$' then
    raise exception 'affiliate_tracking_invalid_country' using errcode = '22023';
  end if;
  if p_language is not null and (length(p_language) > 35 or p_language !~ '^[a-z]{2,3}(-[a-z0-9]{2,8})?$') then
    raise exception 'affiliate_tracking_invalid_language' using errcode = '22023';
  end if;
  if p_source_page is not null and (length(p_source_page) > 500 or p_source_page !~ '^https?://') then
    raise exception 'affiliate_tracking_invalid_source' using errcode = '22023';
  end if;
  if v_country_code is not null and not exists (
    select 1 from public.countries where code = v_country_code
  ) then
    v_country_code := null;
  end if;
  if not exists (
    select 1 from public.affiliate_links
    where id = p_affiliate_link_id and status = true
  ) then
    return query select false, 'inactive_link'::text;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_visitor_hash, 9137));

  insert into public.affiliate_click_throttles as throttle (
    visitor_hash, window_started_at, request_count, last_seen_at
  ) values (p_visitor_hash, v_now, 1, v_now)
  on conflict (visitor_hash) do update set
    window_started_at = case
      when throttle.window_started_at <= v_now - interval '1 hour' then v_now
      else throttle.window_started_at
    end,
    request_count = case
      when throttle.window_started_at <= v_now - interval '1 hour' then 1
      else throttle.request_count + 1
    end,
    last_seen_at = v_now
  returning request_count into v_rate_count;

  if v_rate_count > 60 then
    return query select false, 'rate_limited'::text;
    return;
  end if;

  select last_recorded_at into v_last_recorded_at
  from public.affiliate_click_deduplication
  where visitor_hash = p_visitor_hash
    and affiliate_link_id = p_affiliate_link_id
  for update;

  if v_last_recorded_at is not null
     and v_last_recorded_at > v_now - interval '30 minutes' then
    update public.affiliate_click_deduplication
    set request_count = request_count + 1,
        last_seen_at = v_now
    where visitor_hash = p_visitor_hash
      and affiliate_link_id = p_affiliate_link_id;
    return query select false, 'duplicate'::text;
    return;
  end if;

  insert into public.affiliate_click_deduplication as dedup (
    visitor_hash, affiliate_link_id, last_recorded_at, request_count, last_seen_at
  ) values (p_visitor_hash, p_affiliate_link_id, v_now, 1, v_now)
  on conflict (visitor_hash, affiliate_link_id) do update set
    last_recorded_at = v_now,
    request_count = dedup.request_count + 1,
    last_seen_at = v_now;

  insert into public.affiliate_clicks (
    affiliate_link_id, country_code, language, source_page, created_at
  ) values (
    p_affiliate_link_id, v_country_code, p_language, p_source_page, v_now
  );

  -- Los hashes rotan cada día. La limpieza acotada evita crecimiento indefinido
  -- sin convertir cada llamada en un borrado masivo.
  delete from public.affiliate_click_throttles
  where ctid in (
    select ctid from public.affiliate_click_throttles
    where last_seen_at < v_now - interval '3 days'
    limit 100
  );
  delete from public.affiliate_click_deduplication
  where ctid in (
    select ctid from public.affiliate_click_deduplication
    where last_seen_at < v_now - interval '3 days'
    limit 100
  );

  return query select true, 'recorded'::text;
end;
$$;

revoke all on function public.affiliate_record_click(uuid,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.affiliate_record_click(uuid,text,text,text,text)
  to service_role;

commit;

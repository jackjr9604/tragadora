\set ON_ERROR_STOP on
begin;

insert into public.countries (code, name, region)
values ('CO', 'Colombia', 'South America')
on conflict (code) do nothing;
insert into public.platforms (id, name, slug, type, status)
values ('10000000-0000-4000-8000-000000000001', 'Affiliate E2E', 'affiliate-e2e', 'prop_firm', 'active');
insert into public.affiliate_links (id, platform_id, url, priority, status)
values ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'https://example.com/affiliate', 0, true);

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

do $$
declare
  v_result record;
  v_count integer;
  v_iteration integer;
begin
  select * into v_result from public.affiliate_record_click(
    '20000000-0000-4000-8000-000000000001', repeat('a', 64), 'CO', 'es', 'https://tradagora.test/ofertas'
  );
  if not v_result.recorded or v_result.reason <> 'recorded' then raise exception 'first_click_not_recorded'; end if;

  select * into v_result from public.affiliate_record_click(
    '20000000-0000-4000-8000-000000000001', repeat('a', 64), 'CO', 'es', null
  );
  if v_result.recorded or v_result.reason <> 'duplicate' then raise exception 'duplicate_not_blocked'; end if;

  update public.affiliate_click_deduplication
  set last_recorded_at = clock_timestamp() - interval '31 minutes'
  where visitor_hash = repeat('a', 64);
  select * into v_result from public.affiliate_record_click(
    '20000000-0000-4000-8000-000000000001', repeat('a', 64), null, 'pt', null
  );
  if not v_result.recorded then raise exception 'click_after_window_not_recorded'; end if;

  select count(*) into v_count from public.affiliate_clicks
  where affiliate_link_id = '20000000-0000-4000-8000-000000000001';
  if v_count <> 2 then raise exception 'unexpected_click_count:%', v_count; end if;

  select * into v_result from public.affiliate_record_click(
    '20000000-0000-4000-8000-000000000001', repeat('b', 64), null, 'en', null
  );
  if not v_result.recorded then raise exception 'rate_fixture_first_click_not_recorded'; end if;
  for v_iteration in 1..59 loop
    perform * from public.affiliate_record_click(
      '20000000-0000-4000-8000-000000000001', repeat('b', 64), null, 'en', null
    );
  end loop;
  select * into v_result from public.affiliate_record_click(
    '20000000-0000-4000-8000-000000000001', repeat('b', 64), null, 'en', null
  );
  if v_result.recorded or v_result.reason <> 'rate_limited' then raise exception 'rate_limit_not_enforced'; end if;
end $$;

reset role;
select set_config('request.jwt.claim.role', '', true);

do $$
begin
  if has_function_privilege('anon', 'public.affiliate_record_click(uuid,text,text,text,text)', 'EXECUTE') then raise exception 'anon_can_execute'; end if;
  if has_function_privilege('authenticated', 'public.affiliate_record_click(uuid,text,text,text,text)', 'EXECUTE') then raise exception 'authenticated_can_execute'; end if;
  if not has_function_privilege('service_role', 'public.affiliate_record_click(uuid,text,text,text,text)', 'EXECUTE') then raise exception 'service_role_cannot_execute'; end if;
end $$;

rollback;

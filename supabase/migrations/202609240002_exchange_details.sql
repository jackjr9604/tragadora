begin;
create table if not exists public.exchange_details (
 platform_id uuid primary key references public.platforms(id) on delete cascade,
 founded_year integer check(founded_year is null or founded_year between 1800 and 2200),
 exchange_type text not null default 'centralized' check(exchange_type in ('centralized','decentralized')),
 product_summary text, fiat_support boolean, regulation_summary text, regulation_source_url text,
 is_featured boolean not null default false, display_order integer not null default 100 check(display_order>=0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists exchange_details_featured_order_idx on public.exchange_details(is_featured desc,display_order,platform_id);
create or replace function public.touch_exchange_details_updated_at() returns trigger language plpgsql set search_path=public as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists exchange_details_touch_updated_at on public.exchange_details;
create trigger exchange_details_touch_updated_at before update on public.exchange_details for each row execute function public.touch_exchange_details_updated_at();
alter table public.exchange_details enable row level security;
create policy exchange_details_public_read on public.exchange_details for select to public using(exists(select 1 from public.platforms p where p.id=exchange_details.platform_id and p.type='exchange' and p.status='active'));
create policy tg_exchange_details_view on public.exchange_details for select to authenticated using(public.has_admin_permission('platforms.view'));
create policy tg_exchange_details_create on public.exchange_details for insert to authenticated with check(public.has_admin_permission('platforms.create'));
create policy tg_exchange_details_update on public.exchange_details for update to authenticated using(public.has_admin_permission('platforms.update')) with check(public.has_admin_permission('platforms.update'));
create policy tg_exchange_details_delete on public.exchange_details for delete to authenticated using(public.has_admin_permission('platforms.delete'));
grant select on public.exchange_details to anon,authenticated; grant insert,update,delete on public.exchange_details to authenticated; grant all on public.exchange_details to service_role;
commit;

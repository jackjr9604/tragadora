-- Extensión mínima para brokers. La identidad y relaciones siguen viviendo en platforms.
begin;

create table if not exists public.broker_details (
  platform_id uuid primary key references public.platforms(id) on delete cascade,
  founded_year integer check (founded_year is null or founded_year between 1800 and 2200),
  minimum_deposit numeric check (minimum_deposit is null or minimum_deposit >= 0),
  minimum_deposit_currency text check (minimum_deposit_currency is null or char_length(minimum_deposit_currency) = 3),
  regulation_summary text,
  regulation_source_url text,
  is_featured boolean not null default false,
  display_order integer not null default 100 check (display_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists broker_details_featured_order_idx
  on public.broker_details (is_featured desc, display_order, platform_id);

create or replace function public.touch_broker_details_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists broker_details_touch_updated_at on public.broker_details;
create trigger broker_details_touch_updated_at
before update on public.broker_details
for each row execute function public.touch_broker_details_updated_at();

alter table public.broker_details enable row level security;

drop policy if exists broker_details_public_read on public.broker_details;
create policy broker_details_public_read
on public.broker_details for select to public
using (
  exists (
    select 1 from public.platforms p
    where p.id = broker_details.platform_id
      and p.type = 'broker'
      and p.status = 'active'
  )
);

drop policy if exists tg_broker_details_view on public.broker_details;
create policy tg_broker_details_view on public.broker_details
for select to authenticated
using (public.has_admin_permission('platforms.view'));

drop policy if exists tg_broker_details_create on public.broker_details;
create policy tg_broker_details_create on public.broker_details
for insert to authenticated
with check (public.has_admin_permission('platforms.create'));

drop policy if exists tg_broker_details_update on public.broker_details;
create policy tg_broker_details_update on public.broker_details
for update to authenticated
using (public.has_admin_permission('platforms.update'))
with check (public.has_admin_permission('platforms.update'));

drop policy if exists tg_broker_details_delete on public.broker_details;
create policy tg_broker_details_delete on public.broker_details
for delete to authenticated
using (public.has_admin_permission('platforms.delete'));

grant select on public.broker_details to anon, authenticated;
grant insert, update, delete on public.broker_details to authenticated;
grant all on public.broker_details to service_role;

comment on table public.broker_details is
  'Datos mínimos específicos de brokers; identidad, catálogos, ofertas y afiliados permanecen normalizados.';

commit;

-- Selección editorial y ordenada de Prop Firms destacadas en Home.

begin;

create table if not exists public.home_featured_platforms (
  id uuid primary key default gen_random_uuid(),
  platform_id uuid not null references public.platforms(id) on delete cascade,
  active boolean not null default true,
  sort_order integer not null default 1 check (sort_order > 0),
  badge text,
  cta_label text,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint home_featured_platforms_platform_unique unique (platform_id),
  constraint home_featured_platforms_dates_check check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create index if not exists home_featured_platforms_public_idx
  on public.home_featured_platforms (active, sort_order);

alter table public.home_featured_platforms enable row level security;

drop policy if exists "home_featured_platforms_public_read" on public.home_featured_platforms;
create policy "home_featured_platforms_public_read"
  on public.home_featured_platforms for select
  using (true);

drop policy if exists "home_featured_platforms_admin_all" on public.home_featured_platforms;
create policy "home_featured_platforms_admin_all"
  on public.home_featured_platforms for all
  using (public.is_admin())
  with check (public.is_admin());

comment on table public.home_featured_platforms is
  'Selección editorial de Prop Firms mostradas en la portada; no representa ranking ni recomendación.';

commit;

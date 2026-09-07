create table if not exists public.media_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

alter table public.media
  add column if not exists category_id uuid null;

alter table public.media
  drop constraint if exists media_category_id_fkey;

alter table public.media
  add constraint media_category_id_fkey
  foreign key (category_id)
  references public.media_categories(id)
  on delete set null;

create index if not exists media_category_id_idx
  on public.media(category_id);

alter table public.media_categories enable row level security;

drop policy if exists "media_admin_update" on public.media;
create policy "media_admin_update"
  on public.media for update
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "media_categories_admin_read" on public.media_categories;
create policy "media_categories_admin_read"
  on public.media_categories for select
  using (public.is_admin());

drop policy if exists "media_categories_admin_insert" on public.media_categories;
create policy "media_categories_admin_insert"
  on public.media_categories for insert
  with check (public.is_admin());

drop policy if exists "media_categories_admin_update" on public.media_categories;
create policy "media_categories_admin_update"
  on public.media_categories for update
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "media_categories_admin_delete" on public.media_categories;
create policy "media_categories_admin_delete"
  on public.media_categories for delete
  using (public.is_admin());

insert into public.media_categories (name, slug)
values
  ('Logos de firmas', 'logos-firmas'),
  ('Logos generales', 'logos-generales'),
  ('Banderas / países', 'banderas-paises'),
  ('Blog', 'blog'),
  ('Ofertas', 'ofertas'),
  ('Banners', 'banners'),
  ('Contenido', 'contenido'),
  ('Sin clasificar', 'sin-clasificar')
on conflict (slug) do update set name = excluded.name;

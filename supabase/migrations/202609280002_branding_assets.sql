begin;

-- Slots globales de identidad visual. El archivo continúa perteneciendo a Multimedia.
create table if not exists public.branding_assets (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  media_id uuid not null references public.media(id) on delete restrict,
  alt_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- La tabla puede existir de una aplicación manual anterior con un catálogo
-- de slots más corto. CREATE TABLE IF NOT EXISTS no actualiza ese CHECK.
alter table public.branding_assets
  drop constraint if exists branding_assets_key_check;

alter table public.branding_assets
  add constraint branding_assets_key_check check (key in (
    'logo_on_dark',
    'logo_on_light',
    'logo_symbol',
    'favicon',
    'apple_touch_icon',
    'organization_logo',
    'login_logo',
    'admin_logo',
    'navbar_desktop_logo',
    'navbar_mobile_logo',
    'footer_logo',
    'og_image',
    'pwa_icon'
  ));

create index if not exists branding_assets_media_id_idx
  on public.branding_assets(media_id);

alter table public.branding_assets enable row level security;

insert into public.admin_permissions (key, module, action, label, description, sort_order)
values
  ('branding.view', 'branding', 'view', 'Ver identidad visual', 'Consultar los slots globales de marca.', 105),
  ('branding.create', 'branding', 'create', 'Asignar identidad visual', 'Asignar un archivo de Multimedia a un slot vacío.', 106),
  ('branding.update', 'branding', 'update', 'Modificar identidad visual', 'Reemplazar recursos globales de marca.', 107),
  ('branding.delete', 'branding', 'delete', 'Restablecer identidad visual', 'Vaciar un slot y volver a su fallback.', 108)
on conflict (key) do update set
  module = excluded.module,
  action = excluded.action,
  label = excluded.label,
  description = excluded.description,
  sort_order = excluded.sort_order;

insert into public.role_permissions (role, permission_key, allowed)
select 'admin'::public.user_role, key, true
from public.admin_permissions
where module = 'branding'
on conflict (role, permission_key) do update set allowed = excluded.allowed;

drop policy if exists tg_branding_assets_public_view on public.branding_assets;
create policy tg_branding_assets_public_view
  on public.branding_assets for select
  to anon, authenticated
  using (true);

drop policy if exists tg_branding_assets_create on public.branding_assets;
create policy tg_branding_assets_create
  on public.branding_assets for insert
  to authenticated
  with check (public.has_admin_permission('branding.create'));

drop policy if exists tg_branding_assets_update on public.branding_assets;
create policy tg_branding_assets_update
  on public.branding_assets for update
  to authenticated
  using (public.has_admin_permission('branding.update'))
  with check (public.has_admin_permission('branding.update'));

drop policy if exists tg_branding_assets_delete on public.branding_assets;
create policy tg_branding_assets_delete
  on public.branding_assets for delete
  to authenticated
  using (public.has_admin_permission('branding.delete'));

grant select on public.branding_assets to anon, authenticated;
grant insert, update, delete on public.branding_assets to authenticated;
grant all on public.branding_assets to service_role;

-- Multimedia no tenía borrado de objetos porque la UI original no lo ofrecía.
drop policy if exists tg_storage_media_delete on storage.objects;
create policy tg_storage_media_delete
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'media' and public.has_admin_permission('media.delete'));

commit;

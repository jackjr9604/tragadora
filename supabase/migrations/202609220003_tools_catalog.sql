-- Catálogo administrable de herramientas. Las implementaciones internas viven en código.
begin;

create table if not exists public.tools (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  short_description text,
  tool_type text not null,
  category text,
  icon_key text,
  badge text,
  internal_path text,
  external_url text,
  is_featured boolean not null default false,
  display_order integer not null default 100,
  status text not null default 'draft',
  open_in_new_tab boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tools_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint tools_type_check check (tool_type in ('internal', 'external', 'coming_soon')),
  constraint tools_status_check check (status in ('draft', 'published')),
  constraint tools_display_order_check check (display_order >= 0),
  constraint tools_destination_check check (
    (tool_type = 'internal' and internal_path is not null and external_url is null)
    or (tool_type = 'external' and external_url is not null and internal_path is null)
    or (tool_type = 'coming_soon' and internal_path is null and external_url is null)
  )
);

create index if not exists tools_public_order_idx
  on public.tools (status, is_featured desc, display_order, name);

create or replace function public.touch_tools_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tools_touch_updated_at on public.tools;
create trigger tools_touch_updated_at before update on public.tools
for each row execute function public.touch_tools_updated_at();

insert into public.admin_permissions (key, module, action, label, sort_order)
select 'tools.' || action, 'tools', action, 'Herramientas', 105 + action_order
from unnest(array['view','create','update','delete']) with ordinality as a(action, action_order)
on conflict (key) do update set label = excluded.label, sort_order = excluded.sort_order;

insert into public.role_permissions (role, permission_key, allowed)
select 'admin'::public.user_role, key, true
from public.admin_permissions where module = 'tools'
on conflict do nothing;

alter table public.tools enable row level security;

drop policy if exists tools_public_read on public.tools;
create policy tools_public_read on public.tools
for select to public using (status = 'published');

drop policy if exists tg_tools_view on public.tools;
create policy tg_tools_view on public.tools for select to authenticated
using (public.has_admin_permission('tools.view'));

drop policy if exists tg_tools_create on public.tools;
create policy tg_tools_create on public.tools for insert to authenticated
with check (public.has_admin_permission('tools.create'));

drop policy if exists tg_tools_update on public.tools;
create policy tg_tools_update on public.tools for update to authenticated
using (public.has_admin_permission('tools.update'))
with check (public.has_admin_permission('tools.update'));

drop policy if exists tg_tools_delete on public.tools;
create policy tg_tools_delete on public.tools for delete to authenticated
using (public.has_admin_permission('tools.delete'));

grant select on public.tools to anon, authenticated;
grant insert, update, delete on public.tools to authenticated;
grant all on public.tools to service_role;

comment on table public.tools is
  'Catálogo y presentación de herramientas; las herramientas internas se implementan exclusivamente en código.';

commit;

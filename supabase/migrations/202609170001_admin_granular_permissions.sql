-- Revisión local: NO aplicar automáticamente. Conserva public.is_admin() para compatibilidad.
begin;

create table if not exists public.admin_permissions (
  key text primary key,
  module text not null,
  action text not null,
  label text not null,
  description text,
  sort_order integer not null default 0,
  unique (module, action),
  constraint admin_permissions_key_format check (key = module || '.' || action)
);

create table if not exists public.role_permissions (
  role public.user_role not null,
  permission_key text not null references public.admin_permissions(key) on delete cascade,
  allowed boolean not null default true,
  primary key (role, permission_key)
);

create table if not exists public.user_permission_overrides (
  user_id uuid not null references public.profiles(id) on delete cascade,
  permission_key text not null references public.admin_permissions(key) on delete cascade,
  allowed boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, permission_key)
);

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.profiles(id),
  target_user_id uuid references public.profiles(id),
  action text not null,
  module text,
  previous_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_log_target_created_idx
  on public.admin_audit_log (target_user_id, created_at desc);

alter table public.admin_permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_permission_overrides enable row level security;
alter table public.admin_audit_log enable row level security;

-- La gestión de matrices y auditoría se hace exclusivamente por backend service_role.
revoke all on public.admin_permissions, public.role_permissions,
  public.user_permission_overrides, public.admin_audit_log from anon, authenticated;
grant select on public.admin_permissions to authenticated;
grant all on public.admin_permissions, public.role_permissions,
  public.user_permission_overrides, public.admin_audit_log to service_role;
drop policy if exists admin_permissions_authenticated_read on public.admin_permissions;
create policy admin_permissions_authenticated_read on public.admin_permissions
  for select to authenticated using (true);

insert into public.admin_permissions (key, module, action, label, sort_order)
select module || '.' || action, module, action, label, module_order * 10 + action_order
from (values
  ('dashboard', 'Dashboard', 1, array['view']),
  ('home', 'Home', 2, array['view','create','update','delete']),
  ('platforms', 'Plataformas', 3, array['view','create','update','delete']),
  ('platform_research', 'Investigación', 4, array['view','create','update']),
  ('challenges', 'Challenges', 5, array['view','create','update','delete']),
  ('payouts', 'Payouts', 6, array['view','create','update','delete']),
  ('offers', 'Ofertas', 7, array['view','create','update','delete']),
  ('affiliate_links', 'Afiliados', 8, array['view','create','update','delete']),
  ('content', 'Contenido', 9, array['view','create','update','delete']),
  ('media', 'Multimedia', 10, array['view','create','update','delete']),
  ('users', 'Usuarios', 11, array['view','manage_roles','manage_permissions'])
) as modules(module, label, module_order, actions)
cross join lateral unnest(actions) with ordinality as a(action, action_order)
on conflict (key) do update set label = excluded.label, sort_order = excluded.sort_order;

-- Presets iniciales. Los overrides individuales no se alteran en un reintento.
insert into public.role_permissions (role, permission_key, allowed)
select 'editor'::public.user_role, key, true from public.admin_permissions
where key in (
  'dashboard.view','home.view','home.update','platforms.view','platforms.update',
  'platform_research.view','platform_research.create','platform_research.update',
  'challenges.view','challenges.create','challenges.update',
  'content.view','content.update','media.view','media.create','media.update'
)
on conflict do nothing;
insert into public.role_permissions (role, permission_key, allowed)
select 'admin'::public.user_role, key, true from public.admin_permissions
where module not in ('users')
on conflict do nothing;

create or replace function public.has_admin_permission(permission_key text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  actor_role public.user_role;
  explicit_allowed boolean;
begin
  if auth.uid() is null or permission_key is null then return false; end if;
  if not exists (select 1 from public.admin_permissions p where p.key = permission_key) then return false; end if;
  select p.role into actor_role from public.profiles p where p.id = auth.uid();
  if actor_role = 'super_admin' then return true; end if;
  select o.allowed into explicit_allowed from public.user_permission_overrides o
    where o.user_id = auth.uid() and o.permission_key = has_admin_permission.permission_key;
  if found then return explicit_allowed; end if;
  select rp.allowed into explicit_allowed from public.role_permissions rp
    where rp.role = actor_role and rp.permission_key = has_admin_permission.permission_key;
  return coalesce(explicit_allowed, false);
end;
$$;
revoke all on function public.has_admin_permission(text) from public, anon;
grant execute on function public.has_admin_permission(text) to authenticated, service_role;

-- Un UPDATE de perfil propio nunca puede elevar role. Solo el backend con
-- service_role cambia roles; una intervención manual de BD requeriría un proceso aparte.
create or replace function public.guard_profile_role()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if auth.role() is distinct from 'service_role' and new.role <> 'user' then
      raise exception 'Un perfil nuevo no puede asignarse un rol administrativo';
    end if;
    return new;
  end if;
  if tg_op = 'UPDATE' and auth.role() is distinct from 'service_role'
     and (new.id is distinct from old.id or new.created_at is distinct from old.created_at) then
    raise exception 'profiles.id/created_at no pueden cambiarse desde el cliente';
  end if;
  if tg_op = 'UPDATE' and new.role is distinct from old.role then
    if auth.role() is distinct from 'service_role' then
      raise exception 'profiles.role solo puede cambiarse desde el backend administrativo';
    end if;
  end if;
  if tg_op = 'DELETE' and auth.role() is distinct from 'service_role' then
    raise exception 'Los perfiles solo pueden eliminarse desde el backend administrativo';
  end if;
  if (tg_op = 'DELETE' or (tg_op = 'UPDATE' and new.role is distinct from old.role))
     and old.role = 'super_admin' and (tg_op = 'DELETE' or new.role <> 'super_admin') then
    perform pg_catalog.pg_advisory_xact_lock(74201915);
    -- Bloquea el conjunto visible de super_admin. Dos degradaciones concurrentes
    -- de filas distintas terminarán serializadas o con una transacción abortada
    -- (deadlock/serialization), nunca con cero administradores.
    perform 1 from public.profiles where role = 'super_admin' order by id for update;
    if (select count(*) from public.profiles where role = 'super_admin') <= 1 then
      raise exception 'No se puede eliminar o degradar al último super_admin';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
drop trigger if exists guard_profile_role_trigger on public.profiles;
create trigger guard_profile_role_trigger before insert or update or delete on public.profiles
  for each row execute function public.guard_profile_role();

-- Las RPC siguientes solo aceptan service_role y vuelven a comprobar al actor.
-- Trust boundary: el actor_id lo obtiene el servidor de auth.getUser(), nunca
-- del body HTTP. service_role no lleva auth.uid() del usuario final; quien posea
-- la clave de servicio ya tiene privilegios completos y debe permanecer server-only.
-- Datos + auditoría quedan en la misma transacción PostgreSQL.
create or replace function public.admin_set_user_role(
  actor_id uuid, target_id uuid, next_role public.user_role, keep_overrides boolean
) returns void language plpgsql security definer set search_path = '' as $$
declare previous_role public.user_role;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden'; end if;
  if not exists (select 1 from public.profiles where id = actor_id and role = 'super_admin') then raise exception 'Forbidden'; end if;
  select role into previous_role from public.profiles where id = target_id for update;
  if not found then raise exception 'Perfil no encontrado'; end if;
  if previous_role is distinct from next_role then
    update public.profiles set role = next_role where id = target_id;
  end if;
  if not keep_overrides then delete from public.user_permission_overrides where user_id = target_id; end if;
  insert into public.admin_audit_log(actor_user_id,target_user_id,action,module,previous_value,new_value)
    values (actor_id,target_id,'role_changed','users',
      pg_catalog.jsonb_build_object('role',previous_role),
      pg_catalog.jsonb_build_object('role',next_role,'kept_overrides',keep_overrides));
end;
$$;

create or replace function public.admin_set_user_override(
  actor_id uuid, target_id uuid, target_key text, next_allowed boolean
) returns void language plpgsql security definer set search_path = '' as $$
declare previous_allowed boolean;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden'; end if;
  if not exists (select 1 from public.profiles where id = actor_id and role = 'super_admin') then raise exception 'Forbidden'; end if;
  if not exists (select 1 from public.admin_permissions where key = target_key) then raise exception 'Permiso desconocido'; end if;
  if target_key like 'users.%' then raise exception 'La administración de usuarios es exclusiva de super_admin'; end if;
  if not exists (select 1 from public.profiles where id = target_id) then raise exception 'Perfil no encontrado'; end if;
  if (select role from public.profiles where id = target_id) = 'super_admin' then raise exception 'super_admin no usa overrides'; end if;
  select allowed into previous_allowed from public.user_permission_overrides
    where user_id = target_id and permission_key = target_key;
  if next_allowed is null then
    delete from public.user_permission_overrides where user_id = target_id and permission_key = target_key;
  else
    insert into public.user_permission_overrides(user_id,permission_key,allowed)
      values(target_id,target_key,next_allowed)
      on conflict (user_id,permission_key) do update
      set allowed = excluded.allowed, updated_at = now();
  end if;
  insert into public.admin_audit_log(actor_user_id,target_user_id,action,module,previous_value,new_value)
    values (actor_id,target_id,'permission_override_changed','users',
      pg_catalog.jsonb_build_object('permission',target_key,'allowed',previous_allowed),
      pg_catalog.jsonb_build_object('permission',target_key,'allowed',next_allowed));
end;
$$;

create or replace function public.admin_reset_user_overrides(actor_id uuid, target_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare previous_overrides jsonb;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden'; end if;
  if not exists (select 1 from public.profiles where id = actor_id and role = 'super_admin') then raise exception 'Forbidden'; end if;
  select coalesce(pg_catalog.jsonb_object_agg(permission_key,allowed), '{}'::jsonb)
    into previous_overrides from public.user_permission_overrides where user_id = target_id;
  delete from public.user_permission_overrides where user_id = target_id;
  insert into public.admin_audit_log(actor_user_id,target_user_id,action,module,previous_value,new_value)
    values (actor_id,target_id,'permission_overrides_reset','users',previous_overrides,'{}'::jsonb);
end;
$$;

create or replace function public.admin_set_role_permission(
  actor_id uuid, target_role public.user_role, target_key text, next_allowed boolean
) returns void language plpgsql security definer set search_path = '' as $$
declare previous_allowed boolean;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Forbidden'; end if;
  if not exists (select 1 from public.profiles where id = actor_id and role = 'super_admin') then raise exception 'Forbidden'; end if;
  if target_role not in ('admin','editor') then raise exception 'Solo se editan presets admin/editor'; end if;
  if not exists (select 1 from public.admin_permissions where key = target_key) then raise exception 'Permiso desconocido'; end if;
  if target_key like 'users.%' then raise exception 'La administración de usuarios es exclusiva de super_admin'; end if;
  select allowed into previous_allowed from public.role_permissions
    where role = target_role and permission_key = target_key;
  insert into public.role_permissions(role,permission_key,allowed)
    values(target_role,target_key,next_allowed)
    on conflict (role,permission_key) do update set allowed = excluded.allowed;
  insert into public.admin_audit_log(actor_user_id,action,module,previous_value,new_value)
    values (actor_id,'role_preset_changed','users',
      pg_catalog.jsonb_build_object('role',target_role,'permission',target_key,'allowed',previous_allowed),
      pg_catalog.jsonb_build_object('role',target_role,'permission',target_key,'allowed',next_allowed));
end;
$$;

revoke all on function public.admin_set_user_role(uuid,uuid,public.user_role,boolean) from public, anon, authenticated;
revoke all on function public.admin_set_user_override(uuid,uuid,text,boolean) from public, anon, authenticated;
revoke all on function public.admin_reset_user_overrides(uuid,uuid) from public, anon, authenticated;
revoke all on function public.admin_set_role_permission(uuid,public.user_role,text,boolean) from public, anon, authenticated;
grant execute on function public.admin_set_user_role(uuid,uuid,public.user_role,boolean) to service_role;
grant execute on function public.admin_set_user_override(uuid,uuid,text,boolean) to service_role;
grant execute on function public.admin_reset_user_overrides(uuid,uuid) to service_role;
grant execute on function public.admin_set_role_permission(uuid,public.user_role,text,boolean) to service_role;

-- Casos esperados para revisión:
-- super_admin: cualquier key válida = true; key inexistente = false.
-- admin/editor: preset, luego override; user = false.
-- editor + payouts.view=true: puede ver, no crear sin payouts.create.
-- admin + platforms.delete=false: DELETE denegado.
-- usuario autenticado intentando UPDATE profiles SET role='super_admin': trigger rechaza.
-- degradar al único super_admin: trigger rechaza incluso con service_role.
-- Prueba manual futura, NO incluida en la ejecución de esta migración:
-- Con DOS super_admin de prueba A/B, abrir dos sesiones service_role.
-- Sesión A: BEGIN; UPDATE public.profiles SET role='admin' WHERE id='<A>';
-- Sesión B: BEGIN; UPDATE public.profiles SET role='admin' WHERE id='<B>';
-- La segunda debe esperar o abortar por deadlock/serialization. Si A hace
-- COMMIT, B debe fallar por último super_admin. Hacer ROLLBACK en ambas pruebas
-- cuando corresponda. Repetir en READ COMMITTED y REPEATABLE READ.

commit;

-- SOLO LECTURA. Ejecutar únicamente después de aplicar 001 y 002, no antes.
-- Resultado esperado en las tablas migradas: cero referencias a is_admin()/is_editor(),
-- cero policies ALL administrativas y cero INSERT autenticados con WITH CHECK true.

select schemaname, tablename, policyname, cmd, roles, permissive, qual, with_check
from pg_catalog.pg_policies
where schemaname in ('public', 'storage')
  and (
    coalesce(qual, '') ilike '%is_admin(%'
    or coalesce(with_check, '') ilike '%is_admin(%'
    or coalesce(qual, '') ilike '%is_editor(%'
    or coalesce(with_check, '') ilike '%is_editor(%'
    or (cmd = 'ALL' and (policyname ilike '%admin%' or policyname ilike '%editor%'))
    or (cmd in ('ALL', 'INSERT') and roles && array['authenticated']::name[]
      and regexp_replace(coalesce(with_check, ''), '[()[:space:]]', '', 'g') = 'true')
  )
order by schemaname, tablename, policyname;

-- Inventario completo de policies finales, incluyendo Storage y lecturas públicas.
select schemaname, tablename, policyname, cmd, roles, permissive, qual, with_check
from pg_catalog.pg_policies
where schemaname = 'public' or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename, policyname;

-- Owner, SECURITY DEFINER, search_path y EXECUTE efectivo de las funciones nuevas.
select n.nspname as schema_name, p.proname, pg_catalog.pg_get_userbyid(p.proowner) as owner,
  p.prosecdef as security_definer, p.proconfig as function_config,
  exists (
    select 1 from pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) acl
    where acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
  ) as public_execute,
  pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
  pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE') as service_execute
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('has_admin_permission', 'guard_profile_role', 'admin_set_user_role',
    'admin_set_user_override', 'admin_reset_user_overrides', 'admin_set_role_permission')
order by p.proname;

-- Privilegios de tablas y columnas: profiles.role/id/created_at no deben tener
-- UPDATE para anon/authenticated; solo columnas editables del perfil propio.
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name in ('profiles', 'admin_permissions',
  'role_permissions', 'user_permission_overrides', 'admin_audit_log')
order by table_name, grantee, privilege_type;

select grantee, table_name, column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'profiles' and privilege_type = 'UPDATE'
order by grantee, column_name;

-- RLS habilitado para las tablas de permisos y las principales del admin.
select n.nspname as schema_name, c.relname as table_name, c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('profiles', 'platforms', 'challenges',
  'payouts', 'affiliate_clicks', 'admin_permissions', 'role_permissions',
  'user_permission_overrides', 'admin_audit_log')
order by c.relname;

select count(*) as super_admin_count from public.profiles where role = 'super_admin';

-- Storage media: debe quedar upload condicionado a media.create; la lectura
-- administrativa a media.view. Confirmar bucket público por separado.
select p.policyname, p.cmd, p.roles, p.qual, p.with_check
from pg_catalog.pg_policies p
where p.schemaname = 'storage' and p.tablename = 'objects'
order by p.policyname;
select id, public from storage.buckets where id = 'media';

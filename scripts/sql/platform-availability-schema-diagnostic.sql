-- SOLO LECTURA. Ejecutar como una única consulta en Supabase SQL Editor.
-- Devuelve un JSON con el esquema real y las cinco filas geográficas actuales.
with target_tables(table_name) as (
  values
    ('platform_availability'),
    ('platforms'),
    ('countries'),
    ('platform_markets'),
    ('challenges'),
    ('challenge_variants'),
    ('account_plans')
), relations as (
  select t.table_name, c.oid as relation_oid, c.relowner, c.relacl,
         c.relrowsecurity, c.relforcerowsecurity
  from target_tables t
  left join pg_namespace n on n.nspname = 'public'
  left join pg_class c on c.relnamespace = n.oid and c.relname = t.table_name
)
select jsonb_pretty(jsonb_build_object(
  'tables', (select coalesce(jsonb_agg(jsonb_build_object(
    'name', table_name, 'exists', relation_oid is not null,
    'rls_enabled', relrowsecurity, 'rls_forced', relforcerowsecurity
  ) order by table_name), '[]'::jsonb) from relations),
  'columns', (select coalesce(jsonb_agg(jsonb_build_object(
    'table', r.table_name, 'name', a.attname, 'type', format_type(a.atttypid, a.atttypmod),
    'nullable', not a.attnotnull, 'default', pg_get_expr(d.adbin, d.adrelid),
    'identity', a.attidentity, 'generated', a.attgenerated
  ) order by r.table_name, a.attnum), '[]'::jsonb)
    from relations r join pg_attribute a on a.attrelid = r.relation_oid and a.attnum > 0 and not a.attisdropped
    left join pg_attrdef d on d.adrelid = r.relation_oid and d.adnum = a.attnum),
  'constraints', (select coalesce(jsonb_agg(jsonb_build_object(
    'table', r.table_name, 'name', c.conname, 'type', c.contype,
    'definition', pg_get_constraintdef(c.oid, true),
    'referenced_table', case when c.confrelid <> 0 then c.confrelid::regclass::text end
  ) order by r.table_name, c.conname), '[]'::jsonb)
    from relations r join pg_constraint c on c.conrelid = r.relation_oid),
  'indexes', (select coalesce(jsonb_agg(jsonb_build_object(
    'table', i.tablename, 'name', i.indexname, 'definition', i.indexdef
  ) order by i.tablename, i.indexname), '[]'::jsonb)
    from pg_indexes i join target_tables t on t.table_name = i.tablename
    where i.schemaname = 'public'),
  'enums', (select coalesce(jsonb_agg(jsonb_build_object(
    'table', r.table_name, 'column', a.attname, 'type', typ.typname,
    'value', e.enumlabel, 'order', e.enumsortorder
  ) order by r.table_name, a.attname, e.enumsortorder), '[]'::jsonb)
    from relations r join pg_attribute a on a.attrelid = r.relation_oid and a.attnum > 0 and not a.attisdropped
    join pg_type typ on typ.oid = a.atttypid
    join pg_enum e on e.enumtypid = typ.oid),
  'policies', (select coalesce(jsonb_agg(jsonb_build_object(
    'table', p.tablename, 'name', p.policyname, 'permissive', p.permissive,
    'roles', p.roles, 'command', p.cmd, 'using', p.qual, 'with_check', p.with_check
  ) order by p.tablename, p.policyname), '[]'::jsonb)
    from pg_policies p join target_tables t on t.table_name = p.tablename
    where p.schemaname = 'public'),
  'table_grants', (select coalesce(jsonb_agg(jsonb_build_object(
    'table', r.table_name, 'grantee', case when acl.grantee = 0 then 'PUBLIC' else gr.rolname end,
    'grantor', grantor.rolname, 'privilege', acl.privilege_type, 'grantable', acl.is_grantable
  ) order by r.table_name, acl.grantee, acl.privilege_type), '[]'::jsonb)
    from relations r
    cross join lateral aclexplode(coalesce(r.relacl, acldefault('r', r.relowner))) acl
    left join pg_roles gr on gr.oid = acl.grantee
    left join pg_roles grantor on grantor.oid = acl.grantor),
  'column_grants', (select coalesce(jsonb_agg(jsonb_build_object(
    'table', r.table_name, 'column', a.attname,
    'grantee', case when acl.grantee = 0 then 'PUBLIC' else gr.rolname end,
    'privilege', acl.privilege_type, 'grantable', acl.is_grantable
  ) order by r.table_name, a.attname, acl.grantee, acl.privilege_type), '[]'::jsonb)
    from relations r join pg_attribute a on a.attrelid = r.relation_oid and a.attnum > 0 and a.attacl is not null
    cross join lateral aclexplode(a.attacl) acl
    left join pg_roles gr on gr.oid = acl.grantee),
  'availability_rows', (select coalesce(jsonb_agg(to_jsonb(pa) order by pa.platform_id, pa.country_code), '[]'::jsonb)
    from public.platform_availability pa)
)) as diagnostic_json;

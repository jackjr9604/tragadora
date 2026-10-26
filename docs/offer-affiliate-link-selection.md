# Selección de enlace afiliado en ofertas

`/go/[slug]` conserva una regla comercial explícita: cuando una oferta define
`affiliate_link_id`, ese enlace es el override preferido. Debe seguir activo y
pertenecer a la misma plataforma, pero no vuelve a filtrarse por challenge,
país o idioma. Si no está activo, la ruta usa el primer enlace general elegible.

La RPC `admin_save_offer` mantiene esa compatibilidad y valida únicamente la
pertenencia del enlace a la plataforma. Cambiar esta semántica requiere una
decisión comercial y pruebas específicas de `/go/`; queda fuera de C.5C.1.

## Validación PostgreSQL local

El runner `scripts/run-admin-offer-transactional-writes-postgres.ps1` valida
esta migración exclusivamente dentro del contenedor Supabase PostgreSQL 15
local. Desde la raíz del repositorio:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-admin-offer-transactional-writes-postgres.ps1
```

El runner exige la tabla de guarda `tradagora_local_e2e_guard`, rechaza URLs
como base origen y solo elimina bases que él mismo haya creado con el prefijo
`tradagora_offer_c5c1f_`. Ejecuta un fallo deliberado, un timeout deliberado y
una instalación limpia posterior. Cada escenario elimina su base temporal en
un bloque `finally` y comprueba en `pg_database` que ya no exista.

Opcionalmente pueden indicarse el contenedor y la base local de origen:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-admin-offer-transactional-writes-postgres.ps1 `
  -Container supabase_db_tradagora-bulk-e2e-baseline -SourceDatabase postgres
```

No debe usarse con `supabase link`, bases remotas ni credenciales productivas.

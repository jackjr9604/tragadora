# Worker local de traducciones (3E.3)

Tradagora no integra proveedores comerciales. La única traducción real se realiza con LibreTranslate instalado en el PC. El proveedor `mock` existe solamente en pruebas automatizadas.

## Arquitectura

1. Un administrador solicita un campo desde `/admin/translations`.
2. Vercel valida sesión y permiso del módulo y crea un `translation_job` para `libretranslate`.
3. El trabajo permanece en Supabase aunque el PC esté apagado.
4. `npm run translation:worker` abre desde el PC conexiones salientes HTTPS hacia Supabase, reclama trabajos con `SKIP LOCKED` y leases, y llama a LibreTranslate por la red local.
5. El resultado validado se guarda solo en `translation_field_state.draft_value`.
6. Un humano debe revisar, aprobar y publicar el borrador desde el flujo 3E.2.

Vercel nunca conecta al PC. LibreTranslate no necesita puerto público, túnel ni regla de entrada en el router.

## Comprobar LibreTranslate sin asumir URL o puerto

Revisa primero cómo se inició el servicio (terminal, servicio de Windows o Docker) para identificar host y puerto. Después prueba las URLs candidatas localmente:

```powershell
Invoke-RestMethod -Uri 'http://HOST:PUERTO/languages' -Method GET
```

La respuesta debe listar los códigos requeridos, al menos `es`, `en` y `pt`. Configura exactamente la URL confirmada; el worker acepta `localhost`, loopback o direcciones privadas LAN y rechaza hosts públicos y URLs con credenciales embebidas.

## Variables en Vercel

```env
TRANSLATION_LOCAL_QUEUE_ENABLED=true
TRANSLATION_LOCAL_MAX_ATTEMPTS=3
TRANSLATION_LOCAL_MAX_DAILY_REQUESTS=20
TRANSLATION_LOCAL_MAX_DAILY_INPUT_CHARACTERS=100000
```

Vercel no recibe `LIBRETRANSLATE_URL`, API keys de traducción ni credenciales del PC.

## Variables locales del worker

Guárdalas solo en `.env.local` del PC:

```env
NEXT_PUBLIC_SUPABASE_URL=https://PROYECTO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
LIBRETRANSLATE_URL=http://HOST_PRIVADO:PUERTO
# Opcional si la instalación local lo exige:
LIBRETRANSLATE_API_KEY=...

TRANSLATION_WORKER_ID=pc-andres
TRANSLATION_WORKER_POLL_MS=5000
TRANSLATION_WORKER_BATCH_SIZE=5
TRANSLATION_WORKER_LEASE_SECONDS=120
TRANSLATION_WORKER_TIMEOUT_MS=60000
TRANSLATION_WORKER_RECOVERY_BATCH_SIZE=50
```

La service-role nunca debe copiarse al navegador, Vercel público, logs ni repositorio. El worker no imprime textos traducidos ni credenciales.

## Ejecutar en Windows

Primero confirma que LibreTranslate responde. Luego, desde el repositorio:

```powershell
npm run translation:worker
```

Para procesar una sola tanda y salir:

```powershell
npm run translation:worker -- --once
```

Antes de reclamar trabajos, el worker consulta `/languages`. Si LibreTranslate está apagado, no reclama nada y los jobs permanecen pendientes sin consumir intentos. Si el proveedor cae después del chequeo, el lease se libera y el intento se restaura.

Al reconectarse, el worker recupera por lotes únicamente jobs `failed` con `error_code=local_provider_unavailable` cuya fuente, revisión y `lock_version` siguen vigentes. Se excluyen traducciones protegidas, borradores activos y publicaciones. La operación es idempotente y no crea jobs duplicados. `TRANSLATION_WORKER_RECOVERY_BATCH_SIZE` controla el lote (1–100) y no modifica los límites diarios existentes.

## Orden de activación

1. Aplicar `202610130001_translation_ai_draft_engine.sql` de forma controlada.
2. Verificar grants de las RPC: solicitud para `authenticated`; claim/read/complete/fail solo para `service_role`.
3. Activar la cola en Vercel.
4. Ejecutar el worker local.
5. Solicitar un único campo de prueba y confirmar que queda como borrador no publicado.

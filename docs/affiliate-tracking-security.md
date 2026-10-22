# Tracking de afiliados: protección antiabuso

`/go/[slug]` conserva la selección de plataforma, oferta, país, idioma y enlace. El tracking se ejecuta después de elegir el destino y cualquier fallo se ignora para no bloquear la redirección.

## Identidad y privacidad

- El servidor requiere `AFFILIATE_TRACKING_SECRET` de al menos 32 bytes y una IP válida entregada por Vercel.
- Se genera un HMAC SHA-256 con bucket UTC diario, IP y user-agent saneado.
- La IP y el user-agent no se guardan. El seudónimo cambia cada día y las tablas de control retienen como máximo unos tres días de actividad.
- En Vercel se prioriza `x-vercel-forwarded-for` y se aceptan como fallback `x-forwarded-for` y `x-real-ip`. El código solo confía en ellos cuando `VERCEL=1`; fuera de Vercel el tracking queda desactivado. Vercel documenta que `x-vercel-forwarded-for` conserva la IP calculada por su red incluso si existe un proxy superior que puede sobrescribir `x-forwarded-for`.
- Sin secreto o sin IP válida no se registra el clic, pero la redirección continúa.

## Límites

- Un clic aceptado por enlace y seudónimo cada 30 minutos.
- Máximo 60 solicitudes de tracking por seudónimo en una ventana fija de una hora.
- La RPC valida nuevamente que el enlace continúe activo y serializa cada seudónimo mediante un advisory lock transaccional.
- `referer` se limita a 500 caracteres, protocolos HTTP(S), sin credenciales, query ni fragmento.

`affiliate_clicks` conserva su estructura. Los reportes existentes siguen contando filas, pero desde esta migración cada fila representa un clic aceptado después de deduplicación, no cada solicitud recibida.

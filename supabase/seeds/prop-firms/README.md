# Seeds de Prop Firms

Estas plantillas preparan datos administrados manualmente. No son migraciones y nunca deben ejecutarse sin copiarse, completar datos confirmados y revisar el diff.

## Crear el seed de una firma

1. Copia `_template.sql` con un nombre estable, por ejemplo `fundednext.sql`.
2. Reemplaza `__REPLACE_NAME__` y `__replace_slug__`.
3. Completa `seed_platform` y las tablas temporales necesarias.
4. Usa `NULL` para información desconocida; no completes datos por inferencia.
5. Revisa que los slugs de catálogos ya existan.
6. Ejecuta el archivo completo en una sola transacción únicamente después de una revisión independiente.

La plantilla aborta si conserva placeholders principales, si falta un catálogo o si una fila hija referencia un challenge o variante no declarados. `BEGIN/COMMIT` evita una carga parcial cuando PostgreSQL reporta un error.

## Campos obligatorios y opcionales

Para `platforms` son obligatorios el nombre, slug, tipo (`prop_firm`) y un status válido. La plantilla fija el tipo y exige nombre/slug. `website_url`, score y `origin_country_code` pueden ser `NULL` cuando no están confirmados.

`prop_firm_details.platform_id` es obligatorio. Los demás campos usados por la plantilla pueden mantenerse en `NULL`, excepto `is_new`, que actualmente es booleano `NOT NULL` con default `false`. `inactivity_days`, cuando existe, debe ser mayor o igual a cero.

Cada challenge requiere slug, nombre y status. `challenge_type` y `phases` pueden ser `NULL`. Cada account plan requiere challenge, tamaño y moneda en esta plantilla; precio y campos legacy pueden ser `NULL`. Para challenges normalizados, targets, drawdowns y días pertenecen a `challenge_phases`, no deben duplicarse en `account_plans` salvo compatibilidad legacy documentada.

Las variantes requieren challenge, slug, nombre y status. Los overrides usan la pareja variante + número de fase. Los rewards requieren challenge, nombre, status y orden; pueden pertenecer al challenge general o a una variante.

## Catálogos

Nunca escribas UUID de catálogos manualmente. Se resuelven así:

- País: `countries.code`.
- Plataforma de trading: `trading_platforms.slug`.
- Instrumento: `instrument_categories.slug`.
- Método de transacción: `transaction_methods.slug`.

El seed no crea entradas de catálogo. Si falta una, debe investigarse y administrarse por separado antes de cargar la firma.

`platform_markets` no es un catálogo con UUID: utiliza los valores permitidos actualmente `cfd`, `futures`, `crypto` y `options` y su PK es `(platform_id, market)`.

## Reejecución y reemplazo de relaciones

La firma se resuelve por `platforms.slug` y conserva su UUID. `prop_firm_details` usa `platform_id`. Las relaciones de mercados, plataformas de trading, instrumentos y métodos de transacción se tratan como el estado completo de la firma: se eliminan y reconstruyen dentro de la misma transacción.

Los challenges declarados se resuelven por `platform_id + slug` y conservan su UUID. La plantilla no elimina challenges omitidos, porque podrían estar referenciados por Offers u otros datos fuera del alcance del seed. Para cada challenge declarado sí reemplaza completamente fases, variantes, overrides, account plans y reward options. Por eso, al reejecutarlo, debes incluir el estado completo vigente de esos hijos.

El repositorio no contiene las migraciones originales de varias tablas base de Challenges. No hay un constraint único versionado para `challenges(platform_id, slug)`, así que la plantilla no usa `ON CONFLICT` allí y aborta si detecta duplicados.

## Configuración de payouts

Copia `_payout-template.sql` únicamente cuando exista una fuente legítima y comprobada. La plantilla puede preparar:

- `payout_sources`: configuración técnica de una fuente/collector.
- `platform_research_status`: estado operativo de investigación.
- `external_platform_mappings`: mapping opcional, dejado comentado hasta confirmar todos sus campos.

Una fuente blockchain debe permanecer inactiva hasta confirmar chain, chain ID, token, decimals y settlement address. `history_page` se mantiene por compatibilidad; collectors concretos pueden utilizar cursores adicionales dentro de `config`, como bloques históricos.

No introduzcas manualmente en estos seeds:

- payouts individuales sin evidencia verificable;
- `platform_payout_metrics` ni snapshots;
- totales, promedios o conteos externos inventados;
- timestamps de sincronización o errores del collector;
- Offers o Affiliate Links.

`challenge_reward_options` describe las condiciones comerciales de retiro de un challenge (split, frecuencia, espera y reglas). No es el Payout Tracker. El tracker registra evidencia o métricas de pagos observados y funciona mediante `payout_sources`, collectors, `payouts` y métricas externas separadas.

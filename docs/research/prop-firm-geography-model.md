# Disponibilidad geográfica: decisión pendiente de catálogo remoto

Verificación de fuentes: 2026-09-18. No se ejecutó SQL remoto ni se cargaron estados nuevos.

## Estado de la auditoría

La API de datos permitió confirmar que `platform_availability` expone exactamente `id`, `platform_id`, `country_code`, `status`; **no** expone `source_url`, `source_name`, `verified_at`, `notes` ni `reason`. También confirmó cinco filas `unknown` para FundingPips (AR, BR, CO, EC, GT) y ninguna fila para las otras 59 firmas activas. PostgREST no devuelve tipos/defaults/nullable ni permite leer `pg_catalog`; por ello PK/FK, CHECK, índices, RLS, políticas y grants remotos quedan **no confirmados**. La consulta única de solo lectura está en `scripts/sql/platform-availability-schema-diagnostic.sql`. No se debe ejecutar una migración sin su resultado.

En el repositorio: `platforms.origin_country_code` referencia `countries(code)` en la migración 202608250001; el admin hace upsert de disponibilidad con `onConflict: 'platform_id,country_code'`; el comparador lee exclusivamente `platform_id,country_code,status` y trata ausencia como `unknown`. Esto describe el código, no prueba constraints remotos.

## Semántica propuesta

`platform_availability` significa una afirmación explícita sobre elegibilidad **general de la firma** para el país indicado, no un mapa exhaustivo ni sinónimo de “global”. `available` exige confirmación positiva en una fuente oficial aplicable a todos los productos relevantes; `restricted` exige prohibición explícita; `unknown` expresa falta de conclusión. Ausencia de fila = `unknown`. No generar `available` por complemento de una lista de prohibiciones.

El país elegido hoy en el CountryPicker se presenta como “país de operación”. Residencia, nacionalidad y ubicación física no son equivalentes. Una prohibición por nacionalidad no debe excluir a alguien solo por seleccionar país de operación; una prohibición por residencia tampoco demuestra la ubicación actual. Antes de usar esas reglas para exclusión automática, el producto deberá precisar qué atributo declara el usuario o mostrar una advertencia cualificada. `platforms.origin_country_code` es origen de la firma, nunca atributo del usuario.

Categorías de evidencia: COUNTRY (país nombrado), RESIDENCY, NATIONALITY, SANCTIONS, PRODUCT, BROKER, OTHER. Son categorías de investigación; no todas necesitan una columna. En el MVP conviene `rule_basis` (`residency`, `nationality`, `residency_or_nationality`, `location`, `unspecified`) más una nota breve para sanciones, broker o excepciones. No copiar términos completos.

## Modelo mínimo propuesto, no implementado

Una sola migración futura, condicionada al diagnóstico:

1. Conservar `platform_availability` para reglas generales. Añadir `source_url text`, `verified_at timestamptz`, `notes text`, `rule_basis text` con CHECK de valores admitidos. No añadir `default_status=available`: las fuentes consultadas tienden a publicar listas de restricciones, no garantía universal para todo país y producto.
2. Crear `platform_availability_market` solo para excepciones por mercado, con `(platform_id, country_code, market)` como clave; `status availability_status`, `source_url`, `verified_at`, `notes`, `rule_basis`. FK a `platforms`, `countries` y, si el catálogo remoto lo confirma, `(platform_id,market)` a `platform_markets`. CHECK de URL no vacía y fecha de verificación no futura para nuevos estados concluyentes. Índices de búsqueda por `(platform_id,country_code)` y `(platform_id,market,country_code)`; la PK cubre el segundo.
3. No crear `challenge` ni `variant` scope todavía: las diferencias demostradas hasta ahora son por mercado/producto o plataforma de trading (por ejemplo MT5), no por un challenge concreto. Si aparece un caso comprobado, añadir una tabla de excepción específica con FK real y precedencia superior. No usar un `scope_type` polimórfico con IDs sin FK.
4. Las cinco filas FundingPips `unknown` permanecen exactamente `unknown`; `source_url`/`verified_at` quedan NULL y `rule_basis='unspecified'`. No fabricar evidencia ni convertirlas a `available`. Si se requiere backfill técnico, solo aplicar ese valor por defecto, nunca un estado sustantivo.
5. RLS de la nueva tabla: SELECT público únicamente si la firma es pública/activa, escritura limitada a los mismos permisos administrativos que disponibilidad general o service role. Confirmar las políticas actuales antes de redactar SQL definitivo. No abrir INSERT/UPDATE/DELETE anónimos.

Precedencia de lectura futura: regla para challenge/variante (solo si se implementa y se identifica el plan) > regla de mercado > regla general. Una regla más específica `unknown` oculta una general `available` porque documenta una excepción no resuelta. Sin regla aplicable = `unknown`. Si el usuario no ha seleccionado mercado y hay reglas contradictorias entre mercados de la firma, mostrar “depende del producto”, no “disponible”. Nunca permitir que `available` general venza `restricted` específico.

El comparador actual **no** implementa esa precedencia: aplana estados por firma/país en `lib/comparison-data.ts` y `lib/preference-matches.ts`; el admin edita solo el mapa por firma/país en `app/admin/platforms/[id]/edit/page.tsx`. No modificar ninguno hasta aprobar el esquema y la semántica del país del usuario. Admin futuro: una tabla simple Firma · Mercado (o General) · País · Estado · Fuente · Verificado · Nota, con fecha de revisión visible y advertencia de antigüedad; no se construyó UI.

## Primer batch: 15 firmas/plataformas priorizadas

Las filas siguientes son **hallazgos de investigación, no datos cargados**. Cada enlace es oficial. Fecha de consulta de todas: 2026-09-18. Solo se señalan ejemplos concretos; ninguna lista es exhaustiva.

| Firma | Scope | País | Estado candidato | Tipo | Resumen y fuente oficial |
|---|---|---|---|---|---|
| FTMO | General CFD / confirmar alcance | VE | restricted | COUNTRY | La FAQ de elegibilidad incluye Venezuela entre países sin servicio. [FTMO](https://ftmo.com/en/faq/who-can-join-ftmo/). No extrapolar a FTMO Futures. |
| FundedNext | CFD | — | unknown | PRODUCT | La [lista CFD](https://help.fundednext.com/en/articles/8020080-are-any-countries-restricted-on-fundednext-cfds) es distinta de Futures; no se infiere `available` para LATAM por ausencia en la lista. |
| FundedNext Futures | Futures (plataforma separada en catálogo) | VE | restricted | PRODUCT/RESIDENCY | Venezuela figura entre países restringidos para comprar cuentas. [FundedNext Futures](https://helpfutures.fundednext.com/en/articles/14274473-are-any-countries-restricted-on-fundednext-futures). |
| FundingPips | General, residencia | AE | restricted | RESIDENCY | No acepta residentes de EAU. [FundingPips](https://help.fundingpips.com/hc/en-us/articles/44390730743825-Get-Started). |
| Tradeify | General, residencia | EC | restricted | RESIDENCY | Ecuador figura en la lista de residencia permanente restringida. [Tradeify](https://help.tradeify.co/en/articles/10495888-rules-restricted-countries). |
| My Funded Futures | General / compra de cuentas | EC | restricted | COUNTRY | Ecuador figura en lista restringida; la fuente diferencia viaje, compra y ejecución de trades. [MFF](https://help.myfundedfutures.com/en/articles/8229993-restricted-countries-policy). |
| The5ers | General | VE | restricted | RESIDENCY | Venezuela figura entre territorios prohibidos. [The5ers](https://the5ers.com/terms-and-conditions/). |
| AlphaCapitalGroup | General | VE | restricted | RESIDENCY/NATIONALITY | No ofrece servicios a nacionales o residentes de Venezuela. [Alpha Capital](https://help.alphacapitalgroup.uk/en/articles/8775575-countries-with-limitations). |
| E8 Markets | Futures | PA | restricted | PRODUCT | Panamá figura en Futures, no en la lista Classic/Perpetuals. [E8 Markets](https://help.e8markets.com/en/articles/5514278-accepted-countries). No inferir `available` en Classic. |
| Lucid Trading | General Futures | EC | restricted | RESIDENCY/NATIONALITY | Ecuador figura para ciudadanos o residentes. [Lucid](https://support.lucidtrading.com/en/articles/11404636-restricted-countries). |
| FXIFY | General | NI | restricted | COUNTRY/RESIDENCY | Nicaragua figura en su FAQ de países no aceptados. [FXIFY](https://fxify.com/faqs/all-faqs/what-countries-are-accepted/). |
| Maven Trading | General | LC | restricted | COUNTRY | Santa Lucía figura en la lista oficial de países restringidos. [Maven](https://maventrading.com/). |
| BrightFunded | General | — | unknown | COUNTRY/PRODUCT | La [lista de challenges](https://help.brightfunded.com/en/articles/9286630-what-countries-are-restricted-at-brightfunded) no demuestra disponibilidad LATAM; [MT5](https://help.brightfunded.com/en/articles/10855521-what-trading-platform-does-brightfunded-offer) tiene límites adicionales para US/AE. |
| Alpha Futures | General Futures | VE | restricted | COUNTRY/LOCATION | Venezuela figura en lista; la fuente prohíbe también operar físicamente desde países listados durante viajes. [Alpha Futures](https://help.alpha-futures.com/en/articles/9523389-countries-with-limitations). |
| Top One Futures | General Futures | EC | restricted | RESIDENCY/NATIONALITY/LOCATION | Ecuador figura para ciudadanía o residencia; también limita trading durante viajes a países restringidos. [Top One Futures](https://help.toponefutures.com/en/articles/11021644-countries-with-limitations-and-restrictions). |

El caso E8 demuestra por qué `platform + country` es insuficiente. Los casos BrightFunded MT5, FundingPips MT5, Top One Futures y Alpha Futures demuestran que algunas reglas son de plataforma técnica o presencia física; el MVP de mercado no las debe convertir en restricciones generales. Los estados candidatos requieren revisión humana y alcance acordado antes de cualquier seed.

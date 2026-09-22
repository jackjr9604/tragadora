# Disponibilidad geográfica — batch 01 para revisión

Fecha de verificación de Tragadora: **2026-09-18**. Investigación y contraste remoto realizados en modo de solo lectura. El SQL asociado **no ha sido ejecutado**.

## Firmas y fuentes oficiales revisadas

| Firma | Slug | Fuente oficial | Resultado para este batch |
|---|---|---|---|
| FTMO | `ftmo` | https://ftmo.com/en/faq/who-can-join-ftmo/ | Restricciones LATAM/Caribe representables: LC y VE. |
| FundedNext | `fundednext` | https://help.fundednext.com/en/articles/8020080-are-any-countries-restricted-on-fundednext-cfds | AG, BZ y GD se incorporan como restricciones específicas de CFD después de preparar el catálogo. No se infiere disponibilidad. |
| FundedNext Futures | `fundednextfutures` | https://helpfutures.fundednext.com/en/articles/14274473-are-any-countries-restricted-on-fundednext-futures | VE restringido para residentes que compran cuentas Futures. |
| FundingPips | `fundingpips` | https://help.fundingpips.com/hc/en-us/articles/44390730743825-Get-Started | AE restringido por residencia. Las cinco filas LATAM legacy no quedan resueltas por esta fuente. |
| Tradeify | `tradeify` | https://help.tradeify.co/en/articles/10495888-rules-restricted-countries | EC, NI, PA y VE restringidos por residencia permanente. |
| My Funded Futures | `myfundedfutures` | https://help.myfundedfutures.com/en/articles/8229993-restricted-countries-policy | EC, NI, PA y VE están en la lista; la fuente distingue viaje de compra/reset, pero no define limpiamente nacionalidad frente a residencia. |
| The5ers | `the5ers` | https://the5ers.com/terms-and-conditions/ | VE es territorio prohibido y la elegibilidad se expresa por residencia. |
| AlphaCapitalGroup | `alpha-capital-group` | https://help.alphacapitalgroup.uk/en/articles/8775575-countries-with-limitations | VE restringido para nacionales **o** residentes. |
| E8 Markets | `e8markets` | https://help.e8markets.com/en/articles/5514278-accepted-countries | NI y VE restringidos en Classic/Perpetuals y Futures; PA solo en Futures. |
| Lucid Trading | `lucid-trading` | https://support.lucidtrading.com/en/articles/11404636-restricted-countries | EC, NI, PA y VE restringidos para ciudadanos **o** residentes. |
| FXIFY | `fxify` | https://fxify.com/faqs/all-faqs/what-countries-are-accepted/ | NI y VE figuran como países no aceptados; la redacción no aísla un único criterio. |
| Maven Trading | `maven-trading` | https://maventrading.com/ | LC y VE figuran en la lista oficial de países restringidos. |
| BrightFunded | `brightfunded` | https://help.brightfunded.com/en/articles/9286630-what-countries-are-restricted-at-brightfunded | CU se incorpora como restricción general de residencia o nacionalidad después de preparar el catálogo. No se infiere disponibilidad para los demás. |
| Alpha Futures | `alpha-futures` | https://help.alpha-futures.com/en/articles/9523389-countries-with-limitations | VE restringido; la fuente combina ciudadanía, residencia y presencia física durante viajes. |
| Top One Futures | `toponefutures` | https://help.toponefutures.com/en/articles/11021644-countries-with-limitations-and-restrictions | EC, NI, PA y VE restringidos; la fuente combina ciudadanía, residencia y presencia física. |

## Reglas propuestas

Todas las filas son `restricted`. `verified_at` representa la verificación de Tragadora, no la fecha de vigencia de la regla.

| Firma | Market | País | Status | Restriction basis | Rule summary | Source URL | Verified at |
|---|---|---:|---|---|---|---|---|
| FTMO | General | LC | restricted | unspecified | FTMO incluye Santa Lucía entre los países a cuyos clientes no presta servicios. | https://ftmo.com/en/faq/who-can-join-ftmo/ | 2026-09-18 |
| FTMO | General | VE | restricted | unspecified | FTMO incluye Venezuela entre los países a cuyos clientes no presta servicios. | https://ftmo.com/en/faq/who-can-join-ftmo/ | 2026-09-18 |
| FundedNext Futures | futures | VE | restricted | residence | Los residentes de Venezuela no pueden comprar cuentas de FundedNext Futures. | https://helpfutures.fundednext.com/en/articles/14274473-are-any-countries-restricted-on-fundednext-futures | 2026-09-18 |
| FundingPips | General | AE | restricted | residence | FundingPips no acepta traders residentes en Emiratos Árabes Unidos. | https://help.fundingpips.com/hc/en-us/articles/44390730743825-Get-Started | 2026-09-18 |
| Tradeify | General | EC | restricted | residence | Tradeify restringe el acceso a residentes permanentes de Ecuador. | https://help.tradeify.co/en/articles/10495888-rules-restricted-countries | 2026-09-18 |
| Tradeify | General | NI | restricted | residence | Tradeify restringe el acceso a residentes permanentes de Nicaragua. | https://help.tradeify.co/en/articles/10495888-rules-restricted-countries | 2026-09-18 |
| Tradeify | General | PA | restricted | residence | Tradeify restringe el acceso a residentes permanentes de Panamá. | https://help.tradeify.co/en/articles/10495888-rules-restricted-countries | 2026-09-18 |
| Tradeify | General | VE | restricted | residence | Tradeify restringe el acceso a residentes permanentes de Venezuela. | https://help.tradeify.co/en/articles/10495888-rules-restricted-countries | 2026-09-18 |
| My Funded Futures | General | EC | restricted | unspecified | Ecuador figura en la lista oficial de países restringidos de My Funded Futures. | https://help.myfundedfutures.com/en/articles/8229993-restricted-countries-policy | 2026-09-18 |
| My Funded Futures | General | NI | restricted | unspecified | Nicaragua figura en la lista oficial de países restringidos de My Funded Futures. | https://help.myfundedfutures.com/en/articles/8229993-restricted-countries-policy | 2026-09-18 |
| My Funded Futures | General | PA | restricted | unspecified | Panamá figura en la lista oficial de países restringidos de My Funded Futures. | https://help.myfundedfutures.com/en/articles/8229993-restricted-countries-policy | 2026-09-18 |
| My Funded Futures | General | VE | restricted | unspecified | Venezuela figura en la lista oficial de países restringidos de My Funded Futures. | https://help.myfundedfutures.com/en/articles/8229993-restricted-countries-policy | 2026-09-18 |
| The5ers | General | VE | restricted | residence | La elegibilidad de The5ers excluye a residentes de Venezuela. | https://the5ers.com/terms-and-conditions/ | 2026-09-18 |
| AlphaCapitalGroup | General | VE | restricted | unspecified | Alpha Capital Group no presta servicios a nacionales o residentes de Venezuela. | https://help.alphacapitalgroup.uk/en/articles/8775575-countries-with-limitations | 2026-09-18 |
| E8 Markets | cfd | NI | restricted | unspecified | Nicaragua figura en la lista restringida de E8 Classic Markets. | https://help.e8markets.com/en/articles/5514278-accepted-countries | 2026-09-18 |
| E8 Markets | crypto | NI | restricted | unspecified | Nicaragua figura en la lista restringida de E8 Perpetuals. | https://help.e8markets.com/en/articles/5514278-accepted-countries | 2026-09-18 |
| E8 Markets | futures | NI | restricted | unspecified | Nicaragua figura en la lista restringida de E8 Futures. | https://help.e8markets.com/en/articles/5514278-accepted-countries | 2026-09-18 |
| E8 Markets | futures | PA | restricted | unspecified | Panamá figura en la lista restringida de E8 Futures, no en Classic/Perpetuals. | https://help.e8markets.com/en/articles/5514278-accepted-countries | 2026-09-18 |
| E8 Markets | cfd | VE | restricted | unspecified | Venezuela figura en la lista restringida de E8 Classic Markets. | https://help.e8markets.com/en/articles/5514278-accepted-countries | 2026-09-18 |
| E8 Markets | crypto | VE | restricted | unspecified | Venezuela figura en la lista restringida de E8 Perpetuals. | https://help.e8markets.com/en/articles/5514278-accepted-countries | 2026-09-18 |
| E8 Markets | futures | VE | restricted | unspecified | Venezuela figura en la lista restringida de E8 Futures. | https://help.e8markets.com/en/articles/5514278-accepted-countries | 2026-09-18 |
| Lucid Trading | futures | EC | restricted | unspecified | Lucid no admite ciudadanos o residentes de Ecuador. | https://support.lucidtrading.com/en/articles/11404636-restricted-countries | 2026-09-18 |
| Lucid Trading | futures | NI | restricted | unspecified | Lucid no admite ciudadanos o residentes de Nicaragua. | https://support.lucidtrading.com/en/articles/11404636-restricted-countries | 2026-09-18 |
| Lucid Trading | futures | PA | restricted | unspecified | Lucid no admite ciudadanos o residentes de Panamá. | https://support.lucidtrading.com/en/articles/11404636-restricted-countries | 2026-09-18 |
| Lucid Trading | futures | VE | restricted | unspecified | Lucid no admite ciudadanos o residentes de Venezuela. | https://support.lucidtrading.com/en/articles/11404636-restricted-countries | 2026-09-18 |
| FXIFY | General | NI | restricted | unspecified | Nicaragua figura entre los países no aceptados por FXIFY. | https://fxify.com/faqs/all-faqs/what-countries-are-accepted/ | 2026-09-18 |
| FXIFY | General | VE | restricted | unspecified | Venezuela figura entre los países no aceptados por FXIFY. | https://fxify.com/faqs/all-faqs/what-countries-are-accepted/ | 2026-09-18 |
| Maven Trading | General | LC | restricted | unspecified | Santa Lucía figura en la lista oficial de países restringidos de Maven. | https://maventrading.com/ | 2026-09-18 |
| Maven Trading | General | VE | restricted | unspecified | Venezuela figura en la lista oficial de países restringidos de Maven. | https://maventrading.com/ | 2026-09-18 |
| Alpha Futures | futures | VE | restricted | unspecified | Alpha Futures restringe Venezuela por ciudadanía/residencia y también impide operar físicamente desde allí. | https://help.alpha-futures.com/en/articles/9523389-countries-with-limitations | 2026-09-18 |
| Top One Futures | futures | EC | restricted | unspecified | Top One Futures restringe Ecuador por ciudadanía/residencia y también por ubicación física al operar. | https://help.toponefutures.com/en/articles/11021644-countries-with-limitations-and-restrictions | 2026-09-18 |
| Top One Futures | futures | NI | restricted | unspecified | Top One Futures restringe Nicaragua por ciudadanía/residencia y también por ubicación física al operar. | https://help.toponefutures.com/en/articles/11021644-countries-with-limitations-and-restrictions | 2026-09-18 |
| Top One Futures | futures | PA | restricted | unspecified | Top One Futures restringe Panamá por ciudadanía/residencia y también por ubicación física al operar. | https://help.toponefutures.com/en/articles/11021644-countries-with-limitations-and-restrictions | 2026-09-18 |
| Top One Futures | futures | VE | restricted | unspecified | Top One Futures restringe Venezuela por ciudadanía/residencia y también por ubicación física al operar. | https://help.toponefutures.com/en/articles/11021644-countries-with-limitations-and-restrictions | 2026-09-18 |

## Casos ambiguos y límites del catálogo

- `restriction_basis` solo admite un valor. Cuando la fuente usa “ciudadano **o** residente” o combina identidad con ubicación física, se usa `unspecified`; asignar solo `residence` o `nationality` cambiaría la regla.
- E8 determina el país con documentos de verificación y no por ubicación actual. Como acepta pasaporte, ID, licencia o permiso de residencia, se conserva `unspecified`.
- My Funded Futures permite operar durante viajes, pero restringe compra/reset en el país visitado. La lista no expresa de forma inequívoca si “from” significa residencia o nacionalidad; se conserva `unspecified`.
- FTMO usa “clients in” para su lista de riesgo empresarial; se conserva `unspecified`. Las regiones ucranianas no se reducen a `UA`.
- `countries` no contiene, entre otros, Cuba, Guyana, Belize, Grenada, Antigua and Barbuda, Haiti, Jamaica, Suriname ni varios territorios. No se sustituyen por el país soberano ni se inventan códigos.
- El catálogo sí distingue Gibraltar (`GI`) de Reino Unido (`GB`), confirmando que no debe colapsarse un territorio en otro país.
- BrightFunded incorpora CU en el batch ampliado; la ausencia de otros países LATAM en la lista no equivale a `available`.
- FundedNext CFD incorpora AG, BZ y GD como reglas `cfd`; no se crea disponibilidad por complemento.

## Legacy de FundingPips

Las filas generales `AR`, `BR`, `CO`, `EC` y `GT` continúan en `unknown`, sin evidencia. La fuente oficial actual solo confirma residentes de Irán, Vietnam y Emiratos Árabes Unidos como restringidos. Por tanto, el único alta propuesta para FundingPips es `AE / General / restricted / residence`; no se actualiza ninguna fila legacy.

## Preview

| Métrica | Cantidad |
|---|---:|
| Firmas investigadas | 15 |
| Firmas con reglas propuestas | 15 |
| Firmas sin fila por falta de representación/evidencia concluyente | 0 |
| Reglas propuestas | 93 |
| `restricted` | 93 |
| `available` | 0 |
| Filas `unknown` nuevas | 0 |
| Reglas generales | 45 |
| Reglas específicas por market | 48 |
| `residence` | 17 |
| `nationality` | 0 |
| `physical_location` | 0 |
| `unspecified` | 76 |

El SQL preparado está en `supabase/seeds/prop-firms/20260918_geography_batch_01.sql`. Valida las 15 firmas, países, mercados, duplicados, evidencia obligatoria y conflictos antes de insertar. Si encuentra una regla existente con estado, criterio o fuente distintos, aborta toda la transacción.

## Auditoría final de datos antes de ejecución

Revisión final realizada el 2026-09-18, sin escrituras remotas. Las 34 filas iniciales fueron contrastadas una por una con el seed y con la fuente oficial. Las 59 ampliaciones se revisaron nuevamente antes de incorporarlas. Las 93 coinciden en firma, slug, market, `country_code`, status, `restriction_basis`, URL, fecha y resumen.

### Revisión de los `unspecified`

La tabla siguiente contiene las 27 reglas cuya clasificación requería revisión. En todos los casos se conserva `unspecified`: asignar un único criterio afirmaría más de lo que dice la fuente.

| Firma | País | Market | Basis actual | Basis revisado | Fuente | Motivo |
|---|---:|---|---|---|---|---|
| FTMO | LC | General | unspecified | unspecified | https://ftmo.com/en/faq/who-can-join-ftmo/ | Usa “clients in”; no define residencia, nacionalidad ni ubicación. |
| FTMO | VE | General | unspecified | unspecified | https://ftmo.com/en/faq/who-can-join-ftmo/ | Usa “clients in”; no define residencia, nacionalidad ni ubicación. |
| My Funded Futures | EC | General | unspecified | unspecified | https://help.myfundedfutures.com/en/articles/8229993-restricted-countries-policy | Usa “traders from”; además diferencia viaje, compra y trading sin aislar residencia o nacionalidad. |
| My Funded Futures | NI | General | unspecified | unspecified | https://help.myfundedfutures.com/en/articles/8229993-restricted-countries-policy | Usa “traders from”; además diferencia viaje, compra y trading sin aislar residencia o nacionalidad. |
| My Funded Futures | PA | General | unspecified | unspecified | https://help.myfundedfutures.com/en/articles/8229993-restricted-countries-policy | Usa “traders from”; además diferencia viaje, compra y trading sin aislar residencia o nacionalidad. |
| My Funded Futures | VE | General | unspecified | unspecified | https://help.myfundedfutures.com/en/articles/8229993-restricted-countries-policy | Usa “traders from”; además diferencia viaje, compra y trading sin aislar residencia o nacionalidad. |
| AlphaCapitalGroup | VE | General | unspecified | unspecified | https://help.alphacapitalgroup.uk/en/articles/8775575-countries-with-limitations | La regla aplica a nacionales **o** residentes. |
| E8 Markets | NI | cfd | unspecified | unspecified | https://help.e8markets.com/en/articles/5514278-accepted-countries | El país se determina por documentos KYC que pueden acreditar identidad o residencia, no por ubicación actual. |
| E8 Markets | NI | crypto | unspecified | unspecified | https://help.e8markets.com/en/articles/5514278-accepted-countries | El país se determina por documentos KYC que pueden acreditar identidad o residencia, no por ubicación actual. |
| E8 Markets | NI | futures | unspecified | unspecified | https://help.e8markets.com/en/articles/5514278-accepted-countries | El país se determina por documentos KYC que pueden acreditar identidad o residencia, no por ubicación actual. |
| E8 Markets | PA | futures | unspecified | unspecified | https://help.e8markets.com/en/articles/5514278-accepted-countries | El país se determina por documentos KYC que pueden acreditar identidad o residencia, no por ubicación actual. |
| E8 Markets | VE | cfd | unspecified | unspecified | https://help.e8markets.com/en/articles/5514278-accepted-countries | El país se determina por documentos KYC que pueden acreditar identidad o residencia, no por ubicación actual. |
| E8 Markets | VE | crypto | unspecified | unspecified | https://help.e8markets.com/en/articles/5514278-accepted-countries | El país se determina por documentos KYC que pueden acreditar identidad o residencia, no por ubicación actual. |
| E8 Markets | VE | futures | unspecified | unspecified | https://help.e8markets.com/en/articles/5514278-accepted-countries | El país se determina por documentos KYC que pueden acreditar identidad o residencia, no por ubicación actual. |
| Lucid Trading | EC | futures | unspecified | unspecified | https://support.lucidtrading.com/en/articles/11404636-restricted-countries | La regla aplica a ciudadanos **o** residentes. |
| Lucid Trading | NI | futures | unspecified | unspecified | https://support.lucidtrading.com/en/articles/11404636-restricted-countries | La regla aplica a ciudadanos **o** residentes. |
| Lucid Trading | PA | futures | unspecified | unspecified | https://support.lucidtrading.com/en/articles/11404636-restricted-countries | La regla aplica a ciudadanos **o** residentes. |
| Lucid Trading | VE | futures | unspecified | unspecified | https://support.lucidtrading.com/en/articles/11404636-restricted-countries | La regla aplica a ciudadanos **o** residentes. |
| FXIFY | NI | General | unspecified | unspecified | https://fxify.com/faqs/all-faqs/what-countries-are-accepted/ | Dice país prohibido y “country you are based in”, sin definir de forma segura residencia o ubicación física. |
| FXIFY | VE | General | unspecified | unspecified | https://fxify.com/faqs/all-faqs/what-countries-are-accepted/ | Dice país prohibido y “country you are based in”, sin definir de forma segura residencia o ubicación física. |
| Maven Trading | LC | General | unspecified | unspecified | https://maventrading.com/ | Publica una lista “Restricted Countries” sin criterio individual explícito. |
| Maven Trading | VE | General | unspecified | unspecified | https://maventrading.com/ | Publica una lista “Restricted Countries” sin criterio individual explícito. |
| Alpha Futures | VE | futures | unspecified | unspecified | https://help.alpha-futures.com/en/articles/9523389-countries-with-limitations | Combina ciudadanía, residencia y presencia física durante viajes. |
| Top One Futures | EC | futures | unspecified | unspecified | https://help.toponefutures.com/en/articles/11021644-countries-with-limitations-and-restrictions | Combina ciudadanía/residencia con prohibición de operar físicamente desde el país. |
| Top One Futures | NI | futures | unspecified | unspecified | https://help.toponefutures.com/en/articles/11021644-countries-with-limitations-and-restrictions | Combina ciudadanía/residencia con prohibición de operar físicamente desde el país. |
| Top One Futures | PA | futures | unspecified | unspecified | https://help.toponefutures.com/en/articles/11021644-countries-with-limitations-and-restrictions | Combina ciudadanía/residencia con prohibición de operar físicamente desde el país. |
| Top One Futures | VE | futures | unspecified | unspecified | https://help.toponefutures.com/en/articles/11021644-countries-with-limitations-and-restrictions | Combina ciudadanía/residencia con prohibición de operar físicamente desde el país. |

Las siete reglas `residence` también fueron reconfirmadas: FundedNext Futures/VE, FundingPips/AE, Tradeify/EC, Tradeify/NI, Tradeify/PA, Tradeify/VE y The5ers/VE. Las fuentes usan expresamente `resident`, `residents`, `residing` o residencia permanente.

### Ampliación incorporada al batch

Las 59 reglas que antes no podían representarse sí corresponden a 59 identidades distintas. No se comprimieron en reglas generales cuando la fuente diferencia mercados. El detalle individual —incluidos resumen, URL y fecha— está en el SQL; esta tabla agrupa únicamente filas con firma, market, basis y fuente idénticos.

| Firma | Países | Market | Basis | Filas | Fuente |
|---|---|---|---|---:|---|
| FTMO | AG, BZ, CU, DM, GD, KN, VC, SR | General | unspecified | 8 | https://ftmo.com/en/faq/who-can-join-ftmo/ |
| FundedNext | AG, BZ, GD | cfd | unspecified | 3 | https://help.fundednext.com/en/articles/8020080-are-any-countries-restricted-on-fundednext-cfds |
| FundedNext Futures | AG, BZ, CU, GD | futures | residence | 4 | https://helpfutures.fundednext.com/en/articles/14274473-are-any-countries-restricted-on-fundednext-futures |
| Tradeify | BS, BB, CU, JM, TT | General | residence | 5 | https://help.tradeify.co/en/articles/10495888-rules-restricted-countries |
| My Funded Futures | BS, BB, CU, GY, HT, JM, TT | General | unspecified | 7 | https://help.myfundedfutures.com/en/articles/8229993-restricted-countries-policy |
| The5ers | CU | General | residence | 1 | https://the5ers.com/terms-and-conditions/ |
| AlphaCapitalGroup | CU | General | unspecified | 1 | https://help.alphacapitalgroup.uk/en/articles/8775575-countries-with-limitations |
| E8 Markets | CU | cfd | unspecified | 1 | https://help.e8markets.com/en/articles/5514278-accepted-countries |
| E8 Markets | CU | crypto | unspecified | 1 | https://help.e8markets.com/en/articles/5514278-accepted-countries |
| E8 Markets | BS, BB, CU, HT, JM, TT | futures | unspecified | 6 | https://help.e8markets.com/en/articles/5514278-accepted-countries |
| Lucid Trading | BS, BB, BZ, CU, HT, JM, TT | futures | unspecified | 7 | https://support.lucidtrading.com/en/articles/11404636-restricted-countries |
| FXIFY | CU, HT | General | unspecified | 2 | https://fxify.com/faqs/all-faqs/what-countries-are-accepted/ |
| Maven Trading | CU, GY, HT | General | unspecified | 3 | https://maventrading.com/ |
| BrightFunded | CU | General | unspecified | 1 | https://help.brightfunded.com/en/articles/9286630-what-countries-are-restricted-at-brightfunded |
| Alpha Futures | CU, HT, JM | futures | unspecified | 3 | https://help.alpha-futures.com/en/articles/9523389-countries-with-limitations |
| Top One Futures | BS, BB, CU, HT, JM, TT | futures | unspecified | 6 | https://help.toponefutures.com/en/articles/11021644-countries-with-limitations-and-restrictions |

Las ampliaciones añaden 10 reglas `residence` y 49 `unspecified`. Sumadas al bloque inicial, el batch contiene 17 `residence` y 76 `unspecified`.

### Estados soberanos preparados para `countries`

La consulta remota confirmó que ninguno existe. La taxonomía actual usa exactamente `Africa`, `Asia`, `Caribbean`, `Europe`, `LATAM`, `Middle East`, `North America` y `Oceania`. Los países continentales vecinos de Belice, Guyana y Surinam usan `LATAM`; Santa Lucía usa `Caribbean`. `flag` se deja `NULL`, como todo el bloque LATAM actual, porque el frontend genera la bandera desde el código ISO.

| Code | Nombre | Region | Ya existe | Acción |
|---|---|---|---|---|
| AG | Antigua y Barbuda | Caribbean | No | Insertar |
| BS | Bahamas | Caribbean | No | Insertar |
| BB | Barbados | Caribbean | No | Insertar |
| BZ | Belice | LATAM | No | Insertar |
| CU | Cuba | Caribbean | No | Insertar |
| DM | Dominica | Caribbean | No | Insertar |
| GD | Granada | Caribbean | No | Insertar |
| GY | Guyana | LATAM | No | Insertar |
| HT | Haití | Caribbean | No | Insertar |
| JM | Jamaica | Caribbean | No | Insertar |
| KN | San Cristóbal y Nieves | Caribbean | No | Insertar |
| VC | San Vicente y las Granadinas | Caribbean | No | Insertar |
| SR | Surinam | LATAM | No | Insertar |
| TT | Trinidad y Tobago | Caribbean | No | Insertar |

El SQL idempotente está en `supabase/seeds/countries/20260918_missing_latam_countries.sql`. No actualiza países existentes: si un código aparece con nombre, región o flag diferentes antes de ejecutarlo, aborta la transacción y reporta el conflicto.

El pre-check read-only reproducible está en `scripts/sql/missing-latam-countries-precheck.sql`.

### Territorios, dependencias o regiones no representables

- `AI` — Anguila, territorio británico de ultramar; aparece en FTMO.
- `BL` — San Bartolomé, colectividad francesa de ultramar; aparece en FTMO.
- “Corsica & non-mainland islands” — calificador territorial dentro de Francia en My Funded Futures; no debe convertirse en una restricción general `FR`.
- Las fuentes también contienen regiones sancionadas o disputadas como Crimea, Sevastopol, Donetsk, Kherson, Luhansk y Zaporizhzhia. No deben reducirse silenciosamente al país completo.
- Otras dependencias globales de las listas —por ejemplo Bouvet Island, Cook Islands y Midway Islands— quedan fuera del alcance LATAM de este batch y requieren una decisión de catálogo separada.

### Evidencia LATAM/Caribe recuperada al preparar el catálogo

La tabla conserva el inventario que motivó la ampliación. Las 59 identidades soberanas ya están incorporadas al SQL geográfico y serán válidas después de ejecutar primero el seed de países. Los códigos enumerados son exactos; no se sustituyen por otro país.

| Firma | País/territorio | Regla | Market | Fuente | Motivo de omisión |
|---|---|---|---|---|---|
| FTMO | AG, BZ, CU, DM, GD, KN, VC, SR | Clientes del país sin servicio | General | https://ftmo.com/en/faq/who-can-join-ftmo/ | Estados soberanos ausentes de `countries`. |
| FTMO | AI, BL | Clientes del territorio sin servicio | General | https://ftmo.com/en/faq/who-can-join-ftmo/ | Territorios ausentes y política de representación pendiente. |
| FundedNext | AG, BZ, GD | Residentes o ciudadanos sin acceso | cfd | https://help.fundednext.com/en/articles/8020080-are-any-countries-restricted-on-fundednext-cfds | Estados soberanos ausentes de `countries`. |
| FundedNext Futures | AG, BZ, CU, GD | Residentes sin compra de cuentas | futures | https://helpfutures.fundednext.com/en/articles/14274473-are-any-countries-restricted-on-fundednext-futures | Estados soberanos ausentes de `countries`. |
| Tradeify | BS, BB, CU, JM, TT | Residencia permanente restringida | General | https://help.tradeify.co/en/articles/10495888-rules-restricted-countries | Estados soberanos ausentes de `countries`. |
| My Funded Futures | BS, BB, CU, GY, HT, JM, TT | País incluido en lista restringida | General | https://help.myfundedfutures.com/en/articles/8229993-restricted-countries-policy | Estados soberanos ausentes de `countries`. |
| My Funded Futures | Córcega e islas francesas no continentales | Restricción territorial parcial | General | https://help.myfundedfutures.com/en/articles/8229993-restricted-countries-policy | No puede representarse como `FR` sin ampliar incorrectamente la regla. |
| The5ers | CU | Residencia en territorio prohibido | General | https://the5ers.com/terms-and-conditions/ | Estado soberano ausente de `countries`. |
| AlphaCapitalGroup | CU | Nacionales o residentes sin servicio | General | https://help.alphacapitalgroup.uk/en/articles/8775575-countries-with-limitations | Estado soberano ausente de `countries`. |
| E8 Markets | CU | País restringido en Classic/Perpetuals | cfd, crypto | https://help.e8markets.com/en/articles/5514278-accepted-countries | Estado soberano ausente; produciría dos reglas market-specific. |
| E8 Markets | BS, BB, CU, HT, JM, TT | País restringido en Futures | futures | https://help.e8markets.com/en/articles/5514278-accepted-countries | Estados soberanos ausentes de `countries`. |
| Lucid Trading | BS, BB, BZ, CU, HT, JM, TT | Ciudadanos o residentes no elegibles | futures | https://support.lucidtrading.com/en/articles/11404636-restricted-countries | Estados soberanos ausentes de `countries`. |
| FXIFY | CU, HT | País no aceptado | General | https://fxify.com/faqs/all-faqs/what-countries-are-accepted/ | Estados soberanos ausentes de `countries`. |
| Maven Trading | CU, GY, HT | País restringido | General | https://maventrading.com/ | Estados soberanos ausentes de `countries`. |
| BrightFunded | CU | Residencia o nacionalidad restringida | General | https://help.brightfunded.com/en/articles/9286630-what-countries-are-restricted-at-brightfunded | Estado soberano ausente; es la razón exacta por la que BrightFunded no tiene fila. |
| Alpha Futures | CU, HT, JM | Ciudadanía/residencia y presencia física restringidas | futures | https://help.alpha-futures.com/en/articles/9523389-countries-with-limitations | Estados soberanos ausentes de `countries`. |
| Top One Futures | BS, BB, CU, HT, JM, TT | Ciudadanía/residencia y presencia física restringidas | futures | https://help.toponefutures.com/en/articles/11021644-countries-with-limitations-and-restrictions | Estados soberanos ausentes de `countries`. |

Esto representa **59 hechos firma-market sobre estados soberanos**, ahora incorporados, y **3 hechos o calificadores territoriales** que siguen fuera. No es un inventario global de todas las restricciones publicadas: está limitado a la cobertura LATAM/Caribe priorizada por el batch.

### FundedNext CFD y BrightFunded

- **FundedNext CFD:** sus restricciones oficiales AG, BZ y GD están incorporadas como tres reglas `cfd` con basis `unspecified`, porque la fuente mezcla residencia y ciudadanía.
- **BrightFunded:** su restricción oficial de Cuba está incorporada como regla general `unspecified`, porque aplica a residencia o nacionalidad. No se crea `available` para ningún otro país.

### Contradicciones y fuentes

- No hay dos filas con la misma identidad `platform + country + market`.
- No hay combinaciones general/específica contradictorias en el seed.
- E8 usa únicamente reglas específicas: NI y VE en los tres markets registrados; PA solo en Futures. Esa diferencia es intencional y está respaldada por la fuente.
- Las demás reglas generales pertenecen a plataformas cuyo alcance completo está cubierto por la fuente; las plataformas únicamente Futures pueden usar General cuando la regla aplica a toda la firma.
- 13 firmas usan URL directa de FAQ, Help Center o Terms. Maven usa la homepage oficial porque allí está publicada la lista y no se encontró una página oficial específica equivalente.
- Las 93 fechas son `2026-09-18 00:00:00+00`, fecha de verificación de Tragadora, no fecha de publicación.
- Los 93 resúmenes son breves y parafraseados. Los específicos de mercado mencionan el alcance relevante.

### Simulación read-only de los seeds preparados

Estado remoto observado antes de ejecutar: ninguno de los 14 países existe y solo están las cinco filas generales `unknown` de FundingPips (`AR`, `BR`, `CO`, `EC`, `GT`) dentro de las 15 firmas. El orden simulado es: seed de países y después geography batch 01.

| Resultado | Cantidad |
|---|---:|
| Países nuevos | 14 |
| Países ya existentes | 0 |
| Conflictos de países | 0 |
| Reglas geográficas nuevas | 93 |
| Filas actualizadas | 0 |
| Filas sin cambio | 0 |
| Conflictos | 0 |
| Filas propuestas omitidas por el SQL | 0 |
| Hechos soberanos LATAM/Caribe todavía omitidos | 0 |
| Hechos/calificadores territoriales todavía omitidos | 3 |
| Legacy FundingPips preservadas | 5 |

El seed aborta la transacción si el estado remoto cambia y aparece una regla con distinta fuente, estado o criterio antes de ejecutarlo.

### Impacto en el comparador

El resolver solo convierte en exclusión una regla concluyente cuyo basis sea `residence`. `nationality`, `physical_location` y `unspecified` regresan `unknown` con advertencia.

| Efecto | Reglas |
|---|---:|
| Excluirían por residencia | 17 |
| Advertencia por nacionalidad | 0 |
| Advertencia por ubicación física | 0 |
| Advertencia por criterio no confirmado | 76 |

### Recomendación final

Ejecutar primero `supabase/seeds/countries/20260918_missing_latam_countries.sql` y, solo después de verificar sus 14 filas, ejecutar el geography batch ampliado. Los territorios y regiones permanecen pendientes hasta definir su política de catálogo.

El geography batch quedó ampliado a 93 reglas y no debe ejecutarse antes del seed de países. Ninguno de los dos archivos se ejecutó remotamente.

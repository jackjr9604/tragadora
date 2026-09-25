begin;

-- Base inicial editable. Reejecutar actualiza por slug; no se ejecuta al iniciar la app.
insert into public.documentation_articles
  (slug,title,excerpt,section,subsection,audience,body_markdown,sort_order,status)
values
('que-es-tragadora','Qué es Tragadora','Alcance, propósito y tipos de información.','Introducción',null,'general',$md$
## Propósito
Tradagora organiza información comparativa sobre Prop Firms, brokers, exchanges, ofertas, herramientas y payouts. El Admin mantiene los catálogos; las páginas públicas presentan solo datos publicados.
## Capas de información
- **Datos propios:** registros administrados en Supabase y evidencias individuales recopiladas por collectors propios.
- **Fuentes externas:** métricas atribuidas a su fuente y separadas de los payouts verificados por Tradagora.
- **Afiliación:** `/go/[slug]` resuelve enlaces activos y registra clics; no cambia el orden ni inventa resultados.
## Arquitectura
Next.js App Router renderiza páginas públicas y administrativas. Supabase aporta Auth, Postgres y RLS. Los collectors viven en rutas API o scripts, no en la interfaz pública.
$md$,10,'published'),
('primeros-pasos-admin','Primeros pasos en el Admin','Acceso, navegación, permisos y estados.','Primeros pasos',null,'admin',$md$
## Acceso y navegación
El acceso comienza en `/login`. El menú solo muestra módulos cuyo permiso `*.view` posee el usuario.
## Permisos
`super_admin` obtiene todos los permisos válidos. Los demás roles combinan `role_permissions` con `user_permission_overrides`. Las operaciones también están protegidas por RLS.
## Estados
No existe un estado universal. Platforms usa `active`, `draft` o `inactive`; Blog, Herramientas, Comunidades y Giveaways usan `draft` o `published`; ofertas usan un booleano `status`. Revisa siempre el formulario del módulo.
$md$,20,'published'),
('prop-firms-administracion','Administrar Prop Firms','Modelo, relaciones y flujo de edición.','Prop Firms',null,'admin',$md$
## Modelo principal
Una firma es una fila de `platforms` con `type = prop_firm`. `prop_firm_details` amplía país, fundación y datos operativos. Logo y descripciones se relacionan con Media y traducciones.
## Relaciones
- `platform_markets`, instrumentos y plataformas de trading describen operación.
- `challenges` contiene programas; `account_plans` tamaños y precios.
- `challenge_phases` define reglas por fase; variantes y overrides viven en `challenge_variants` y `challenge_variant_phases`.
- `challenge_reward_options` describe alternativas de recompensa y retiro, no evidencia del Payout Tracker.
## Flujo
Crea la plataforma, completa datos verificables, asigna relaciones de catálogo y publica solo cuando la ficha esté lista. No inventes valores para sustituir datos desconocidos.
$md$,30,'published'),
('comparador','Comparador','Funcionamiento de comparación manual y recomendación.','Comparador',null,'admin',$md$
## Comparación manual
Permite seleccionar firmas y contrastar datos disponibles. Un valor `NULL` significa desconocido: nunca equivale a falso ni a una restricción.
## Comparar para mí
Evalúa preferencias contra datos modelados. Las prioridades orientan el matching; la ausencia de datos reduce certeza, pero no autoriza inventar compatibilidad.
## Geografía
Las restricciones por residencia pueden excluir. Nacionalidad y ubicación física no excluyen automáticamente; `unspecified` advierte. Una regla específica del mercado tiene precedencia sobre la general.
$md$,40,'published'),
('payouts','Payout Tracker','Fuentes, snapshots, períodos y consistencia.','Payouts',null,'admin',$md$
## Capas
`payouts` conserva evidencias individuales. `payout_sources` configura collectors. `payout_source_summary` agrega evidencias sin duplicarlas. `platform_payout_metrics` conserva snapshots externos por firma, fuente y período.
## Períodos
La interfaz utiliza 24h, 7d, 30d y all; otras fuentes pueden no cubrir todos los períodos. Los mappings enlazan nombres externos con plataformas mediante coincidencia explícita.
## MondoTraders
El script `scripts/collect-mondotraders.ts` valida columnas y métricas. Placeholders se tratan como datos faltantes. `SOURCE_ROW_INCONSISTENCY` omite la fila y preserva el snapshot current anterior; no reconstruye cifras.
## Reglas versus evidencia
Frecuencia o profit split de un challenge son reglas comerciales. Una transacción o métrica atribuida es evidencia de payout. No deben mezclarse.
$md$,50,'published'),
('ofertas','Ofertas','Creación, publicación y superficies públicas.','Ofertas',null,'admin',$md$
## Datos
Una oferta pertenece a una plataforma y opcionalmente a un challenge. Puede incluir descuento, código, cuenta gratis, fechas, `is_featured`, `hot_badge` y `short_highlight`.
## Presentación
Hot Offers, `GlobalOffersStrip` y el popup reutilizan ofertas activas y vigentes. El CTA comercial usa el flujo afiliado cuando corresponde.
## Criterio editorial
No inventes compras, urgencia ni social proof. Desactiva o fecha correctamente una promoción vencida.
$md$,60,'published'),
('affiliate-links','Affiliate Links','Resolución, prioridad y tracking.','Affiliate Links',null,'admin',$md$
## Configuración
Cada enlace relaciona plataforma, URL, campaña, país, idioma, prioridad y estado. Los criterios más específicos y prioritarios se resuelven antes que el fallback general.
## Ruta `/go/[slug]`
La ruta busca un enlace activo compatible y registra en `affiliate_clicks`. Si no existe, vuelve a la ficha interna; una oferta sin enlace no debe terminar en 404.
$md$,70,'published'),
('brokers','Brokers','Administración del catálogo de brokers.','Brokers',null,'admin',$md$
## Modelo
Un broker usa `platforms.type = broker` y `broker_details`. Administra país, fundación, mercados, plataformas, depósito mínimo, regulación, destacado y orden.
## Relaciones comerciales
Puede tener ofertas y affiliate links. Los enlaces externos públicos deben pasar por `/go/[slug]` cuando el flujo es comercial.
$md$,80,'published'),
('exchanges','Exchanges','Administración del catálogo de exchanges.','Exchanges',null,'admin',$md$
## Modelo
Un exchange usa `platforms.type = exchange` y `exchange_details`. El tipo puede ser `centralized` o `decentralized`; fiat support puede ser verdadero, falso o desconocido.
## Datos
Productos, regulación, destacado, orden, ofertas y afiliación se administran sin inferir datos ausentes.
$md$,90,'published'),
('herramientas','Herramientas','Catálogo y destinos internos o externos.','Herramientas',null,'admin',$md$
## Tipos
- `internal`: navega a `internal_path`.
- `external`: utiliza `external_url` y puede abrir otra pestaña.
- `coming_soon`: se muestra sin destino operativo.
## Regla importante
El catálogo vive en Supabase, pero la lógica de una herramienta interna debe existir en código bajo su ruta. Crear una fila no implementa la herramienta.
$md$,100,'published'),
('comunidades','Comunidades','Catálogo público de comunidades.','Comunidades',null,'admin',$md$
## Administración
Configura nombre, slug, tipo, idioma, región, categoría, logo, `join_url`, badge, destacado, orden y estado de publicación.
## Publicación
Usa enlaces de unión verificables y evita duplicar la misma comunidad por cambios menores de nombre.
$md$,110,'published'),
('blog','Blog y Markdown','Publicación editorial y sintaxis básica.','Blog',null,'admin',$md$
## Artículos
`blog_posts` contiene slug, título, extracto, Markdown, categoría, tags, cover, autor, destacado, estado y fecha de publicación.
## Markdown admitido
# Título
## Subtítulo
- elemento de lista
**texto en negrita**
[enlace](https://example.com)
El renderer no permite HTML arbitrario.
$md$,120,'published'),
('giveaways','Giveaways','Vigencia, participación y resultados.','Giveaways',null,'admin',$md$
## Configuración
Administra sponsor, premio, cantidad, inicio, final, URL de participación, reglas, destacado, reveal y estado.
## Tiempo y resultados
El countdown se calcula en la interfaz; no escribe cada segundo en la base. Al vencer, la UI puede mostrar Finalizado. Reveal e histórico se administran manualmente. Actualmente no existe selección automática de ganadores.
$md$,130,'published'),
('media','Media','Biblioteca y buenas prácticas.','Media',null,'admin',$md$
## Uso
Sube imágenes, asígnales categoría y texto alternativo, y selecciónalas con `MediaPicker` para logos o covers.
## Buenas prácticas
Reutiliza activos existentes y evita duplicados. Eliminar un archivo puede afectar todas las entidades que lo referencian.
$md$,140,'published'),
('home','Home','Bloques editables y fuentes de datos.','Home',null,'admin',$md$
## Composición
El Home combina firmas destacadas configurables, payouts, ofertas, metodología, finder y CTA final.
## Contenido
Parte del copy proviene de `site_content`; las firmas destacadas usan `home_featured_platforms`. Rankings y actividad se alimentan de sus loaders, no de texto hardcodeado en el editor.
$md$,150,'published'),
('geografia','Disponibilidad geográfica','Estados, precedencia y evidencia.','Geografía',null,'admin',$md$
## Estados y mercados
Los estados válidos son `available`, `restricted` y `unknown`. Market puede ser General, CFD, Futures, Crypto u Options. Una regla market-specific prevalece sobre la general.
## Interpretación
- `restricted`: no disponible para el criterio documentado.
- Lista completa y ausencia: puede inferirse disponibilidad según el resolver.
- Fuente incompleta y ausencia: Sin verificar.
`restriction_list_complete` solo debe marcarse con evidencia suficiente. Available/restricted requieren fuente y fecha verificadas.
$md$,160,'published'),
('usuarios-permisos','Usuarios y permisos','Roles, permisos, overrides y auditoría.','Admin y permisos',null,'technical',$md$
## Modelo
`profiles.role` admite `super_admin`, `admin`, `editor` y `user`. `admin_permissions` registra claves; `role_permissions` define presets y `user_permission_overrides` aplica excepciones.
## Evaluación
`has_admin_permission()` aplica la decisión efectiva. `super_admin` obtiene permisos válidos; otros roles no deben heredar acceso global por helpers antiguos.
## Seguridad
Cambios sensibles usan RPC seguras y audit log. No concedas permisos mediante cambios directos al frontend.
$md$,170,'published'),
('mantenimiento','Mantenimiento local','Comandos de desarrollo y validación.','Mantenimiento',null,'technical',$md$
## Comandos
- `npm run dev`: servidor local.
- `npx tsc --noEmit`: tipos sin emitir archivos.
- `npm run lint`: reglas de calidad.
- `npm run build`: compilación de producción.
- `git diff --check`: whitespace conflictivo.
Ejecuta las validaciones antes de entregar cambios. No ignores errores porque el modo dev siga renderizando.
$md$,180,'published'),
('git-deploy','Git y despliegue','Flujo básico sin secretos.','Mantenimiento','Git / Deploy','technical',$md$
## Flujo
1. `git status`
2. `git add` solo de archivos revisados
3. `git diff --cached`
4. `git commit`
5. `git push`
No incluyas `.env`, keys ni tokens. La rama `main` despliega según la infraestructura configurada; verifica el repositorio antes de afirmar un proveedor.
$md$,190,'published'),
('mondotraders','Operación de MondoTraders','Collector, workflow y diagnóstico.','Mantenimiento','MondoTraders','technical',$md$
## Collector
`npm run collect:mondo` ejecuta el collector. Existen modos `catalog:mondo` y `diagnose:mondo`. El workflow `.github/workflows/collect-mondotraders.yml` automatiza snapshots.
## Validaciones
Comprueba headers, métricas requeridas y consistencia `average ≈ amount/count`. Missing metrics y source inconsistencies se omiten sin crear ceros falsos ni archivar el snapshot válido anterior.
## Fallos
Revisa summary, warnings y logs del workflow. Nunca documentes ni pegues credenciales.
$md$,200,'published'),
('troubleshooting','Troubleshooting real','Errores frecuentes del proyecto.','Troubleshooting',null,'technical',$md$
## Schema cache y migraciones
`Could not find table/column in schema cache` suele indicar migración no aplicada o cache desactualizada. Confirma primero el schema remoto. Tras aplicar SQL correctamente puede usarse `notify pgrst, 'reload schema';`.
## RLS y autenticación
401 indica credencial ausente o inválida. `permission denied` o resultado vacío puede ser RLS; verifica sesión, policy y `has_admin_permission()` sin abrir acceso público.
## Red y build
`fetch failed` requiere revisar causa anidada, DNS y límites HTTP. Google Fonts puede fallar en build sin red. Cache/HMR corrupto se diagnostica reiniciando dev y limpiando solo artefactos generados seguros.
## SQL y relaciones
Errores de FK de countries o CHECK requieren comparar valores reales del catálogo/constraint. No crees FKs a ciegas para resolver embeds PostgREST.
## Git
Avisos LF/CRLF no equivalen a error de build; `git diff --check` detecta whitespace problemático.
$md$,210,'published'),
('conceptos','Conceptos de Tragadora','Glosario corto del modelo funcional.','Conceptos',null,'general',$md$
## Entidades
- **Prop Firm:** plataforma evaluada como firma de fondeo.
- **Broker / Exchange:** plataformas con detalles especializados.
- **Challenge:** programa de evaluación; **Phase:** reglas de una etapa; **Account Plan:** tamaño y precio.
- **Drawdown / Profit Target / Profit Split:** límites, objetivo y reparto modelados en challenges.
- **Payout:** pago o métrica de pago con una fuente.
- **Affiliate Link / Offer:** destino comercial y promoción.
- **Market / Instrument:** ámbito operativo y activo.
- **Geographic restriction:** regla documentada por país y criterio.
- **Snapshot / Source:** captura temporal y procedencia.
- **Featured:** prioridad editorial; **Draft / Published:** no publicado / publicado en módulos que usan esos estados.
$md$,220,'published'),
('arquitectura-tecnica','Arquitectura técnica resumida','Next.js, Supabase, RLS y caché.','Documentación técnica',null,'technical',$md$
## Next.js
El proyecto usa App Router. Server Components consultan datos y reducen JavaScript; Client Components se reservan para estado e interacción. Las páginas pueden ser estáticas, revalidadas o dinámicas según sus datos.
## Supabase
El cliente de servidor respeta sesión/RLS; el cliente admin/service role se limita a procesos confiables del servidor. RLS protege escritura y datos internos.
## Caché
Loaders públicos reutilizan `unstable_cache` y revalidate donde corresponde. No accedas a cookies dentro de scopes cacheados ni hagas una consulta por tecla.
## Carpetas
`app/` contiene rutas, `components/` UI, `lib/` loaders y dominio, `scripts/` collectors y diagnósticos, `supabase/migrations/` schema y `supabase/seeds/` cargas controladas.
$md$,230,'published'),
('manual-prop-firm','Manual completo: Prop Firms','Crear, completar, publicar y mantener una firma.','Manuales operativos','Prop Firms','admin',$md$
## Qué administra y dónde se encuentra
Una Prop Firm es una plataforma de tipo `prop_firm`. Se crea desde [Prop Firms](/admin/platforms) y se edita en `/admin/platforms/[id]/edit`.
## Flujo general
1. Crea la identidad mínima: nombre y slug.
2. Guarda y abre la edición completa.
3. Completa información, catálogos, reglas y relaciones verificadas.
4. Gestiona Challenges, disponibilidad y fuentes desde sus bloques.
5. Revisa la ficha pública antes de usar estado Activa.
## Secciones reales de la pantalla
- Información general: identidad, origen, estado, descripción y logo.
- Plataformas de trading, métodos, instrumentos y mercados.
- Reglas de trading con Sí, No y Desconocido.
- Challenges y cuentas.
- Opciones avanzadas: score, Day Trading, textos de política, resumen legacy, payouts, ofertas y afiliados.
- Disponibilidad geográfica.
- MondoTraders, Prop Firm Match y Payout metrics.
Consulta los manuales enlazados de esta misma sección para cada control.
## Acciones
**Guardar cambios** actualiza `platforms`, `prop_firm_details`, la traducción española y sincroniza relaciones. **Cancelar** vuelve al listado. **Gestionar** abre el módulo relacionado. **Eliminar** pide confirmación y ejecuta el borrado de la plataforma.
> [!WARNING]
> Eliminar una Prop Firm es destructivo. Las relaciones con `ON DELETE CASCADE` desaparecen; relaciones restrictivas pueden impedir la operación. Los giveaways conservan su fila y ponen el sponsor en NULL por `ON DELETE SET NULL`. Revisa payouts, challenges, offers, affiliate links y fuentes antes de confirmar.
## Inactive frente a Delete
Usa **Inactiva** cuando necesites ocultar la firma conservando datos, referencias e historial. Usa **Eliminar** únicamente para una fila errónea que pueda retirarse junto con sus dependencias. La pantalla sí expone eliminación directa.
$md$,240,'published'),
('manual-challenges','Manual completo: Challenges','Challenges, planes, fases, variantes y recompensas.','Manuales operativos','Challenges','admin',$md$
## Estructura
| Entidad | Responsabilidad |
|---|---|
| Challenge | Programa y tipo de evaluación |
| Account plan | Tamaño, precio, moneda y variante |
| Phase | Reglas de cada fase |
| Variant | Opción comercial del challenge |
| Variant phase | Override de una fase para una variante |
| Reward option | Split y calendario de recompensa |
## Flujo recomendado
1. Entra a [Challenges](/admin/challenges) y elige la firma.
2. Crea el challenge con la firma preseleccionada.
3. Define las fases en orden; son la fuente principal de targets y drawdowns por etapa.
4. Agrega tamaños y precios mediante account plans.
5. Crea variantes solo cuando una opción cambie reglas o condiciones.
6. Registra reward options sin confundirlas con payouts comprobados.
> [!WARNING] Los campos legacy de account plans pueden actuar como resumen durante la transición. No sustituyen reglas distintas de varias fases.
## Eliminación
No hay borrado general expuesto en la navegación actual. Desactiva o conserva como borrador según el estado disponible y revisa dependencias antes de una limpieza SQL controlada.
$md$,250,'published'),
('manual-payout-sources','Manual: fuentes de payouts','Configurar una fuente automática sin alterar evidencia histórica.','Manuales operativos','Payouts','admin',$md$
## Crear una fuente
Abre [Monitor de payouts](/admin/payouts), pulsa **Nueva fuente** y selecciona la Prop Firm.
| Campo | Requisito |
|---|---|
| Nombre, tipo y plataforma | Obligatorios |
| URL | Opcional según proveedor |
| Chain, Chain ID | Obligatorios al activar blockchain |
| Token address | Obligatorio al activar blockchain |
| Settlement address | Obligatorio al activar blockchain |
| History page / complete | Cursor operativo; no inventar |
## Estados
Una fuente blockchain incompleta puede guardarse **inactiva**. Para activarla, el formulario exige chain, chain ID, token y settlement address.
## Eliminación
El editor permite borrar solo cuando no existen payouts asociados. Si ya hay evidencia, desactiva la fuente.
> [!IMPORTANT] Configurar una fuente no crea un collector. El endpoint o script correspondiente debe existir y validar sus enums reales.
$md$,260,'published'),
('manual-ofertas','Manual completo: Ofertas','Crear, publicar, destacar y mantener promociones.','Manuales operativos','Ofertas','admin',$md$
## Crear
1. Abre [Ofertas](/admin/offers) y selecciona una firma.
Esta sección responde a la tarea **crear oferta** y publicarla.
2. Crea la oferta con plataforma obligatoria y challenge opcional.
3. Completa título, tipo/valor de descuento, código y fechas cuando apliquen.
4. Configura destacado, hot badge y resumen corto solo con evidencia.
5. Activa la oferta después de comprobar su CTA.
## Reglas
| Situación | Resultado |
|---|---|
| Sin challenge | Oferta general |
| Con challenge | Promoción asociada al programa |
| Fuera de fechas | No debe presentarse como vigente |
| Sin affiliate link | El flujo debe conservar fallback interno, nunca 404 |
## Eliminación
No hay borrado expuesto en el listado actual. Desactiva ofertas vencidas para preservar historial.
$md$,270,'published'),
('manual-affiliates','Manual: Affiliate Links','Configurar destinos, prioridad y fallback comercial.','Manuales operativos','Affiliate Links','admin',$md$
## Configuración
Relaciona plataforma, URL de destino, campaña, país, idioma, prioridad y estado. Usa una URL válida y una prioridad que permita resolver primero la variante más específica.
## Verificación
1. Prueba `/go/[slug]` con un enlace activo.
2. Confirma redirección y registro del clic.
3. Desactiva temporalmente el enlace y confirma el fallback a la ficha interna.
4. Verifica ofertas con y sin enlace.
> [!IMPORTANT] Nunca enlaces CTA comerciales directamente a `website_url` cuando corresponde tracking por `/go/[slug]`.
## Eliminación
El detalle actual no expone borrado. Desactiva el enlace; esto preserva atribución histórica.
$md$,280,'published'),
('manual-brokers','Manual completo: Brokers','Alta y mantenimiento del directorio de brokers.','Manuales operativos','Brokers','admin',$md$
## Qué administra y dónde se encuentra
Administra plataformas de tipo broker y su información especializada. Abre [Brokers](/admin/brokers). **Nuevo broker** abre el formulario; **Editar** carga sus relaciones actuales.
## Información
| Campo | Clasificación | Qué significa y qué valor colocar | Vacío / efecto público |
|---|---|---|---|
| Nombre | Obligatorio | Nombre público. Ejemplo: `Atlas Broker Demo` | El formulario no permite guardarlo vacío |
| Slug | Obligatorio | Segmento URL único, por ejemplo `atlas-broker-demo` | Cambiarlo puede cambiar la URL; no se asume redirección |
| País | Opcional | País de origen del broker, elegido desde Countries | `Sin verificar`; no equivale a disponibilidad geográfica |
| Año de fundación | Opcional | Entero entre 1800 y 2200 | NULL significa no verificado |
| Sitio web | Opcional | URL oficial del broker | No reemplaza el Affiliate Link ni `/go/[slug]` |
| Descripción corta | Opcional | Resumen público en español | La ficha puede quedar sin resumen |
## Operación
**Depósito mínimo** es numérico, admite decimales y no puede ser negativo. Déjalo vacío si no está confirmado: no uses cero como desconocido. **Moneda** es un código de tres caracteres, por ejemplo `USD`, y solo se guarda cuando existe depósito mínimo. Término relacionado para el buscador: deposito broker.
### Mercados
| Checkbox | Significado en el catálogo |
|---|---|
| CFD / Forex | Operación mediante CFD o mercado forex |
| Futures | Contratos de futuros |
| Crypto | Mercado de criptoactivos |
| Opciones | Contratos de opciones |
Son relaciones múltiples. Marcar confirma soporte; ninguna selección significa que el Admin no ha asociado mercados, no que estén prohibidos.
### Plataformas de trading
Cada checkbox proviene del catálogo `trading_platforms`. Marca únicamente software confirmado —por ejemplo MT4, MetaTrader 5, cTrader o TradingView cuando aparezca en el catálogo—. Sin selección, la ficha no anuncia ninguna plataforma. Este formulario no crea nuevos elementos de catálogo.
## Regulación
**Resumen corto** es texto opcional para siglas verificadas, por ejemplo `FCA · ASIC`. **Fuente oficial** es una URL opcional de evidencia, preferiblemente del regulador. El resumen no sustituye la fuente y nunca debe afirmar licencias no comprobadas.
## Presentación
**Logo** usa MediaPicker y reutiliza un archivo de Media. **Orden editorial** es un entero no negativo; el listado público ordena destacados primero y luego valores menores antes que mayores. **Broker destacado** da prioridad editorial, no representa una recomendación objetiva.
## Estado
| Valor | Resultado |
|---|---|
| Active | Disponible para consultas públicas que filtran plataformas activas |
| Draft | Registro en preparación, no debe tratarse como publicado |
| Inactive | Conserva la información pero la retira de superficies activas |
## Botones y guardado
**Crear broker / Guardar cambios** actualiza `platforms`, `broker_details`, descripción española, mercados y plataformas. **Cancelar** vuelve al listado. Durante el guardado aparece `Guardando...` y los errores se muestran en el formulario.
## Eliminación
Actualmente BrokerForm no expone botón ni handler de eliminación. Usa Inactivo para retirarlo desde la interfaz.
$md$,290,'published'),
('manual-exchanges','Manual completo: Exchanges','Alta y mantenimiento del directorio de exchanges.','Manuales operativos','Exchanges','admin',$md$
## Dónde y flujo
Abre [Exchanges](/admin/exchanges), crea el registro, completa los cinco bloques y guarda. Editar carga los valores actuales.
## Campos
| Campo | Requisito | Uso y valores |
|---|---|---|
| Nombre | Obligatorio | Nombre público |
| Slug | Obligatorio y único | URL; cambiarlo puede cambiar el enlace público |
| País | Opcional | País de origen o Sin verificar |
| Fundación | Opcional | Entero 1800–2200 |
| Sitio web | Opcional URL | Referencia oficial, distinta de afiliación |
| Descripción | Opcional | Resumen público en español |
| Tipo | Obligatorio | Centralizado: operador intermediario; Descentralizado: protocolo sin custodio central según evidencia |
| Soporte fiat | Opcional triestado | Sí, No o Sin verificar; NULL nunca equivale a No |
| Productos | Opcional | Resumen como `Spot · Futures`; no inventar |
| Resumen regulación | Opcional | Síntesis verificable |
| Fuente regulación | Opcional URL | Evidencia oficial |
| Logo | Opcional Media | Activo reutilizado |
| Orden | Entero ≥ 0 | Menores primero dentro de la prioridad |
| Destacado | Checkbox | Prioridad editorial, no recomendación objetiva |
| Estado | Obligatorio | Activo, Borrador o Inactivo |
## Guardado y eliminación
Guardar actualiza `platforms`, `exchange_details` y la descripción española. Cancelar vuelve al listado. ExchangeForm no expone Eliminar; utiliza Inactivo para ocultar conservando datos.
$md$,300,'published'),
('manual-herramientas','Manual completo: Herramientas','Crear herramientas internas, externas o próximas.','Manuales operativos','Herramientas','admin',$md$
## Información y clasificación
| Campo | Requisito | Explicación |
|---|---|---|
| Nombre | Obligatorio | Nombre público |
| Slug | Obligatorio | Minúsculas, números y guiones; único |
| Descripción corta | Opcional | Resumen de utilidad |
| Tipo | Obligatorio | Interna, Externa o Próximamente |
| Categoría | Opcional | Agrupación editorial, por ejemplo Riesgo |
| Icono | Select | Clave del catálogo visual existente |
| Badge opcional | Opcional | Etiqueta como Nuevo |
## Destino condicional
| Tipo | Obligatorio | Resultado |
|---|---|---|
| Interna | Ruta interna que comienza por `/` | Navega dentro de Tradagora; la ruta debe existir en código |
| Externa | URL HTTP/HTTPS válida | Navega al recurso externo |
| Próximamente | Sin destino | No crea enlace roto |
**Abrir en nueva pestaña** solo aparece y se guarda para herramientas externas.
## Presentación y publicación
Orden es entero ≥ 0; valores menores se priorizan. Herramienta destacada es selección editorial. Estado admite Borrador o Publicada.
## Botones
Crear/Guardar persiste el registro; Cancelar vuelve; Eliminar aparece al editar solo con permiso `tools.delete`, pide confirmación y borra la fila.
$md$,310,'published'),
('manual-comunidades','Manual completo: Comunidades','Alta, publicación y mantenimiento de comunidades.','Manuales operativos','Comunidades','admin',$md$
## Campos
| Campo | Requisito | Explicación |
|---|---|---|
| Nombre / Slug | Obligatorios | Identidad y URL única |
| Descripción corta | Opcional | Resumen público |
| Tipo | Obligatorio | discord, telegram, whatsapp, x, reddit, forum u other |
| Categoría / Idioma / Región | Opcionales | Clasificación; idioma usa código como `es` |
| Logo | Opcional Media | Identidad visual reutilizada |
| Badge | Opcional | Etiqueta editorial |
| Orden | Entero ≥ 0 | Prioridad dentro del listado |
| Destacada | Checkbox | Prioridad editorial |
| URL para unirse | Obligatoria URL | Destino directo para ingresar a la comunidad |
| Website opcional | Opcional URL | Página informativa; no sustituye el enlace de unión |
| Estado | Obligatorio | Borrador o Publicado |
## Acciones
Guardar persiste; Cancelar vuelve. Eliminar aparece al editar con `communities.delete`, pide confirmación y elimina la comunidad.
$md$,320,'published'),
('manual-blog','Manual completo: Blog','Crear, previsualizar y publicar artículos Markdown.','Manuales operativos','Blog','admin',$md$
## Campos del artículo
| Campo | Requisito | Explicación |
|---|---|---|
| Título / Slug | Obligatorios | Título público y URL única |
| Extracto | Opcional | Resumen para tarjetas/listados |
| Contenido Markdown | Obligatorio | Cuerpo del artículo |
| Categoría | Opcional | Agrupación editorial |
| Tags separados por comas | Opcional | Se convierten en una lista sin elementos vacíos |
| Autor | Opcional | Nombre mostrado como autor |
| Fecha de publicación | Opcional | Fecha/hora ISO; si queda vacía se guarda NULL |
| Imagen de portada | Opcional Media | Cover reutilizado |
| Artículo destacado | Checkbox | Prioridad editorial |
| Estado | Obligatorio | Borrador o Publicado |
La consulta pública admite posts `published` cuya fecha sea NULL o no esté en el futuro; por eso Publicado sin fecha queda visible inmediatamente.
## Cómo escribir
Usa `#` para título, `##` para sección, `-` para listas, `**texto**` para negrita y `[texto](https://...)` para enlaces. No insertes HTML ni secretos.
## Acciones
Guardar publica según estado/fecha. Eliminar aparece con `blog.delete`, pide confirmación y borra la fila.
$md$,330,'published'),
('manual-giveaways','Manual completo: Giveaways','Vigencia, reglas, participación y cierre.','Manuales operativos','Giveaways','admin',$md$
## Campos
| Campo | Requisito | Explicación |
|---|---|---|
| Título / Slug | Obligatorios | Identidad y URL única |
| Descripción | Opcional | Resumen de campaña |
| Sponsor | Opcional relación | Plataforma patrocinadora; Sin sponsor guarda NULL |
| Nombre del premio | Obligatorio | Premio principal |
| Cantidad | Opcional, mínimo 1 | Unidades del premio |
| Descripción del premio | Opcional | Detalle comprobable |
| Inicio / Finalización | Obligatorios | Fecha/hora; DB exige finalización posterior al inicio |
| URL participación / URL reglas | Opcionales URL | Acción y términos |
| Cover / Badge | Opcionales | Imagen Media y etiqueta |
| Orden / Destacado | Entero ≥ 0 / checkbox | Prioridad editorial |
| Título final / Contenido final | Opcionales | Reveal o resultado manual |
| Estado | Obligatorio | Borrador, Publicado o Finalizado |
## Operación
Para una campaña futura define ambas fechas y deja Borrador hasta revisar. Publicado habilita presentación pública según sus loaders. Finalizado documenta el cierre. El countdown se calcula visualmente y no cambia el estado. La selección de ganadores **no es automática**.
## Eliminación
Con permiso `giveaways.delete`, Eliminar pide confirmación y borra la fila. Conserva campañas reales como Finalizado cuando importe su historial.
$md$,340,'published'),
('manual-media','Manual completo: Media','Subir, reutilizar y retirar activos visuales.','Manuales operativos','Media','admin',$md$
## Subida
Abre [Media](/admin/media), selecciona una categoría real y escribe texto alternativo útil. Reutiliza el activo desde `MediaPicker`.
## Checklist
- Formato y peso razonables.
- Fondo y proporción apropiados para el uso.
- Alt text descriptivo.
- Sin duplicar archivos ya existentes.
## Eliminación
Antes de borrar, localiza referencias en plataformas, posts y otros módulos. Eliminar el archivo puede romper varias pantallas aunque la fila propietaria continúe existiendo.
$md$,350,'published'),
('manual-home','Manual completo: Home','Administrar firmas destacadas y verificar sus bloques.','Manuales operativos','Home','admin',$md$
## Firmas destacadas
Desde [Home](/admin/home) agrega una plataforma una sola vez, activa/desactiva, define orden, badge, CTA y vigencia.
## Verificación
| Prueba | Esperado |
|---|---|
| Inactiva | No aparece |
| Fuera de vigencia | No aparece |
| Cambio de orden | Home respeta el orden |
| Sin destacadas | Estado vacío sin error |
## Eliminación
La interfaz permite retirar una configuración y volver a agregarla. Esto no elimina la plataforma.
$md$,360,'published'),
('manual-geografia','Manual: disponibilidad geográfica','Crear reglas generales y específicas con evidencia.','Manuales operativos','Geografía','admin',$md$
## Campos
Selecciona país, mercado, estado y criterio. `available` y `restricted` requieren `source_url` y `verified_at`. `unknown` expresa falta de confirmación.
## Precedencia
Una regla específica para Futures, CFD, Crypto u Options prevalece sobre la regla General del mismo país. General funciona como fallback.
## Criterios
| Criterio | Efecto esperado |
|---|---|
| Residencia | Puede excluir en matching |
| Nacionalidad | Advierte; no excluye automáticamente |
| Ubicación física | Advierte; no excluye automáticamente |
| No especificado | Restricción documentada sin exclusión automática |
> [!IMPORTANT] No se permiten duplicados del mismo país + mercado. Sí puede coexistir una regla General con una específica.
$md$,370,'published'),
('manual-permisos','Manual: usuarios y permisos','Administrar acceso granular sin bypass de RLS.','Manuales operativos','Usuarios y permisos','technical',$md$
## Principios
Los permisos de interfaz no sustituyen RLS. `super_admin` administra; admin y editor solo reciben claves explícitas. Los overrides permiten conceder o negar por usuario.
## Procedimiento seguro
1. Revisa el rol actual.
2. Aplica el menor permiso necesario.
3. Usa las RPC administrativas, no updates directos de `profiles.role`.
4. Verifica el permiso efectivo y el audit log.
5. Prueba acceso y operación, no solo visibilidad del menú.
> [!WARNING] No concedas `users.view` ni permisos de escritura global por conveniencia. Las RPC sensibles quedan reservadas al service role.
$md$,380,'published'),
('manual-documentacion','Manual: documentación interna','Crear y mantener artículos de esta wiki.','Manuales operativos','Documentación','admin',$md$
## Crear un artículo
Abre [Documentación](/admin/docs), usa **Nuevo artículo** y completa título, slug, resumen, sección, audiencia, orden, estado y Markdown.
## Convenciones
Usa `##` y `###` para el índice, tablas Markdown para matrices y callouts `> [!IMPORTANT]`. Enlaza procedimientos relacionados con rutas `/admin/...`.
## Estados y búsqueda
Los borradores permanecen fuera de la lectura publicada según las reglas del módulo. La búsqueda indexa título, resumen, sección y cuerpo disponibles al cliente.
## Eliminación
El editor permite eliminar con confirmación. Prefiere corregir o pasar a borrador cuando el artículo conserve valor histórico.
$md$,390,'published'),
('prop-firm-informacion','Prop Firms: información general','Todos los controles del bloque Información general.','Manual de administración','Prop Firms','admin',$md$
## Dónde se encuentra
[Prop Firms](/admin/platforms) → editar una firma → **Información general**.
Esta sección responde también a “qué es país de origen”.
## Campos
| Campo | Tipo / requisito | Qué significa | Vacío y presentación |
|---|---|---|---|
| Nombre | Texto · obligatorio | Nombre público de la firma | No puede guardarse vacío |
| Slug | Texto · obligatorio y único | Identificador de URL, por ejemplo `atlas-funding-demo` | Cambiarlo puede cambiar la URL sin redirección automática |
| Sitio web | URL · opcional | Web oficial como dato de referencia | No sustituye `/go/[slug]` |
| Estado | Select · obligatorio | Activa, Borrador o Inactiva | Siempre tiene valor |
| País de origen | Relación · opcional | Lugar de origen registrado | `No especificado`; no determina acceso por residencia |
| CEO | Texto · opcional | Nombre del responsable si está verificado | NULL, no se inventa |
| Fecha de fundación | Fecha · opcional | Fecha conocida de fundación | NULL si no está verificada |
| Broker / proveedor de liquidez | Texto · opcional | Proveedor declarado por la firma | No implica validación independiente |
| Días de inactividad | Entero ≥ 0 · opcional | Umbral informativo de inactividad | NULL si no aplica o se desconoce |
| Mostrar como nueva | Checkbox | Activa la etiqueta editorial “Nueva” | Desmarcado no afirma antigüedad |
| Descripción | Texto largo · opcional | Resumen público en español | Puede quedar sin descripción |
| Logo | Media · opcional | Activo reutilizado desde MediaPicker | Se utiliza fallback visual si la pantalla lo contempla |
| Score público | Número 0–10 · opcional | Puntuación editorial visible | Está dentro de Opciones avanzadas |
> [!IMPORTANT]
> País de origen no significa que la firma esté disponible para residentes de ese país. La disponibilidad se administra en reglas geográficas.
## Estado y botones
Activa publica en consultas que exigen `status=active`; Borrador prepara; Inactiva conserva y oculta. **Guardar cambios** persiste todos los bloques, **Cancelar** vuelve al listado y **Eliminar** inicia una acción destructiva con confirmación.
$md$,241,'published'),
('prop-firm-catalogos','Prop Firms: plataformas, métodos, instrumentos y mercados','Cómo administrar las relaciones múltiples de una firma.','Manual de administración','Prop Firms','admin',$md$
## Plataformas de trading
Los checkboxes proceden de `trading_platforms`. Selecciona únicamente terminales confirmadas. Una opción con etiqueta Inactivo sigue siendo un elemento de catálogo no activo. No marcar ninguna significa “sin relación registrada”, no “la firma no admite plataformas”.
## Métodos de depósito y retiro
Cada nombre procede de `transaction_methods` y tiene dos checks independientes.
| Control | Significado |
|---|---|
| Depósito | El método se admite para pagar o ingresar fondos |
| Retiro | El método se admite para recibir retiros o payouts |
| Ambos | Se guarda una relación con ambas capacidades |
| Ninguno | La relación se elimina; no confirma incompatibilidad |
Ejemplos del catálogo pueden incluir ACH, Bank Transfer, tarjetas, Crypto, PayPal, Rise, Skrill o Wise. El Admin documenta capacidad, no define el proveedor.
## Instrumentos
| Categoría | Alcance |
|---|---|
| Commodities | Materias primas como categoría |
| Crypto | Criptoactivos |
| Forex | Pares de divisas |
| Futures | Contratos de futuros |
| Indices | Índices bursátiles |
| Metals | Metales como categoría |
| Options | Contratos de opciones |
| Stocks | Acciones |
No son símbolos individuales. Seleccionar Forex no declara cada par disponible.
## Mercados
CFD / Forex, Futures, Crypto y Options describen la estructura general soportada. Una firma puede tener varios.
> [!IMPORTANT]
> **Market** clasifica el modelo o ámbito operativo; **Instrument category** clasifica la clase de activo. Por eso una firma puede tener market CFD e instrumentos Forex, Metals e Indices.
## Guardado
Las selecciones se sincronizan: las nuevas se insertan y las desmarcadas se eliminan de sus tablas de relación.
$md$,242,'published'),
('prop-firm-reglas','Prop Firms: reglas de trading','Estados Sí, No y Desconocido de cada regla.','Manual de administración','Prop Firms','admin',$md$
## Regla de tres estados
Todos los selects guardan `true`, `false` o `null`.
| Opción | Interpretación |
|---|---|
| Sí | Compatibilidad confirmada |
| No | Restricción o incompatibilidad confirmada |
| Desconocido | No existe evidencia suficiente |
> [!IMPORTANT]
> Desconocido nunca debe convertirse en No. El recomendador debe preservar la incertidumbre.
## Controles
**EA / Bots** indica software automatizado. **Noticias** indica operativa durante eventos informativos. **Weekend holding** indica mantener posiciones durante el fin de semana. **Scalping** indica operativa de muy corto plazo. **Copy Trading** indica replicación de operaciones. **Day Trading**, dentro de Opciones avanzadas, indica operativa intradía.
## Políticas de texto
Política de límite de tiempo, reglas de consistencia y reglas especiales son textos opcionales. Informan al lector; el editor aclara que el recomendador no los convierte automáticamente en puntuación.
$md$,243,'published'),
('prop-firm-challenges','Prop Firms: Challenges y cuentas','Jerarquía y acciones del bloque de Challenges.','Manual de administración','Prop Firms','admin',$md$
## Modelo
Prop Firm
└── Challenge
    ├── Phase(s)
    ├── Variant(s)
    │   └── Variant Phases
    ├── Account Plans
    └── Reward Options
## Conceptos
**Challenge** es el programa. **Phase** contiene reglas por etapa. **Variant** representa una opción del programa. **Variant Phase** sobrescribe una fase para esa variante. **Account Plan** combina tamaño, precio, moneda y variante. **Reward Option** describe split y calendario; no es evidencia de un payout efectuado.
## Tabla/listado visible
Cada tarjeta muestra nombre, tipo o “Tipo pendiente”, cantidad de planes y estado. **Gestionar** abre `/admin/challenges/[id]`. **Ver todos los challenges** abre la página de la firma. **+ Nuevo Challenge** abre el formulario con la Prop Firm preseleccionada.
## Fuente de verdad
Las reglas por fase pertenecen a `challenge_phases`; los campos legacy de account plans son resúmenes durante la transición y no deben ocultar diferencias entre fases.
$md$,244,'published'),
('prop-firm-geografia','Prop Firms: disponibilidad geográfica','Campos, evidencia y precedencia de las reglas.','Manual de administración','Prop Firms','admin',$md$
## Acciones
**+ Añadir regla** crea una fila editable local. **Guardar disponibilidad** valida y persiste el conjunto. **Quitar regla** retira esa regla del conjunto que se guardará.
## Campos por regla
| Campo | Requisito | Significado |
|---|---|---|
| País | Obligatorio | País de residencia evaluado; no es el origen de la firma |
| Mercado | Obligatorio | General, CFD, Futures, Crypto u Options |
| Estado | Obligatorio | Disponible, Restringido o Desconocido |
| Criterio | Obligatorio | Residencia, Nacionalidad, Ubicación física o No especificado |
| URL de fuente oficial | Condicional | Obligatoria para available/restricted; evidencia pública |
| Verificado el | Condicional | Obligatoria para available/restricted; fecha de revisión |
| Resumen propio | Opcional | Nota editorial basada en la fuente |
## Interpretación
`available` confirma disponibilidad; `restricted` confirma restricción; `unknown` conserva incertidumbre. Una regla específica del mercado prevalece sobre General. Sin regla no significa Disponible.
`restriction_list_complete` solo permite inferencias de ausencia cuando la evidencia demuestra que la lista es completa; no debe activarse por conveniencia.
## Matching
Residence restricted puede excluir. Nationality, physical_location y unspecified advierten, pero no excluyen automáticamente.
$md$,245,'published'),
('prop-firm-payout-panels','Prop Firms: Mondo, PFM y Payout Metrics','Qué representan los tres paneles externos/administrativos.','Manual de administración','Prop Firms','admin',$md$
## Payouts y verificación
El resumen de solo lectura muestra Total payouts, Total rastreado y Último payout desde evidencias asociadas. Las fuentes listan nombre, tipo, verificación y estado; **Ver monitoreo** abre el monitor y **Gestionar fuentes** administra configuración técnica.
## MondoTraders · Métricas externas
La tabla muestra períodos y métricas externas capturadas: total, cantidad, mayor, promedio, tiempo de payout, fecha de captura y estado cuando el componente dispone de ellos. Son snapshots externos; nunca se suman a payouts verificados por Tradagora. Filas incompletas se omiten por el collector.
## Prop Firm Match · Payout Tracker
Permite agregar un snapshot por período con Total payouts, Cantidad, Mayor payout, Promedio, Mediana/tiempo cuando el formulario lo expone, Moneda, URL y fecha de captura. **Nuevo snapshot** conserva el anterior como histórico y hace current al nuevo de la misma firma, fuente y período.
## Payout Metrics
| Control | Significado |
|---|---|
| Tipo de métrica | Clasificación del agregado |
| Monto / Cantidad / Mayor / Promedio / Mediana | Estadísticas externas u oficiales; pueden ser NULL |
| Tiempo mediano (min) | Columna histórica de DB; la UI pública usa semántica neutral si la fuente no confirma mediana |
| Moneda | Unidad monetaria |
| Fuente / Nombre de fuente / URL | Procedencia explícita |
| Verificación | Nivel como tracked_external o blockchain_external según fuente |
| Fecha de captura | Momento del snapshot |
**Editar** modifica la métrica seleccionada; **Eliminar** borra ese agregado, no payouts individuales.
$md$,246,'published'),
('prop-firm-avanzado','Prop Firms: opciones avanzadas y relaciones','Controles secundarios y bloques relacionados.','Manual de administración','Prop Firms','admin',$md$
## Campos editables
**Score público** admite 0–10. **Day Trading** usa Sí/No/Desconocido. Los tres textos de políticas son opcionales. Profit Split mínimo y máximo son resúmenes económicos legacy; las condiciones normalizadas viven en Challenges y Reward Options.
## Bloques de solo lectura o navegación
El resumen de payouts no modifica ingesta. La lista de fuentes enlaza al monitor. Ofertas muestra título y Activa/Inactiva y enlaza al módulo. Afiliados muestra cantidad de enlaces y abre su gestor.
## Botones
**Gestionar fuentes**, **Gestionar ofertas** y **Gestionar afiliados** navegan; no guardan automáticamente cambios pendientes del formulario principal. Guarda antes de salir si modificaste campos.
$md$,247,'published'),
('prop-firm-eliminar','Prop Firms: estados y eliminación','Cuándo ocultar y cuándo eliminar una firma.','Manual de administración','Prop Firms','admin',$md$
## Estados
**Activa** permite aparición en consultas públicas activas. **Borrador** mantiene preparación. **Inactiva** conserva relaciones e historial mientras retira la firma de superficies activas.
## Eliminar
El botón rojo está al pie de `/admin/platforms/[id]/edit`. Solicita confirmación con `window.confirm` y luego elimina la fila de `platforms`. Requiere que RLS permita la operación al usuario actual. Esta sección responde a la tarea **eliminar Prop Firm**.
> [!WARNING]
> Eliminar una Prop Firm es una acción destructiva y no se puede deshacer desde el Admin.
Las tablas creadas con `platform_id ... ON DELETE CASCADE` eliminan sus relaciones, entre ellas detalles especializados, mercados/plataformas/instrumentos, mappings, métricas y destacados del Home. Los giveaways usan `ON DELETE SET NULL` para sponsor. Otras relaciones pueden bloquear el delete si su FK es restrictiva.
## Decisión
Usa Inactiva para una firma real que deba conservar historia. Elimina solo registros erróneos tras revisar challenges, planes, ofertas, afiliados, payouts, fuentes y mappings.
$md$,248,'published'),
('conceptos-campos-admin','Conceptos de campos del Admin','Slug, estado, featured, orden, Media, NULL y evidencia.','Conceptos','Campos administrativos','general',$md$
## Slug
Identificador usado en la URL pública. Debe ser único. Ejemplo: `alpha-futures-demo`. Cambiarlo tras publicar puede cambiar la URL; no se asume redirección automática.
## Estado
Controla ciclo editorial. Los valores dependen del módulo: plataformas usan active/draft/inactive; otros catálogos usan draft/published y Giveaways añade ended.
## Featured
Prioridad editorial para destacar contenido. No significa recomendación objetiva ni mejor puntuación.
## Display order
Orden manual no negativo. En los listados que lo utilizan, valores menores aparecen antes dentro del mismo grupo de prioridad.
## Media
Relación con un archivo reutilizable. Cambiar la selección no necesariamente elimina el archivo anterior.
## NULL / desconocido
Significa dato no disponible o no verificado. No equivale a falso, cero, restringido ni incompatible.
## Fuente oficial
URL que permite revisar una afirmación. Debe respaldar el dato concreto y distinguirse del sitio comercial o affiliate link.
$md$,249,'published'),
('guia-publicar-firma','Guía rápida: publicar una Prop Firm','Checklist de extremo a extremo para una nueva firma.','Guías por tarea','Prop Firms','admin',$md$
## Pasos
1. Crea la firma en [Prop Firms](/admin/platforms) como borrador.
2. Completa identidad, país y descripción.
3. Añade mercados, instrumentos, plataformas y métodos.
4. Crea challenges, fases y planes reales.
5. Registra disponibilidad con evidencia.
6. Configura afiliación si existe.
7. Revisa la ficha pública en móvil y escritorio.
8. Cambia a activa.
> [!EXAMPLE] Una ficha puede publicarse sin payouts externos. No inventes totales para completar el perfil.
$md$,400,'published'),
('guia-cambiar-logo','Guía rápida: cambiar un logo','Actualizar una imagen sin duplicar ni romper referencias.','Guías por tarea','Media','admin',$md$
## Pasos
1. Busca primero el activo en [Media](/admin/media).
2. Si no existe, súbelo con categoría y alt text.
3. Abre la entidad correspondiente y selecciónalo con MediaPicker.
4. Guarda y comprueba listado, ficha y móvil.
5. Conserva el logo anterior hasta confirmar que ninguna otra entidad lo usa.
$md$,410,'published'),
('guia-publicar-contenido','Guía rápida: publicar contenido','Checklist común para Blog, Comunidades y Giveaways.','Guías por tarea','Publicación','admin',$md$
## Checklist
| Paso | Comprobación |
|---|---|
| Identidad | Nombre/título y slug únicos |
| Evidencia | Enlaces y afirmaciones verificables |
| Imagen | Activo reutilizado y alt text |
| Vigencia | Fechas coherentes cuando aplican |
| Preview | Escritorio y móvil |
| Estado | Borrador antes de publicar |
> [!IMPORTANT] Publicar es una decisión editorial. Una fila completa no implica automáticamente que el contenido esté listo.
$md$,420,'published')
on conflict (slug) do update set
  title=excluded.title, excerpt=excluded.excerpt, section=excluded.section,
  subsection=excluded.subsection, audience=excluded.audience,
  body_markdown=excluded.body_markdown, sort_order=excluded.sort_order,
  status=excluded.status, updated_at=now();

-- Taxonomía por módulos. Mantiene los artículos existentes y evita categorías
-- paralelas como “Manuales operativos” o “Guías por tarea”.
with taxonomy(slug, section, subsection) as (values
  ('que-es-tragadora','Funcionamiento de Tragadora','Empezar'),
  ('primeros-pasos-admin','Funcionamiento de Tragadora','Primeros pasos'),
  ('comparador','Funcionamiento de Tragadora','Comparador'),
  ('prop-firms-administracion','Prop Firms','Resumen'),
  ('manual-prop-firm','Prop Firms','Empezar'),
  ('guia-publicar-firma','Prop Firms','Crear y publicar'),
  ('prop-firm-informacion','Prop Firms','Campos'),
  ('prop-firm-catalogos','Prop Firms','Campos'),
  ('prop-firm-reglas','Prop Firms','Reglas de trading'),
  ('prop-firm-challenges','Prop Firms','Challenges y cuentas'),
  ('manual-challenges','Prop Firms','Challenges y cuentas'),
  ('geografia','Prop Firms','Disponibilidad geográfica'),
  ('manual-geografia','Prop Firms','Disponibilidad geográfica'),
  ('prop-firm-geografia','Prop Firms','Disponibilidad geográfica'),
  ('prop-firm-payout-panels','Prop Firms','Datos externos y métricas'),
  ('prop-firm-avanzado','Prop Firms','Opciones avanzadas'),
  ('prop-firm-eliminar','Prop Firms','Estados y eliminación'),
  ('payouts','Payouts','Resumen'),
  ('manual-payout-sources','Payouts','Fuentes'),
  ('mondotraders','Payouts','Collectors y diagnóstico'),
  ('ofertas','Ofertas','Resumen'),
  ('manual-ofertas','Ofertas','Crear y editar'),
  ('affiliate-links','Affiliate Links','Resumen'),
  ('manual-affiliates','Affiliate Links','Crear y operar'),
  ('brokers','Brokers','Resumen'),
  ('manual-brokers','Brokers','Crear y editar'),
  ('exchanges','Exchanges','Resumen'),
  ('manual-exchanges','Exchanges','Crear y editar'),
  ('herramientas','Herramientas','Resumen'),
  ('manual-herramientas','Herramientas','Crear y editar'),
  ('comunidades','Comunidades','Resumen'),
  ('manual-comunidades','Comunidades','Crear y editar'),
  ('blog','Blog','Markdown y conceptos'),
  ('manual-blog','Blog','Crear y publicar'),
  ('guia-publicar-contenido','Blog','Consejos de publicación'),
  ('giveaways','Giveaways','Resumen'),
  ('manual-giveaways','Giveaways','Crear y administrar'),
  ('media','Media','Resumen'),
  ('manual-media','Media','Subir y reutilizar'),
  ('guia-cambiar-logo','Media','Logos y covers'),
  ('home','Home','Resumen'),
  ('manual-home','Home','Firmas destacadas'),
  ('usuarios-permisos','Usuarios y permisos','Conceptos'),
  ('manual-permisos','Usuarios y permisos','Administrar acceso'),
  ('conceptos','Conceptos y glosario','Glosario'),
  ('conceptos-campos-admin','Conceptos y glosario','Campos administrativos'),
  ('arquitectura-tecnica','Documentación técnica','Arquitectura'),
  ('mantenimiento','Mantenimiento y errores','Comandos y validación'),
  ('git-deploy','Mantenimiento y errores','Git y despliegue'),
  ('troubleshooting','Mantenimiento y errores','Troubleshooting'),
  ('manual-documentacion','Documentación','Cómo usar esta Wiki')
)
update public.documentation_articles article
set section = taxonomy.section,
    subsection = taxonomy.subsection,
    updated_at = now()
from taxonomy
where article.slug = taxonomy.slug;

commit;

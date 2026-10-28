# Diagnóstico y reparación — 28 de octubre de 2026

Base revisada: main, 3a83741a0a76654deeae77928ec51113eb76e296.
Ejecución: https://github.com/jackjr9604/tragadora/actions/runs/40642505608
Job: 122663649689. No se modificó GitHub ni la base de datos externa.

## Causa confirmada

El script carga de Supabase todas las filas payout_sources con source_type=public_page y status=true. A cada fila le exige config.collector mediante validateOfficialConfig. La fila activa Lucid Trading - Arbitrum no proporciona ese objeto: el log muestra COLLECTOR_CONFIG_INVALID: collector ausente antes de navegar a su página. El objeto concreto de configuración y su UUID no están versionados en el repositorio; deben inspeccionarse con el SQL de auditoría adjunto. No se inventa una configuración ni se atribuyen pagos on-chain sin evidencia.

En el repositorio existe app/api/admin/research/lucid-wallet/route.ts: investigación Etherscan/Arbitrum de una ventana fija de agosto de 2026. No es un collector declarativo programado de la página oficial de Lucid. No hay una definición versionada con el nombre exacto Lucid Trading - Arbitrum.

La fuente siguiente sí se procesó: The Trading Pit obtuvo all y 30d como UNCHANGED. Resumen real: sources=2, periods=2, succeeded=2, failed=1, unchanged=2, writes=0. process.exitCode=1 convierte el fallo parcial en job fallido. Por tanto, ese log no demuestra que Lucid detenga las demás fuentes; sí demuestra el fallo recurrente del job. Antes del cambio, una excepción en page.close o updateSourceStatus dentro de finally sí podía abortar el resto del bucle.

No se ha confirmado aquí la ejecución del commit c037120 ni que tuviera idéntico log.

## Cambios entregados

- scripts/official-source-policy.ts: cuarentena exacta por slug lucid-trading + nombre Lucid Trading - Arbitrum + collector nulo/ausente. Configuraciones nuevas o explícitas malformadas siguen fallando. Un collector enabled=false se omite.
- scripts/collect-official-pages.ts: aplica esa política, cuenta cuarentenas y deshabilitadas, emite advertencia en Actions, y aísla errores de cierre y persistencia de estado. No modifica la fila de Lucid ni marca una cuarentena como sincronización exitosa. Falla si no queda ninguna fuente elegible o ningún período exitoso. Los errores reales siguen dando salida 1 después de procesar las fuentes restantes.
- Workflow: ejecuta los tests antes de recolectar y declara contents:read. Mantiene cron, timeout y secretos originales. Resumen visible en GitHub Actions.
- package.json: incluye las pruebas de política en test:official.
- SQL de auditoría: exclusivamente SELECT; configuración real, últimas sincronizaciones, snapshots, mappings y fuente elegida por la web.

No se eliminan snapshots, no se insertan ceros, no se cambia la clasificación de confianza y no se presenta la cuarentena como actualización de Lucid.

## Por qué puede verse información antigua

1. Este workflow solo recolecta pagos de fuentes public_page activas. La migración 202609280001 configura The Trading Pit (all y 30d). El log revisado solo encontró dos fuentes. No actualiza automáticamente precios, descuentos, reglas de desafíos, métodos de pago ni restricciones de países.
2. MondoTraders tiene otro workflow diario (06:15 UTC / 01:15 Colombia) y necesita external_platform_mappings activos. Solo recoge 24h, 7d, 30d y all, no 365d. Hay que revisar su ejecución y cobertura por separado; este diagnóstico no confirma su estado actual de producción.
3. Ambos collectors omiten inserciones si el contenido no cambia. collected_at puede seguir siendo antiguo aunque haya una comprobación reciente. En oficial, last_success_at de la fuente sí se actualiza al completar la revisión. La UI pública usa la fecha del snapshot, no esa comprobación. No rejuvenecer collected_at artificialmente.
4. La vista platform_payout_period_summary selecciona primero por confianza y después por fecha, sin caducidad. Un snapshot oficial antiguo puede imponerse a Mondo reciente; is_current significa vigente en su serie, no necesariamente reciente. Debe definirse una política de frescura antes de cambiar esa prioridad.
5. La caché pública del tracker revalida a 60 segundos; por sí sola no explica semanas sin cambios.
6. snapshotsEqual del collector oficial compara métricas agregadas y tiempo medio, no moneda ni recent_rewards. Si solo cambian esos campos se omite la inserción. Conviene una regresión específica antes de ampliar el comparador.

## Aplicación y validación

Copiar los archivos completos del ZIP en la raíz de un checkout del commit base. Alternativamente aplicar changes.patch con git apply --check y después git apply; no hacer ambas cosas. package-lock.json no cambia porque no se añaden dependencias.

Comandos:

```bash
npm ci
npx playwright install --with-deps chromium
npm run test:official
npx eslint scripts/collect-official-pages.ts scripts/official-source-policy.ts scripts/official-source-policy.test.ts
```

La ejecución completa contra Supabase debe realizarse después de revisar el cambio: workflow_dispatch en una rama con el arreglo, o npm run collect:official -- --headless con secretos autorizados. El modo --dry-run evita escrituras, pero todavía lee Supabase y navega a páginas públicas; no se ejecutó contra producción aquí.

Resultado esperado con la configuración del incidente: quarantined=1, eligible=1, succeeded=2, failed=0; advertencia explícita para Lucid. The Trading Pit puede ser UNCHANGED o INSERTED según el contenido. No exigir writes>0 para considerar una revisión exitosa.

Pruebas incluidas: cuarentena exacta de Lucid; otra firma/nombre no se omite; configuración explícita no se oculta; deshabilitación; fallos de cierre y guardado no impiden el siguiente ciclo. La suite existente cubre parsers, configuración, seguridad de URL, confianza y extracción de fixture con selector obligatorio ausente.

Casos de integración pendientes con Supabase simulado o entorno de prueba: ausencia de todas las fuentes; solo cuarentena/deshabilitadas; mezcla de Lucid + fuente válida; error de SELECT inicial; error de INSERT en un período y éxito en el siguiente; error de UPDATE de estado; ninguna escritura en dry-run; timeout/403/challenge conservan último snapshot; fallo global al abrir Chromium. No ejecutar pruebas de escritura sobre producción.

## Prevención y siguiente revisión con Codex

Ejecutar el SQL adjunto sin modificaciones externas y usar sus resultados para crear una matriz firma × período × fuente × última comprobación × última captura × error. Esto separa falta de cobertura de fallo de extracción y de datos sin cambios. No se puede afirmar cuántas firmas están obsoletas sin esos resultados.

Después, implementar y probar por separado:

- Registro por fuente y período de last_checked_at, last_changed_at y error; no reutilizar la fecha de captura como comprobación. Validación de config al guardar en el administrador además de al ejecutar.
- Alertas por fuente sin éxito (propuesta inicial: 36 h para cron de 12 h, 48 h para diario), cero fuentes elegibles y pérdidas de cobertura. La cuarentena debe seguir visible hasta resolverla.
- Mostrar fecha/fuente y aviso de datos antiguos; acordar umbrales por período y comportamiento de fallback antes de cambiar rankings.
- Para reglas/precios/condiciones, inventario de campos con URL oficial y fecha de revisión; comparación periódica que genere propuestas verificables. No sobrescribir políticas automáticamente a partir de inferencias o de un scraper de pagos.
- Fixtures para cambios de selectores, moneda, recompensas recientes y períodos, además de prueba de compatibilidad con Node de Actions.

Reactivar Lucid en este collector solo con página oficial, selectores, períodos y fixture comprobados; si corresponde a blockchain, utilizar el proceso adecuado con atribución verificada. Esta cuarentena estabiliza el collector, no actualiza por sí misma los pagos de Lucid.

## Validación efectivamente realizada

Instalación npm ci --ignore-scripts completada. Las cuatro pruebas nuevas pasan; también pasaron las cuatro pruebas existentes sin navegador. ESLint de los tres archivos TypeScript modificados y git diff --check pasaron. La suite completa se intentó: las dos pruebas con navegador fallaron porque Chromium no está instalado. Se intentó instalarlo, pero el servidor de descarga devolvió un ZIP vacío/truncado. Queda pendiente validar esas dos pruebas en Actions con Chromium disponible. No se afirma validación end-to-end ni ejecución en producción.

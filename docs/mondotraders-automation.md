# Automatización de MondoTraders

El workflow `Collect MondoTraders payouts` ejecuta el collector una vez al día en GitHub Actions, sin depender de un equipo local ni de Vercel.

## Horario

Se ejecuta diariamente a las **06:15 UTC**. También admite ejecución manual desde la pestaña **Actions** de GitHub.

## Secretos requeridos

Configura estos Actions secrets en **Settings → Secrets and variables → Actions**:

- `SUPABASE_URL`: URL del proyecto Supabase.
- `SUPABASE_SERVICE_ROLE_KEY`: service role key utilizada exclusivamente por el job.

El workflow no imprime estos valores. El collector también admite `NEXT_PUBLIC_SUPABASE_URL` localmente como fallback, pero el workflow usa `SUPABASE_URL` de forma explícita.

## Ejecución local

Collector con escrituras:

```bash
npm run collect:mondo
```

Prueba sin escrituras:

```bash
npm run collect:mondo -- --dry-run
```

## Ejecución manual en GitHub

1. Abre la pestaña **Actions** del repositorio.
2. Selecciona **Collect MondoTraders payouts**.
3. Pulsa **Run workflow**.

## Seguridad de los snapshots

El collector valida cada fila antes de insertarla. Una firma ausente no se convierte en cero. Si Mondo no responde, cambia el HTML, bloquea el navegador o una fila no supera la validación, el job termina como fallido y conserva el último snapshot válido. Solo un `INSERT` validado activa el trigger que archiva el snapshot current anterior de esa misma firma, fuente y periodo.

Los periodos recolectados son `24h`, `7d`, `30d` y `all`; no se genera `365d`.

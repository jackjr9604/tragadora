param(
  [Parameter(Mandatory = $true)][string]$StructureMetadata,
  [Parameter(Mandatory = $true)][string]$SecurityMetadata,
  [string]$OutputRoot = (Join-Path $PSScriptRoot '.local-supabase')
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $StructureMetadata -PathType Leaf)) {
  throw "No existe la metadata estructural: $StructureMetadata"
}
if (-not (Test-Path -LiteralPath $SecurityMetadata -PathType Leaf)) {
  throw "No existe la metadata de seguridad: $SecurityMetadata"
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$allowedOutputRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '.local-supabase'))
$resolvedOutputRoot = [System.IO.Path]::GetFullPath($OutputRoot)
if ($resolvedOutputRoot -ne $allowedOutputRoot -and
    -not $resolvedOutputRoot.StartsWith($allowedOutputRoot + [System.IO.Path]::DirectorySeparatorChar)) {
  throw 'OutputRoot debe permanecer dentro de scripts/e2e/.local-supabase.'
}
$OutputRoot = $resolvedOutputRoot
$projectRoot = Join-Path $OutputRoot 'project'
$supabaseRoot = Join-Path $projectRoot 'supabase'
$migrationRoot = Join-Path $supabaseRoot 'migrations'

# El directorio completo esta ignorado por Git y solo contiene una copia E2E.
if (Test-Path -LiteralPath $projectRoot) {
  Remove-Item -LiteralPath $projectRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $migrationRoot -Force | Out-Null

$structureRows = Import-Csv -LiteralPath $StructureMetadata
$securityRows = Import-Csv -LiteralPath $SecurityMetadata

$baseTables = @(
  'countries', 'platforms', 'profiles', 'site_content', 'media',
  'prop_firm_details', 'platform_availability', 'platform_translations',
  'challenges', 'challenge_variants', 'challenge_phases',
  'challenge_variant_phases', 'account_plans', 'challenge_reward_options',
  'payout_sources', 'payouts', 'payout_evidence', 'offers',
  'affiliate_links', 'affiliate_clicks', 'trading_profiles', 'favorites'
)

$columnsAddedLater = @{
  platforms = @('origin_country_code')
  prop_firm_details = @(
    'allows_scalping', 'allows_day_trading', 'allows_copy_trading',
    'time_limit_policy', 'consistency_rules', 'special_rules', 'ceo_name',
    'founded_at', 'broker_provider', 'inactivity_days', 'is_new'
  )
  media = @('category_id')
  platform_availability = @(
    'market', 'source_url', 'verified_at', 'rule_summary',
    'restriction_basis', 'restriction_list_complete'
  )
  offers = @(
    'includes_free_account', 'free_account_label', 'is_featured',
    'hot_badge', 'short_highlight'
  )
}

function Quote-Identifier([string]$value) {
  return '"' + $value.Replace('"', '""') + '"'
}

function Parse-Detail($row) {
  return $row.detalle | ConvertFrom-Json
}

$tableColumns = @{}
foreach ($table in $baseTables) {
  $excluded = @($columnsAddedLater[$table])
  $tableColumns[$table] = @(
    $structureRows |
      Where-Object { $_.seccion -eq '01_COLUMNAS' -and $_.tabla -eq $table } |
      ForEach-Object { Parse-Detail $_ } |
      Where-Object { $_.columna -notin $excluded } |
      Sort-Object orden
  )
  if ($tableColumns[$table].Count -eq 0) {
    throw "La exportacion no contiene columnas para public.$table"
  }
}

$enumRows = @(
  $structureRows |
    Where-Object { $_.seccion -eq '04_ENUM' } |
    ForEach-Object { Parse-Detail $_ }
)

$lines = [System.Collections.Generic.List[string]]::new()
$lines.Add('-- SOLO E2E LOCAL. Generado desde metadata de produccion; no desplegar.')
$lines.Add('-- Se aplica antes de 202608250001 dentro del proyecto aislado scripts/e2e/.local-supabase.')
$lines.Add('begin;')
$lines.Add('create extension if not exists pgcrypto with schema extensions;')
$lines.Add('create extension if not exists "uuid-ossp" with schema extensions;')
$lines.Add('create table public.tradagora_local_e2e_guard (singleton boolean primary key default true check (singleton));')
$lines.Add('insert into public.tradagora_local_e2e_guard(singleton) values (true);')
$lines.Add('revoke all on public.tradagora_local_e2e_guard from public, anon, authenticated;')
$lines.Add('')

foreach ($group in ($enumRows | Group-Object tipo | Sort-Object Name)) {
  $values = ($group.Group | Sort-Object orden | ForEach-Object { "'" + $_.valor.Replace("'", "''") + "'" }) -join ', '
  $lines.Add("create type public.$(Quote-Identifier $group.Name) as enum ($values);")
}
$lines.Add('')

foreach ($table in $baseTables) {
  $definitions = @()
  foreach ($column in $tableColumns[$table]) {
    $definition = "  $(Quote-Identifier $column.columna) $($column.tipo_sql)"
    if ($column.collation) { $definition += " collate $($column.collation)" }
    if ($column.generated) { throw "Columna generada no soportada sin expresion exportada: $table.$($column.columna)" }
    if ($column.identity) { throw "Columna identity no soportada sin opciones exportadas: $table.$($column.columna)" }
    if ($null -ne $column.default -and "$($column.default)" -ne '') { $definition += " default $($column.default)" }
    if (-not [bool]$column.nullable) { $definition += ' not null' }
    $definitions += $definition
  }
  $lines.Add("create table public.$(Quote-Identifier $table) (`n$($definitions -join ",`n")`n);")
  $lines.Add('')
}

$availableColumns = @{}
foreach ($table in $baseTables) {
  $availableColumns[$table] = @($tableColumns[$table] | ForEach-Object columna)
}

$constraints = @(
  $structureRows |
    Where-Object { $_.seccion -eq '02_CONSTRAINTS' -and $_.tabla -in $baseTables } |
    ForEach-Object { [pscustomobject]@{ table = $_.tabla; value = (Parse-Detail $_) } }
)

# Las PK/UNIQUE deben existir antes de crear las FK que las referencian.
$constraintOrder = @{ p = 0; u = 1; c = 2; f = 3; x = 4 }
foreach ($entry in ($constraints | Sort-Object @{ Expression = { $constraintOrder[[string]$_.value.tipo] } }, table, @{ Expression = { $_.value.nombre } })) {
  $definition = [string]$entry.value.definicion
  $excluded = @($columnsAddedLater[$entry.table])
  if ($excluded | Where-Object { $definition -match "(?i)\b$([regex]::Escape($_))\b" }) { continue }
  $lines.Add("alter table public.$(Quote-Identifier $entry.table) add constraint $(Quote-Identifier $entry.value.nombre) $definition;")
}

# La migracion 202609180001 exige que exista exactamente este UNIQUE legacy.
$lines.Add('alter table public.platform_availability add constraint platform_availability_platform_country_legacy_key unique (platform_id, country_code);')
$lines.Add('')

$constraintNames = @($constraints | ForEach-Object { $_.value.nombre })
$indexes = @(
  $structureRows |
    Where-Object { $_.seccion -eq '03_INDICES' -and $_.tabla -in $baseTables } |
    ForEach-Object { [pscustomobject]@{ table = $_.tabla; value = (Parse-Detail $_) } }
)
foreach ($entry in $indexes) {
  if ($entry.value.nombre -in $constraintNames) { continue }
  $definition = [string]$entry.value.definicion
  $excluded = @($columnsAddedLater[$entry.table])
  if ($excluded | Where-Object { $definition -match "(?i)\b$([regex]::Escape($_))\b" }) { continue }
  $lines.Add("$definition;")
}
$lines.Add('')

$baseFunctions = @('handle_new_user', 'is_admin', 'set_updated_at', 'update_updated_at')
foreach ($row in $securityRows | Where-Object { $_.seccion -eq '09_FUNCIONES_BASE' }) {
  $function = Parse-Detail $row
  if ($function.funcion -in $baseFunctions) {
    $lines.Add(([string]$function.definicion).TrimEnd() + ';')
  }
}

$baseTriggerNames = @(
  'on_auth_user_created', 'update_platforms_updated_at', 'update_profiles_updated_at',
  'update_challenges_updated_at', 'challenge_reward_options_set_updated_at'
)
foreach ($row in $securityRows | Where-Object { $_.seccion -eq '03_TRIGGERS' }) {
  $trigger = Parse-Detail $row
  if ($trigger.trigger -in $baseTriggerNames) {
    $lines.Add(([string]$trigger.definicion) + ';')
  }
}

foreach ($table in $baseTables) {
  $lines.Add("alter table public.$(Quote-Identifier $table) enable row level security;")
}

# Politicas publicas que las migraciones conservan o reemplazan por nombre.
foreach ($row in $securityRows | Where-Object { $_.seccion -eq '02_POLITICAS_RLS' }) {
  $policy = Parse-Detail $row
  if ($policy.tabla -notin $baseTables -or $policy.comando -ne 'SELECT') { continue }
  if (-not (@($policy.roles) | Where-Object { $_ -in @('public', 'anon') })) { continue }
  $roles = (@($policy.roles) -join ', ')
  $using = if ($policy.using) { [string]$policy.using } else { 'true' }
  $lines.Add("create policy $(Quote-Identifier $policy.politica) on public.$(Quote-Identifier $policy.tabla) for select to $roles using ($using);")
}

# Grants actuales para los roles de la API; RLS sigue siendo la barrera efectiva.
foreach ($row in $securityRows | Where-Object { $_.seccion -eq '05_GRANTS_TABLAS' }) {
  $grant = Parse-Detail $row
  if ($grant.tabla -notin $baseTables -or $grant.grantee -notin @('anon', 'authenticated', 'service_role')) { continue }
  $lines.Add("grant $($grant.privilegio) on table public.$(Quote-Identifier $grant.tabla) to $(Quote-Identifier $grant.grantee);")
}

$lines.Add('commit;')

$baselinePath = Join-Path $migrationRoot '202608240001_local_e2e_baseline.sql'
[System.IO.File]::WriteAllLines($baselinePath, $lines, [System.Text.UTF8Encoding]::new($false))

Copy-Item -LiteralPath (Join-Path $repoRoot 'supabase\config.toml') -Destination (Join-Path $supabaseRoot 'config.toml')
Get-ChildItem (Join-Path $repoRoot 'supabase\migrations') -Filter '*.sql' | Sort-Object Name | Copy-Item -Destination $migrationRoot

# Compatibilidad exclusiva de replay: 202608260001 crea esta policy abierta,
# pero 202609170002 valida que ninguna escritura WITH CHECK true sobreviva y no
# incluye su nombre entre los DROP historicos. Produccion ya no la conserva.
$compatibilityShim = @'
-- SOLO E2E LOCAL. Corrige una discontinuidad del historial sin editar migraciones aplicadas.
drop policy if exists "languages_authenticated_manage" on public.languages;
'@
[System.IO.File]::WriteAllText(
  (Join-Path $migrationRoot '202609170000_local_e2e_language_policy_compat.sql'),
  $compatibilityShim,
  [System.Text.UTF8Encoding]::new($false)
)

$configPath = Join-Path $supabaseRoot 'config.toml'
$config = Get-Content -LiteralPath $configPath -Raw
$config = $config.Replace('project_id = "tradagora-bulk-e2e"', 'project_id = "tradagora-bulk-e2e-baseline"')
$config = [regex]::Replace($config, '(?ms)(\[storage\]\s*enabled\s*=\s*)false', '${1}true', 1)
[System.IO.File]::WriteAllText($configPath, $config, [System.Text.UTF8Encoding]::new($false))

Write-Output "Proyecto E2E generado: $projectRoot"
Write-Output "Baseline local: $baselinePath"
Write-Output "Migraciones locales totales: $((Get-ChildItem $migrationRoot -Filter '*.sql').Count)"

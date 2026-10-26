[CmdletBinding()]
param(
  [string]$Container = 'supabase_db_tradagora-bulk-e2e-baseline',
  [string]$SourceDatabase = 'postgres'
)

$ErrorActionPreference = 'Stop'
$prefix = 'tradagora_offer_c5c1f_'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$sqlRoot = Join-Path $repoRoot 'scripts\sql'
$migration = Join-Path $repoRoot 'supabase\migrations\202610240002_admin_offer_transactional_writes.sql'
$createdDatabases = [System.Collections.Generic.HashSet[string]]::new()
$remoteDir = "/tmp/codex-offer-c5c1f-$PID"

function Invoke-Docker {
  param([string[]]$Arguments,[switch]$AllowFailure)
  & docker @Arguments
  $code = $LASTEXITCODE
  if (-not $AllowFailure -and $code -ne 0) {
    throw "docker $($Arguments -join ' ') terminó con código $code"
  }
  return $code
}

function Assert-SafeDatabaseName([string]$Database) {
  if ($Database -notmatch '^tradagora_offer_c5c1f_[0-9]+_[0-9]{17}$') {
    throw "Nombre de base temporal no autorizado: $Database"
  }
  if ($Database -eq $SourceDatabase) { throw 'La base temporal coincide con la base origen' }
}

function Test-DatabaseExists([string]$Database) {
  $result = & docker exec $Container psql -U postgres -d $SourceDatabase -X -Atc "select count(*) from pg_database where datname='$Database'"
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo consultar pg_database en el contenedor local' }
  return (($result | Select-Object -Last 1).Trim() -eq '1')
}

function Remove-TemporaryDatabase([string]$Database) {
  Assert-SafeDatabaseName $Database
  if (-not $createdDatabases.Contains($Database)) {
    throw "Se rechazó eliminar una base no creada por este runner: $Database"
  }
  Invoke-Docker -Arguments @('exec',$Container,'psql','-U','postgres','-d',$SourceDatabase,'-X','-v','ON_ERROR_STOP=1','-c',"select pg_terminate_backend(pid) from pg_stat_activity where datname='$Database' and pid<>pg_backend_pid();") | Out-Null
  Invoke-Docker -Arguments @('exec',$Container,'dropdb','-U','postgres','--if-exists',$Database) | Out-Null
  if (Test-DatabaseExists $Database) { throw "La base temporal $Database no fue eliminada" }
  $createdDatabases.Remove($Database) | Out-Null
}

function Copy-TestFiles {
  Invoke-Docker -Arguments @('exec',$Container,'mkdir','-p',$remoteDir) | Out-Null
  $files = @{
    'prestate.sql' = Join-Path $sqlRoot 'admin-offer-transactional-writes-local-prestate.sql'
    'precheck.sql' = Join-Path $sqlRoot 'admin-offer-transactional-writes-precheck.sql'
    'migration.sql' = $migration
    'transaction.sql' = Join-Path $sqlRoot 'admin-offer-transactional-writes-postgres-test.sql'
    'concurrency.sql' = Join-Path $sqlRoot 'admin-offer-transactional-writes-concurrency-test.sql'
    'postcheck.sql' = Join-Path $sqlRoot 'admin-offer-transactional-writes-postcheck.sql'
  }
  foreach ($entry in $files.GetEnumerator()) {
    Invoke-Docker -Arguments @('cp',$entry.Value,"${Container}:$remoteDir/$($entry.Key)") | Out-Null
  }
}

function New-TemporaryDatabase([string]$Scenario) {
  $timestamp = Get-Date -Format 'yyyyMMddHHmmssfff'
  $database = "${prefix}${PID}_${timestamp}"
  Assert-SafeDatabaseName $database
  if (Test-DatabaseExists $database) { throw "La base temporal ya existe: $database" }
  Invoke-Docker -Arguments @('exec',$Container,'createdb','-U','postgres','-T','template0',$database) | Out-Null
  $createdDatabases.Add($database) | Out-Null
  $clone = "pg_dump -U postgres -d '$SourceDatabase' --format=c --no-owner --no-privileges --exclude-table=vault.secrets | pg_restore -U postgres -d '$database' --no-owner --no-privileges"
  Invoke-Docker -Arguments @('exec',$Container,'sh','-c',$clone) | Out-Null
  Invoke-Docker -Arguments @('exec',$Container,'psql','-U','postgres','-d',$database,'-X','-v','ON_ERROR_STOP=1','-f',"$remoteDir/prestate.sql") | Out-Null
  Write-Host "[$Scenario] Base temporal preparada: $database"
  return $database
}

function Invoke-PsqlFile([string]$Database,[string]$File,[string[]]$Variables=@(),[switch]$AllowFailure) {
  $arguments = @('exec',$Container,'psql','-U','supabase_admin','-d',$Database,'-X','-v','ON_ERROR_STOP=1')
  foreach ($variable in $Variables) { $arguments += @('-v',$variable) }
  $arguments += @('-f',"$remoteDir/$File")
  return Invoke-Docker -Arguments $arguments -AllowFailure:$AllowFailure
}

function Invoke-Scenario([string]$Scenario) {
  $database = $null
  try {
    $database = New-TemporaryDatabase $Scenario
    Invoke-PsqlFile $database 'precheck.sql' | Out-Null
    Invoke-Docker -Arguments @('exec',$Container,'psql','-U','postgres','-d',$database,'-X','-v','ON_ERROR_STOP=1','-f',"$remoteDir/migration.sql") | Out-Null
    if ($Scenario -eq 'forced-failure') {
      $code = [int](@(Invoke-PsqlFile $database 'concurrency.sql' @('E2E_FORCE_FAILURE=1') -AllowFailure)[-1])
      if ($code -eq 0) { throw 'El fallo deliberado produjo un falso PASS' }
      return
    }
    if ($Scenario -eq 'forced-timeout') {
      $code = [int](@(Invoke-PsqlFile $database 'concurrency.sql' @('E2E_FORCE_TIMEOUT=1') -AllowFailure)[-1])
      if ($code -eq 0) { throw 'El timeout deliberado produjo un falso PASS' }
      return
    }
    Invoke-PsqlFile $database 'transaction.sql' | Out-Null
    Invoke-PsqlFile $database 'concurrency.sql' | Out-Null
    Invoke-PsqlFile $database 'postcheck.sql' | Out-Null
  }
  finally {
    if ($database -and $createdDatabases.Contains($database)) {
      Remove-TemporaryDatabase $database
      Write-Host "[$Scenario] Limpieza confirmada: $database"
    }
  }
}

try {
  if ($SourceDatabase -match '(supabase\.co|postgresql:|https?:)') { throw 'La base origen debe ser un nombre local, no una URL' }
  Invoke-Docker -Arguments @('version','--format','{{.Server.Version}}') | Out-Null
  $image = (& docker inspect --format '{{.Config.Image}}' $Container).Trim()
  if ($LASTEXITCODE -ne 0 -or $image -notmatch 'supabase/postgres:15\.') {
    throw "El contenedor no es PostgreSQL Supabase 15: $image"
  }
  $guard = (& docker exec $Container psql -U postgres -d $SourceDatabase -X -Atc "select to_regclass('public.tradagora_local_e2e_guard') is not null").Trim()
  if ($LASTEXITCODE -ne 0 -or $guard -ne 't') { throw 'Falta la guarda del entorno E2E local' }
  Copy-TestFiles
  Invoke-Scenario 'forced-failure'
  Invoke-Scenario 'forced-timeout'
  Invoke-Scenario 'normal'
  Write-Host 'PASS: escenarios negativos, reejecución limpia y validación completa'
}
finally {
  foreach ($database in @($createdDatabases)) {
    try { Remove-TemporaryDatabase $database } catch { Write-Error $_ }
  }
  Invoke-Docker -Arguments @('exec',$Container,'rm','-rf',$remoteDir) -AllowFailure | Out-Null
}

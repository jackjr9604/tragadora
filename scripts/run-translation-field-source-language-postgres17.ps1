[CmdletBinding()]
param(
  [string]$SourceContainer='supabase_db_tradagora-bulk-e2e-baseline',
  [string]$TargetContainer='supabase_db_jarvis-desktop',
  [string]$SourceDatabase='postgres'
)
$ErrorActionPreference='Stop'
$prefix='tradagora_source_lang17_'
$database="${prefix}$PID`_$(Get-Date -Format 'yyyyMMddHHmmssfff')"
$remote="/tmp/source-lang17-$PID"
$sourceDump="/tmp/source-lang17-source-$PID.dump"
$hostDump=Join-Path ([IO.Path]::GetTempPath()) "tradagora-source-lang17-$PID.dump"
$created=$false
function Invoke-Docker([string[]]$Arguments){& docker @Arguments;if($LASTEXITCODE-ne 0){throw "docker $($Arguments -join ' ') falló ($LASTEXITCODE)"}}
function Guard([string]$Name){if($Name-notmatch '^tradagora_source_lang17_[0-9]+_[0-9]{17}$' -or $Name-eq $SourceDatabase){throw "Base temporal no autorizada: $Name"}}
function Psql([string]$User,[string]$File){Invoke-Docker @('exec',$TargetContainer,'psql','-U',$User,'-d',$database,'-X','-v','ON_ERROR_STOP=1','-f',"$remote/$File")}
try{
  Guard $database
  $sourceImage=(& docker inspect --format '{{.Config.Image}}' $SourceContainer).Trim();if($LASTEXITCODE-ne 0 -or $sourceImage-notmatch 'supabase/postgres:15\.'){throw "Origen local inesperado: $sourceImage"}
  $targetImage=(& docker inspect --format '{{.Config.Image}}' $TargetContainer).Trim();if($LASTEXITCODE-ne 0 -or $targetImage-notmatch 'supabase/postgres:17\.'){throw "Destino no es Supabase PostgreSQL 17: $targetImage"}
  Invoke-Docker @('exec',$TargetContainer,'mkdir','-p',$remote)
  $files=@{
    'prep-platform.sql'='supabase/migrations/202610240001_admin_platform_transactional_writes.sql';'prep-offer.sql'='supabase/migrations/202610240002_admin_offer_transactional_writes.sql';'prep-coverage.sql'='supabase/migrations/202610270001_translation_editorial_coverage.sql';
    'migration.sql'='supabase/migrations/202610270002_translation_field_source_language.sql';'fixtures.sql'='scripts/sql/translation-field-source-language-fixtures.sql';'local-acl.sql'='scripts/sql/translation-field-source-language-local-acl.sql';'precheck.sql'='scripts/sql/translation-field-source-language-precheck.sql';'test.sql'='scripts/sql/translation-field-source-language-postgres-test.sql';'concurrency.sql'='scripts/sql/translation-field-source-language-concurrency-test.sql';'postcheck.sql'='scripts/sql/translation-field-source-language-postcheck.sql'}
  foreach($entry in $files.GetEnumerator()){Invoke-Docker @('cp',(Join-Path $PSScriptRoot '..' $entry.Value),"${TargetContainer}:$remote/$($entry.Key)")}
  Invoke-Docker @('exec',$SourceContainer,'pg_dump','-U','postgres','-d',$SourceDatabase,'--format=c','--no-owner','--no-privileges','--exclude-table=vault.secrets','-f',$sourceDump)
  Invoke-Docker @('cp',"${SourceContainer}:$sourceDump",$hostDump)
  Invoke-Docker @('cp',$hostDump,"${TargetContainer}:$remote/source.dump")
  Invoke-Docker @('exec',$TargetContainer,'createdb','-U','postgres','-T','template0',$database);$created=$true
  Invoke-Docker @('exec',$TargetContainer,'pg_restore','-U','postgres','-d',$database,'--no-owner','--no-privileges',"$remote/source.dump")
  Psql 'postgres' 'prep-platform.sql';Psql 'postgres' 'prep-offer.sql';Psql 'postgres' 'prep-coverage.sql';Psql 'postgres' 'local-acl.sql';Psql 'postgres' 'fixtures.sql';Psql 'postgres' 'precheck.sql'
  Psql 'postgres' 'migration.sql';Psql 'postgres' 'migration.sql';Psql 'postgres' 'test.sql';Psql 'supabase_admin' 'concurrency.sql';Psql 'postgres' 'postcheck.sql'
  Write-Host "PASS PostgreSQL 17 aislado: $database ($targetImage)"
}finally{
  if($created){Guard $database;Invoke-Docker @('exec',$TargetContainer,'psql','-U','postgres','-d',$SourceDatabase,'-X','-v','ON_ERROR_STOP=1','-c',"select pg_terminate_backend(pid) from pg_stat_activity where datname='$database' and pid<>pg_backend_pid();");Invoke-Docker @('exec',$TargetContainer,'dropdb','-U','postgres','--if-exists',$database)}
  & docker exec $SourceContainer rm -f $sourceDump | Out-Null
  & docker exec $TargetContainer rm -rf $remote | Out-Null
  if(Test-Path -LiteralPath $hostDump){Remove-Item -LiteralPath $hostDump -Force}
  if($created){$left=(& docker exec $TargetContainer psql -U postgres -d $SourceDatabase -X -Atc "select count(*) from pg_database where datname='$database'").Trim();if($left-ne'0'){throw "La base temporal persistió: $database"}}
}

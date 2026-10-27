[CmdletBinding()]
param([string]$Container='supabase_db_tradagora-bulk-e2e-baseline',[string]$SourceDatabase='postgres')
$ErrorActionPreference='Stop'
$prefix='tradagora_source_lang_'
$database="${prefix}$PID`_$(Get-Date -Format 'yyyyMMddHHmmssfff')"
$remote="/tmp/source-lang-$PID"
$created=$false
function Invoke-Docker([string[]]$Arguments){& docker @Arguments;if($LASTEXITCODE-ne 0){throw "docker $($Arguments -join ' ') falló ($LASTEXITCODE)"}}
function Guard([string]$Name){if($Name-notmatch '^tradagora_source_lang_[0-9]+_[0-9]{17}$' -or $Name-eq $SourceDatabase){throw "Base temporal no autorizada: $Name"}}
function Psql([string]$User,[string]$File){Invoke-Docker @('exec',$Container,'psql','-U',$User,'-d',$database,'-X','-v','ON_ERROR_STOP=1','-f',"$remote/$File")}
try{
  Guard $database
  $image=(& docker inspect --format '{{.Config.Image}}' $Container).Trim();if($LASTEXITCODE-ne 0 -or $image-notmatch 'supabase/postgres:15\.'){throw "Contenedor PostgreSQL 15 inválido: $image"}
  Invoke-Docker @('exec',$Container,'mkdir','-p',$remote)
  $files=@{
    'prep-platform.sql'='supabase/migrations/202610240001_admin_platform_transactional_writes.sql';'prep-offer.sql'='supabase/migrations/202610240002_admin_offer_transactional_writes.sql';'prep-coverage.sql'='supabase/migrations/202610270001_translation_editorial_coverage.sql';
    'migration.sql'='supabase/migrations/202610270002_translation_field_source_language.sql';'fixtures.sql'='scripts/sql/translation-field-source-language-fixtures.sql';'precheck.sql'='scripts/sql/translation-field-source-language-precheck.sql';'test.sql'='scripts/sql/translation-field-source-language-postgres-test.sql';'concurrency.sql'='scripts/sql/translation-field-source-language-concurrency-test.sql';'postcheck.sql'='scripts/sql/translation-field-source-language-postcheck.sql'}
  foreach($entry in $files.GetEnumerator()){Invoke-Docker @('cp',(Join-Path $PSScriptRoot '..' $entry.Value),"${Container}:$remote/$($entry.Key)")}
  Invoke-Docker @('exec',$Container,'createdb','-U','postgres','-T','template0',$database);$created=$true
  Invoke-Docker @('exec',$Container,'sh','-c',"pg_dump -U postgres -d '$SourceDatabase' --format=c --no-owner --no-privileges --exclude-table=vault.secrets | pg_restore -U postgres -d '$database' --no-owner --no-privileges")
  Psql 'postgres' 'prep-platform.sql';Psql 'postgres' 'prep-offer.sql';Psql 'postgres' 'prep-coverage.sql';Psql 'postgres' 'fixtures.sql';Psql 'postgres' 'precheck.sql'
  Psql 'postgres' 'migration.sql';Psql 'postgres' 'migration.sql';Psql 'postgres' 'test.sql';Psql 'supabase_admin' 'concurrency.sql';Psql 'postgres' 'postcheck.sql'
  Write-Host "PASS PostgreSQL aislado: $database"
}finally{
  if($created){Guard $database;Invoke-Docker @('exec',$Container,'psql','-U','postgres','-d',$SourceDatabase,'-X','-v','ON_ERROR_STOP=1','-c',"select pg_terminate_backend(pid) from pg_stat_activity where datname='$database' and pid<>pg_backend_pid();");Invoke-Docker @('exec',$Container,'dropdb','-U','postgres','--if-exists',$database)}
  & docker exec $Container rm -rf $remote | Out-Null
  if($created){$left=(& docker exec $Container psql -U postgres -d $SourceDatabase -X -Atc "select count(*) from pg_database where datname='$database'").Trim();if($left-ne'0'){throw "La base temporal persistió: $database"}}
}

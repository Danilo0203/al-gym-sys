param([Parameter(Mandatory=$true)][string]$AppRoot, [Parameter(Mandatory=$true)][string]$DataRoot)
. "$PSScriptRoot\Common.ps1"
Assert-Administrator
Assert-ServiceOwnership $AppRoot
$id = 'AlGymMigration'
$services = Join-Path $AppRoot 'services'
$exe = Join-Path $services "$id.exe"
Copy-Item (Join-Path $AppRoot 'runtime\WinSW-x64.exe') $exe -Force
$escape = { param($value) [Security.SecurityElement]::Escape($value) }
$node = & $escape (Join-Path $AppRoot 'runtime\node\node.exe')
$arguments = & $escape ('"' + (Join-Path $AppRoot 'backend\windows\migration-worker.mjs') + '" "' + $AppRoot + '" "' + $DataRoot + '"')
$work = & $escape (Join-Path $AppRoot 'backend')
$logs = & $escape (Join-Path $DataRoot 'private\migration-logs')
Protect-Directory (Join-Path $DataRoot 'private\migration-logs')
# This worker alone uses LocalSystem; web/backend/sync keep LocalService.
# Its only input is a validated data package in the fixed inbox. No listening port.
Write-Utf8File (Join-Path $services "$id.xml") @"
<service>
  <id>$id</id><name>$id</name><description>Importación inicial de datos de AlGym</description>
  <executable>$node</executable><arguments>$arguments</arguments><workingdirectory>$work</workingdirectory>
  <startmode>Automatic</startmode><delayedAutoStart>true</delayedAutoStart>
  <depend>AlGymPostgres</depend><onfailure action="restart" delay="10 sec"/>
  <stoptimeout>180 sec</stoptimeout><logpath>$logs</logpath>
  <log mode="roll-by-size"><sizeThreshold>1024</sizeThreshold><keepFiles>3</keepFiles></log>
</service>
"@
if (-not (Get-Service $id -ErrorAction SilentlyContinue)) { Invoke-Checked $exe @('install') }
Start-Service $id

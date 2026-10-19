param([string]$AppRoot = "$env:ProgramFiles\AlGym", [string]$DataRoot = "$env:ProgramData\AlGym")
. "$PSScriptRoot\Common.ps1"
Assert-Administrator
$state = Read-Installation $DataRoot $AppRoot
if (-not $state -or -not $state.initialized) { throw 'No existe una instalación terminada.' }
Assert-ServiceOwnership $AppRoot
foreach ($name in @('AlGymPostgres', 'AlGymBackend', 'AlGymSync', 'AlGymWeb')) {
    $service = Get-CimInstance Win32_Service -Filter "Name='$name'"
    if (-not $service -or $service.State -ne 'Running' -or $service.StartMode -ne 'Auto') {
        throw "$name no está funcionando con inicio automático."
    }
    $expected = if ($name -eq 'AlGymPostgres') { 'NetworkService' } else { 'LocalService' }
    if ($service.StartName -notmatch $expected) { throw "$name tiene una cuenta de servicio inesperada." }
}
$ready = Invoke-RestMethod 'http://127.0.0.1:4000/health/ready'
if ($ready.status -ne 'ready' -or $ready.database.name -ne 'algym_windows' -or $ready.database.user -ne 'algym_app') {
    throw 'El backend no está usando la base y el usuario esperados.'
}
Wait-Http 'http://127.0.0.1:8080/health/ready' 10
Wait-Http 'http://127.0.0.1:3000/api/health' 10
if (-not (Get-ScheduledTask -TaskName 'AlGym Backup')) { throw 'Falta el respaldo programado.' }
$latest = Get-ChildItem (Join-Path $DataRoot 'backups') -Directory | Sort-Object Name -Descending | Select-Object -First 1
if (-not $latest) { throw 'No hay respaldos.' }
$manifest = Get-Content (Join-Path $latest.FullName 'manifest.json') -Raw | ConvertFrom-Json
foreach ($file in $manifest.files) {
    $candidate = [IO.Path]::GetFullPath((Join-Path $latest.FullName $file.path))
    if (-not $candidate.StartsWith(($latest.FullName + '\'), [StringComparison]::OrdinalIgnoreCase)) { throw 'Ruta inválida en respaldo.' }
    if ((Get-FileHash -LiteralPath $candidate -Algorithm SHA256).Hash -ne $file.sha256) { throw 'Hash incorrecto en respaldo.' }
}
Write-Output 'Servicios, conexión de la aplicación, respaldo programado y hashes: correctos.'
Write-Output 'Falta comprobar visualmente el acceso directo y el navegador después de reiniciar e iniciar sesión.'

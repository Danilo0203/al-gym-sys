<#
.SYNOPSIS
  Activa (o desactiva) la actualización automática de AlGym desde GitHub Releases.

  - Copia Update-AlGym.ps1 a DataRoot\private\updater (solo SYSTEM y Administradores).
  - Guarda el token de GitHub de solo lectura (si el repositorio es privado).
  - Registra la tarea programada "AlGym Update" (SYSTEM, diaria a la hora indicada).

.EXAMPLE
  # PowerShell como Administrador, desde esta carpeta:
  .\Configure-AutoUpdate.ps1                 # pide el token y programa a las 03:00
  .\Configure-AutoUpdate.ps1 -At 23:30       # cambia la hora
  .\Configure-AutoUpdate.ps1 -ReplaceToken   # cambia el token
  .\Configure-AutoUpdate.ps1 -Disable        # elimina la tarea programada
#>
param(
    [string]$AppRoot = "$env:ProgramFiles\AlGym",
    [string]$DataRoot = "$env:ProgramData\AlGym",
    [ValidatePattern('^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$')][string]$Repository = 'Danilo0203/al-gym-sys',
    [ValidatePattern('^\d{2}:\d{2}$')][string]$At = '03:00',
    [switch]$ReplaceToken,
    [switch]$NoToken,
    [switch]$Disable
)
. "$PSScriptRoot\Common.ps1"
Assert-Administrator
$taskName = 'AlGym Update'
$updaterRoot = Join-Path $DataRoot 'private\updater'
$tokenFile = Join-Path $updaterRoot 'github-token.txt'

if ($Disable) {
    if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    }
    Write-Output 'Actualización automática desactivada (se conservó la configuración y el token).'
    exit 0
}

$state = Read-Installation $DataRoot $AppRoot
if (-not $state -or -not $state.initialized) { throw 'AlGym no está instalado en este equipo.' }
$source = Join-Path $PSScriptRoot 'Update-AlGym.ps1'
if (-not (Test-Path -LiteralPath $source)) { throw "No se encontró $source." }

Protect-Directory $updaterRoot
Protect-Directory (Join-Path $DataRoot 'updates')
Copy-Item -LiteralPath $source -Destination (Join-Path $updaterRoot 'Update-AlGym.ps1') -Force
Write-Utf8File (Join-Path $updaterRoot 'update.json') (@{ repository = $Repository; enabled = $true } | ConvertTo-Json)

if (-not $NoToken -and ($ReplaceToken -or -not (Test-Path -LiteralPath $tokenFile))) {
    Write-Host 'Pegue un token de GitHub de SOLO LECTURA (fine-grained, repositorio' $Repository ', permiso Contents: Read).'
    Write-Host 'Deje vacío si el repositorio es público.'
    $secure = Read-Host 'Token' -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    if ($plain.Trim()) { Write-Utf8File $tokenFile $plain.Trim() }
    elseif (Test-Path -LiteralPath $tokenFile) { Remove-Item -LiteralPath $tokenFile -Force }
    $plain = $null
}

$script = Join-Path $updaterRoot 'Update-AlGym.ps1'
$action = New-ScheduledTaskAction -Execute "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" `
    -Argument ('-NoProfile -ExecutionPolicy Bypass -File "' + $script + '" -AppRoot "' + $AppRoot + '" -DataRoot "' + $DataRoot + '"')
$trigger = New-ScheduledTaskTrigger -Daily -At $At
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2)
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings `
    -User 'SYSTEM' -RunLevel Highest -Description 'Instala automáticamente nuevas versiones de AlGym publicadas en GitHub.' -Force | Out-Null
Write-Output "Tarea '$taskName' programada diariamente a las $At (SYSTEM)."

Write-Output 'Comprobando conexión con GitHub...'
& "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass `
    -File $script -AppRoot $AppRoot -DataRoot $DataRoot -CheckOnly
if ($LASTEXITCODE -ne 0) {
    Write-Warning "La comprobación falló. Revise $updaterRoot\logs y el token."
    exit 1
}
Write-Output 'Listo. Para actualizar ahora: Start-ScheduledTask -TaskName "AlGym Update"'

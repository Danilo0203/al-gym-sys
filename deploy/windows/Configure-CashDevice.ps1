param(
    [Parameter(Mandatory=$true)][string]$AppRoot,
    [Parameter(Mandatory=$true)][string]$DataRoot,
    [Parameter(Mandatory=$true)][ValidatePattern('^[^\r\n"#]{1,128}$')][string]$PrinterName,
    [switch]$EnableDrawer
)
. "$PSScriptRoot\Common.ps1"
Assert-Administrator
Assert-ServiceOwnership $AppRoot
$state = Read-Installation $DataRoot $AppRoot
if (-not $state -or -not $state.initialized) { throw 'Complete primero la instalacion.' }
$helper = Join-Path $AppRoot 'backend\windows\Invoke-CashDevice.ps1'
if (-not (Test-Path -LiteralPath $helper)) { throw 'Instale primero la version con soporte de cajon.' }
# Esta consulta no imprime, no mueve papel y no abre el cajon.
$ps = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$inspection = & $ps -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $helper -PrinterName $PrinterName -Kind inspect
if ($LASTEXITCODE -ne 0) { throw 'No se pudo consultar la impresora seleccionada.' }
$printer = $inspection | ConvertFrom-Json
if ($printer.Status -ne 0 -or $printer.Jobs -ne 0) { throw 'La impresora tiene errores o trabajos pendientes.' }
$file = Join-Path $DataRoot 'config\backend.env'
$original = [IO.File]::ReadAllText($file)
$retained = $original -split '\r?\n' | Where-Object { $_ -notmatch '^\s*CASH_(DRAWER_ENABLED|PRINTER_NAME|DEVICE_DATA_DIR)\s*=' }
$deviceDirectory = Join-Path $DataRoot 'cash-device'
Protect-Directory $deviceDirectory @() @('S-1-5-19')
$enabled = if ($EnableDrawer) { 'true' } else { 'false' }
$settings = @("CASH_DRAWER_ENABLED=$enabled", "CASH_PRINTER_NAME=$PrinterName",
    ('CASH_DEVICE_DATA_DIR=' + $deviceDirectory.Replace('\','/')))
$updated = (@($retained) + $settings) -join "`n"
$backup = Join-Path $DataRoot ('private\backend-before-cash-' + [Guid]::NewGuid().ToString('N') + '.env')
Write-Utf8File $backup $original
$wasRunning = (Get-Service AlGymBackend).Status -eq 'Running'
$webWasRunning = (Get-Service AlGymWeb).Status -eq 'Running'
try {
    if ($wasRunning -and $webWasRunning) { Stop-Service AlGymWeb }
    if ($wasRunning) { Stop-Service AlGymBackend }
    Write-Utf8File $file $updated
    if ($wasRunning) {
        Start-Service AlGymBackend
        Wait-Http 'http://127.0.0.1:4000/health/ready'
    }
    if ($wasRunning -and $webWasRunning) {
        Start-Service AlGymWeb
        Wait-Http 'http://127.0.0.1:3000/api/health'
    }
    Write-Output "Dispositivo guardado: $PrinterName. Apertura automatica: $enabled. No se enviaron ordenes fisicas."
} catch {
    Write-Utf8File $file $original
    if ($wasRunning) {
        if ($webWasRunning) { Stop-Service AlGymWeb -ErrorAction SilentlyContinue }
        Restart-Service AlGymBackend -ErrorAction SilentlyContinue
        if ($webWasRunning) { Start-Service AlGymWeb -ErrorAction SilentlyContinue }
    }
    throw
}

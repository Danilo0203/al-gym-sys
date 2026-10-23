param(
    [Parameter(Mandatory=$true)][string]$AppRoot,
    [Parameter(Mandatory=$true)][string]$DataRoot,
    [Parameter(Mandatory=$true)][string]$Package,
    [Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{64}$')][string]$ExpectedHash,
    [switch]$Headless,
    [string]$ResultPath,
    [ValidateSet("initial","review","update")][string]$Mode = "initial",
    [string]$BaselinePackage,
    [ValidatePattern("^[a-f0-9]{64}$")][string]$ExpectedPlan
)
. "$PSScriptRoot\Common.ps1"
$failureMessage = ''; $report = $null
$running = @(); $folder = $null; $code = 1; $mutex = $null; $owned = $false
function Invoke-DataTool([string]$Action, [string]$Path, $Request) {
    $psi = New-Object Diagnostics.ProcessStartInfo
    $psi.FileName = Join-Path $AppRoot 'runtime\node\node.exe'
    $tool = if ($Action -in @('review','update')) { 'backend\windows\update-transfer.mjs' } else { 'backend\windows\transfer.mjs' }
    $psi.Arguments = '"' + (Join-Path $AppRoot $tool) + '" ' + $Action + ' "' + $Path + '" ' + $ExpectedHash
    $psi.UseShellExecute = $false; $psi.CreateNoWindow = $true
    $psi.RedirectStandardInput = $true; $psi.RedirectStandardOutput = $true; $psi.RedirectStandardError = $true
    $proc = [Diagnostics.Process]::Start($psi)
    $bytes = [Text.Encoding]::UTF8.GetBytes(($Request | ConvertTo-Json -Compress))
    $proc.StandardInput.BaseStream.Write($bytes, 0, $bytes.Length); $proc.StandardInput.Close()
    $stdout = $proc.StandardOutput.ReadToEnd(); $stderr = $proc.StandardError.ReadToEnd(); $proc.WaitForExit()
    if ($proc.ExitCode -ne 0) { throw $stderr.Trim() }
    return ($stdout | ConvertFrom-Json)
}
try {
    Assert-Administrator
    $mutex = New-Object Threading.Mutex($false, 'Global\AlGymDataImport')
    $owned = $mutex.WaitOne(0)
    if (-not $owned) { throw 'Hay otra importación en curso.' }
    $state = Read-Installation $DataRoot $AppRoot
    if (-not $state -or -not $state.initialized) { throw 'Completa primero la instalación de AlGym.' }
    Assert-ServiceOwnership $AppRoot
    $file = Get-Item -LiteralPath $Package
    if ($file.Length -gt 268435456 -or $file.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Paquete inválido.' }
    $folder = Join-Path $DataRoot ('private\import-' + [guid]::NewGuid().ToString('N'))
    Protect-Directory $folder
    $copy = Join-Path $folder 'data.algym'
    Copy-Item -LiteralPath $Package -Destination $copy
    if ((Get-FileHash -LiteralPath $copy -Algorithm SHA256).Hash.ToLowerInvariant() -ne $ExpectedHash) {
        throw 'El archivo cambió desde la revisión. Selecciónalo de nuevo.'
    }
    $request = @{installationId=$state.installationId;host=$state.host;port=$state.port;database=$state.database;
        adminPassword=$state.adminPassword;appPassword=$state.appPassword;syncPassword=$state.syncPassword;
        mediaRoot=(Join-Path $DataRoot 'media')}
    if ($BaselinePackage) {
        $baselineInfo = Get-Item -LiteralPath $BaselinePackage
        if ($baselineInfo.Length -gt 268435456 -or $baselineInfo.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Respaldo original inválido.' }
        $request.baselineFile = Join-Path $folder 'baseline.algym'
        Copy-Item -LiteralPath $BaselinePackage -Destination $request.baselineFile
    }
    if ($ExpectedPlan) { $request.expectedPlan = $ExpectedPlan }
    $action = if ($Mode -eq 'initial') { 'preview' } else { 'review' }
    $preview = Invoke-DataTool $action $copy $request
    if ($Mode -eq 'review') { $report = $preview; $code = 0 }
    elseif (($preview.PSObject.Properties['alreadyImported'] -and $preview.alreadyImported) -or ($preview.PSObject.Properties['alreadyApplied'] -and $preview.alreadyApplied)) { $code = 0 }
    else {
        if ($Mode -eq 'update' -and (-not $preview.canApply -or -not $ExpectedPlan -or $preview.planHash -ne $ExpectedPlan)) {
            throw 'Los datos locales cambiaron o hay conflictos. Revisa la actualización nuevamente.'
        }
        foreach ($name in @('AlGymWeb','AlGymSync','AlGymBackend')) {
            $service = Get-Service $name
            if ($service.Status -eq 'Running') {
                $running += $name; Stop-Service $name
                $service.WaitForStatus('Stopped',[TimeSpan]::FromSeconds(45))
            }
        }
        & "$PSScriptRoot\Backup-AlGym.ps1" -AppRoot $AppRoot -DataRoot $DataRoot
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear el respaldo previo. No se importaron los datos.' }
        $syncFile = Join-Path $DataRoot 'config\sync.env'
        $sync = Get-Content -LiteralPath $syncFile | Where-Object { $_ -notmatch '^SYNC_COMMAND_DELIVERY_PAUSED=' }
        Write-Utf8File $syncFile (($sync + 'SYNC_COMMAND_DELIVERY_PAUSED=true') -join "`n")
        $applyAction = if ($Mode -eq 'update') { 'update' } else { 'import' }
        $report = Invoke-DataTool $applyAction $copy $request
        if ($Mode -eq 'update' -and -not (($report.PSObject.Properties['applied'] -and $report.applied) -or ($report.PSObject.Properties['alreadyApplied'] -and $report.alreadyApplied))) { throw 'Hay conflictos. Revisa la actualización nuevamente; los datos se conservaron.' }
        $reportName = if ($Mode -eq 'update') { 'private\last-update.json' } else { 'private\last-import.json' }
        Write-Utf8File (Join-Path $DataRoot $reportName) ($report | ConvertTo-Json -Depth 8)
        foreach ($directory in @('media','media\exercises','media\products','media\avatars')) {
            if (Test-Path (Join-Path $DataRoot $directory)) { Protect-Directory (Join-Path $DataRoot $directory) @() @('S-1-5-19') }
        }
        $code = 0
    }
} catch {
    $failureMessage = $_.Exception.Message
    if (-not $Headless) {
        Add-Type -AssemblyName System.Windows.Forms
        [Windows.Forms.MessageBox]::Show($failureMessage, 'AlGym - Importación pendiente') | Out-Null
    }
} finally {
    foreach ($name in @('AlGymBackend','AlGymSync','AlGymWeb')) {
        if ($running -contains $name) { try { Start-Service $name } catch { $code = 1 } }
    }
    if ($folder) { Remove-Item -LiteralPath $folder -Recurse -Force -ErrorAction SilentlyContinue }
    if ($owned) { $mutex.ReleaseMutex() }
    if ($mutex) { $mutex.Dispose() }
}
if ($code -eq 0 -and $Mode -ne 'review') {
    try { Wait-Http 'http://127.0.0.1:4000/health/ready'; Wait-Http 'http://127.0.0.1:3000/api/health'; Wait-Http 'http://127.0.0.1:8080/health/ready' }
    catch {
        $failureMessage = 'La importación terminó, pero un servicio no respondió. Revisa los registros de AlGym.'
        if (-not $Headless) {
            Add-Type -AssemblyName System.Windows.Forms
            [Windows.Forms.MessageBox]::Show($failureMessage, 'AlGym') | Out-Null
        }
        $code = 1
    }
}
if ($Headless -and $ResultPath) {
    Write-Utf8File $ResultPath (@{success=($code -eq 0); message=$failureMessage; review=$(if ($Mode -eq 'review') { $report } else { $null })} | ConvertTo-Json -Depth 8 -Compress)
}
exit $code

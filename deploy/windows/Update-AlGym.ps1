<#
.SYNOPSIS
  Busca en GitHub Releases una versión nueva de AlGym, la descarga, verifica su
  SHA256 y la instala en modo silencioso. El instalador respalda la base,
  detiene los servicios, actualiza, aplica migraciones y los vuelve a iniciar.

  Lo ejecuta la tarea programada "AlGym Update" como SYSTEM. Es autónomo (no
  depende de Common.ps1) porque vive en DataRoot\private\updater y sobrevive a
  que el instalador reemplace {app}\tools.

.PARAMETER CheckOnly
  Solo informa si hay una versión nueva; no descarga ni instala.
.PARAMETER Force
  Reinstala aunque la versión sea igual o haya fallado antes.
#>
param(
    [string]$AppRoot = "$env:ProgramFiles\AlGym",
    [string]$DataRoot = "$env:ProgramData\AlGym",
    [switch]$CheckOnly,
    [switch]$Force
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ProgressPreference = 'SilentlyContinue'

$AppId = '{3F10430E-8241-40E0-B358-C8E0393D06C9}'
$Services = @('AlGymPostgres', 'AlGymBackend', 'AlGymSync', 'AlGymWeb', 'AlGymMigration')
$MaxAttemptsPerVersion = 3
$updaterRoot = Join-Path $DataRoot 'private\updater'
$configFile = Join-Path $updaterRoot 'update.json'
$tokenFile = Join-Path $updaterRoot 'github-token.txt'
$statusFile = Join-Path $updaterRoot 'status.json'
$logDir = Join-Path $updaterRoot 'logs'
$downloads = Join-Path $DataRoot 'updates'
[IO.Directory]::CreateDirectory($logDir) | Out-Null
$logFile = Join-Path $logDir ('update-' + (Get-Date -Format 'yyyyMM') + '.log')

function Write-Log([string]$Message) {
    $line = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + ' ' + $Message
    Add-Content -LiteralPath $logFile -Value $line -Encoding UTF8
    Write-Output $line
}

function Read-Json([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    return Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
}

function Save-Status($Status) {
    [IO.File]::WriteAllText($statusFile, ($Status | ConvertTo-Json -Depth 4), (New-Object Text.UTF8Encoding($false)))
}

function Get-InstalledVersion {
    foreach ($view in @('Registry64', 'Registry32')) {
        try {
            $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey('LocalMachine', [Microsoft.Win32.RegistryView]::$view)
            $key = $base.OpenSubKey("SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\${AppId}_is1")
            if ($key) {
                $value = $key.GetValue('DisplayVersion')
                $key.Close()
                if ($value) { return [version]$value }
            }
        } catch { }
    }
    $manifest = Join-Path $AppRoot 'build-manifest.json'
    if (Test-Path -LiteralPath $manifest) { return [version](Read-Json $manifest).version }
    return $null
}

function Get-GitHubHeaders([string]$Accept) {
    $headers = @{ 'User-Agent' = 'AlGym-Updater'; 'Accept' = $Accept; 'X-GitHub-Api-Version' = '2022-11-28' }
    if (Test-Path -LiteralPath $tokenFile) {
        $token = (Get-Content -LiteralPath $tokenFile -Raw).Trim()
        if ($token) { $headers['Authorization'] = "Bearer $token" }
    }
    return $headers
}

# Release assets redirect to a signed storage URL; follow it manually so the
# GitHub token is never sent to the storage host.
function Save-Asset($Asset, [string]$Target) {
    $request = [Net.HttpWebRequest]::Create($Asset.url)
    $request.AllowAutoRedirect = $false
    $request.Timeout = 60000
    $headers = Get-GitHubHeaders 'application/octet-stream'
    $request.UserAgent = $headers['User-Agent']; $request.Accept = $headers['Accept']
    if ($headers.ContainsKey('Authorization')) { $request.Headers['Authorization'] = $headers['Authorization'] }
    $request.Headers['X-GitHub-Api-Version'] = $headers['X-GitHub-Api-Version']
    $response = $null
    try { $response = $request.GetResponse() }
    catch [Net.WebException] { if ($_.Exception.Response) { $response = $_.Exception.Response } else { throw } }
    try {
        $code = [int]$response.StatusCode
        if ($code -ge 300 -and $code -lt 400) {
            $location = $response.Headers['Location']
            $response.Close(); $response = $null
            if (-not $location -or -not $location.StartsWith('https://')) { throw 'Redirección de descarga inválida.' }
            Invoke-WebRequest -Uri $location -OutFile $Target -UseBasicParsing -UserAgent 'AlGym-Updater' -TimeoutSec 1800
            return
        }
        if ($code -ne 200) { throw "GitHub respondió $code al descargar $($Asset.name)." }
        $stream = $response.GetResponseStream()
        $file = [IO.File]::Create($Target)
        try { $stream.CopyTo($file) } finally { $file.Dispose(); $stream.Dispose() }
    } finally { if ($response) { $response.Close() } }
}

function Start-AlGymServices {
    foreach ($name in $Services) {
        $service = Get-Service -Name $name -ErrorAction SilentlyContinue
        if ($service -and $service.StartType -ne 'Disabled' -and $service.Status -ne 'Running') {
            try { Start-Service -Name $name -ErrorAction Stop; Write-Log "Servicio $name iniciado." }
            catch { Write-Log "No se pudo iniciar $name : $($_.Exception.Message)" }
        }
    }
}

# Only one updater at a time (scheduled + manual run).
$mutex = New-Object Threading.Mutex($false, 'Global\AlGymUpdater')
if (-not $mutex.WaitOne(0)) { Write-Output 'Ya hay una actualización en curso.'; exit 0 }
$exitCode = 0
$status = $null
$latest = $null
$installerStarted = $false
try {
    $config = Read-Json $configFile
    if (-not $config -or -not $config.repository) { throw "Falta $configFile. Ejecute Configure-AutoUpdate.ps1." }
    if ($config.PSObject.Properties['enabled'] -and -not $config.enabled -and -not $Force) {
        Write-Output 'Actualización automática desactivada.'; exit 0
    }
    $status = Read-Json $statusFile
    if (-not $status) { $status = [pscustomobject]@{ lastCheck=$null; lastResult=$null; installedVersion=$null; failedVersion=$null; failedAttempts=0 } }

    $installed = Get-InstalledVersion
    try {
        $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$($config.repository)/releases/latest" `
            -Headers (Get-GitHubHeaders 'application/vnd.github+json') -UseBasicParsing -TimeoutSec 60
    } catch [Net.WebException] {
        if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 404) {
            throw "GitHub respondió 404: el repositorio $($config.repository) no tiene releases publicados o es privado y falta un token válido."
        }
        throw
    }
    $tag = [string]$release.tag_name
    if ($tag -notmatch '^v?(\d+\.\d+\.\d+)$') { throw "Tag de release no reconocido: $tag" }
    $latest = [version]$Matches[1]
    $status.lastCheck = (Get-Date).ToString('o')
    $status.installedVersion = if ($installed) { $installed.ToString() } else { $null }

    if ($installed -and $latest -le $installed -and -not $Force) {
        $status.lastResult = "Al día ($installed)."
        Save-Status $status
        Write-Log "Sin cambios: instalada $installed, última $latest."
        exit 0
    }
    if ($status.failedVersion -eq $latest.ToString() -and $status.failedAttempts -ge $MaxAttemptsPerVersion -and -not $Force) {
        Write-Log "Se omite $latest : falló $($status.failedAttempts) veces. Revise el registro o use -Force."
        exit 2
    }
    Write-Log "Nueva versión disponible: $latest (instalada: $installed)."
    if ($CheckOnly) { exit 0 }

    $exeName = "AlGym-Setup-$latest-win-x64.exe"
    $exeAsset = @($release.assets | Where-Object { $_.name -eq $exeName }) | Select-Object -First 1
    $shaAsset = @($release.assets | Where-Object { $_.name -eq "$exeName.sha256" }) | Select-Object -First 1
    if (-not $exeAsset -or -not $shaAsset) { throw "El release $tag no contiene $exeName y su .sha256." }

    $targetDir = Join-Path $downloads $latest.ToString()
    [IO.Directory]::CreateDirectory($targetDir) | Out-Null
    $exePath = Join-Path $targetDir $exeName
    $shaPath = "$exePath.sha256"
    Write-Log "Descargando $exeName ($([math]::Round($exeAsset.size / 1MB, 1)) MB)."
    Save-Asset $shaAsset $shaPath
    $expected = ((Get-Content -LiteralPath $shaPath -Raw).Trim() -split '\s+')[0].ToLowerInvariant()
    if ($expected -notmatch '^[a-f0-9]{64}$') { throw 'Archivo SHA256 inválido.' }
    if (-not (Test-Path -LiteralPath $exePath) -or
        (Get-FileHash -LiteralPath $exePath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) {
        Save-Asset $exeAsset "$exePath.partial"
        Move-Item -LiteralPath "$exePath.partial" -Destination $exePath -Force
    }
    $actual = (Get-FileHash -LiteralPath $exePath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $expected) {
        Remove-Item -LiteralPath $exePath -Force
        throw "SHA256 incorrecto para $exeName. No se instaló."
    }
    Write-Log 'Descarga verificada. Instalando (respaldo, servicios detenidos, migraciones, reinicio).'

    $installLog = Join-Path $logDir ("setup-$latest-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')
    $installerStarted = $true
    $process = Start-Process -FilePath $exePath -Wait -PassThru -ArgumentList @(
        '/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/NOCANCEL', '/SP-', "/LOG=`"$installLog`"")
    if ($process.ExitCode -ne 0) { throw "El instalador terminó con código $($process.ExitCode). Registro: $installLog" }

    # Verify with the freshly installed checks.
    $test = Join-Path $AppRoot 'tools\Test-InstalledAlGym.ps1'
    $verify = & "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass `
        -File $test -AppRoot $AppRoot -DataRoot $DataRoot 2>&1
    $verifyCode = $LASTEXITCODE
    $verify | ForEach-Object { Write-Log ("  verificación: " + $_) }
    if ($verifyCode -ne 0) { throw 'La verificación posterior a la instalación falló.' }

    # Keep this updater in sync with the version just installed.
    $newUpdater = Join-Path $AppRoot 'tools\Update-AlGym.ps1'
    if (Test-Path -LiteralPath $newUpdater) { Copy-Item -LiteralPath $newUpdater -Destination (Join-Path $updaterRoot 'Update-AlGym.ps1') -Force }

    # Keep only the two most recent downloads.
    Get-ChildItem -LiteralPath $downloads -Directory | Sort-Object { try { [version]$_.Name } catch { [version]'0.0.0' } } -Descending |
        Select-Object -Skip 2 | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

    $status.installedVersion = $latest.ToString()
    $status.lastResult = "Actualizado a $latest el $(Get-Date -Format 'yyyy-MM-dd HH:mm')."
    $status.failedVersion = $null; $status.failedAttempts = 0
    Save-Status $status
    Write-Log "Actualización a $latest completada."
} catch {
    $exitCode = 1
    Write-Log ('ERROR: ' + $_.Exception.Message)
    # Never leave the gym without the system: if the installer touched the
    # services, bring them back up. Before that point nothing was stopped.
    if ($installerStarted) { Start-AlGymServices }
    try {
        if ($status) {
            if ($latest) {
                if ($status.failedVersion -eq $latest.ToString()) { $status.failedAttempts = [int]$status.failedAttempts + 1 }
                else { $status.failedVersion = $latest.ToString(); $status.failedAttempts = 1 }
            }
            $status.lastResult = 'ERROR: ' + $_.Exception.Message
            Save-Status $status
        }
    } catch { }
} finally {
    $mutex.ReleaseMutex(); $mutex.Dispose()
}
exit $exitCode

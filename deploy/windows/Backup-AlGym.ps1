param([Parameter(Mandatory=$true)][string]$AppRoot, [Parameter(Mandatory=$true)][string]$DataRoot)
. "$PSScriptRoot\Common.ps1"
$running = @()
try {
    Assert-Administrator
    $state = Read-Installation $DataRoot $AppRoot
    if (-not $state -or -not $state.initialized) { throw 'La instalación no está inicializada.' }
    Assert-ServiceOwnership $AppRoot
    # Keep SQL and media consistent. Restore only services that were running;
    # an upgrade has already stopped its writers and must keep them stopped.
    foreach ($name in @('AlGymWeb', 'AlGymSync', 'AlGymBackend')) {
        $service = Get-Service $name -ErrorAction SilentlyContinue
        if ($service -and $service.Status -eq 'Running') {
            $running += $name
            Stop-Service $name -ErrorAction Stop
            $service.WaitForStatus('Stopped', [TimeSpan]::FromSeconds(45))
        }
    }
    $target = Join-Path $DataRoot ('backups\' + [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ'))
    Protect-Directory $target
    $env:PGPASSWORD = $state.adminPassword
    try {
        Invoke-Checked (Join-Path $AppRoot 'runtime\postgres\bin\pg_dump.exe') @('-h', '127.0.0.1', '-p', '55432',
            '-U', 'postgres', '-d', 'algym_windows', '-Fc', '-f', (Join-Path $target 'database.dump'))
        Invoke-Checked (Join-Path $AppRoot 'runtime\postgres\bin\pg_restore.exe') @('--list', (Join-Path $target 'database.dump'))
    } finally { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }
    Copy-Item -LiteralPath (Join-Path $DataRoot 'media') -Destination (Join-Path $target 'media') -Recurse
    $hashes = @(Get-ChildItem -LiteralPath $target -Recurse -File | ForEach-Object {
        @{path=$_.FullName.Substring($target.Length + 1); sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash}
    })
    Write-Utf8File (Join-Path $target 'manifest.json') (@{kind='AlGym.Windows.Backup';
        installationId=$state.installationId; createdAt=[DateTime]::UtcNow.ToString('o'); files=$hashes} | ConvertTo-Json -Depth 5)
    Write-Output "Respaldo creado: $target"
    # No automatic deletion. The operator controls retention and external copies.
    exit 0
} catch { Write-Error $_ -ErrorAction Continue; exit 1 }
finally {
    foreach ($name in @('AlGymBackend', 'AlGymSync', 'AlGymWeb')) {
        if ($running -contains $name) { Start-Service $name }
    }
}

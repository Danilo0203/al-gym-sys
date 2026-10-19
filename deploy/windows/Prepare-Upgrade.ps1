param([Parameter(Mandatory=$true)][string]$AppRoot, [Parameter(Mandatory=$true)][string]$DataRoot)
. "$PSScriptRoot\Common.ps1"
try {
    Assert-Administrator
    Assert-ServiceOwnership $AppRoot
    $state = Read-Installation $DataRoot $AppRoot
    if ($state -and $state.initialized) {
        # Freeze app writers before making the database + media backup.
        foreach ($name in @('AlGymWeb', 'AlGymSync', 'AlGymBackend')) {
            if (Get-Service $name -ErrorAction SilentlyContinue) { Stop-Service $name -ErrorAction Stop }
        }
        Start-Service AlGymPostgres
        & "$PSScriptRoot\Backup-AlGym.ps1" -AppRoot $AppRoot -DataRoot $DataRoot
        if ($LASTEXITCODE -ne 0) { throw 'La actualización se canceló porque falló el respaldo.' }
    }
    Stop-AlGymServices
    exit 0
} catch { Write-Error $_ -ErrorAction Continue; exit 1 }

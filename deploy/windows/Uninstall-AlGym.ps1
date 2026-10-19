param([Parameter(Mandatory=$true)][string]$AppRoot, [Parameter(Mandatory=$true)][string]$DataRoot)
. "$PSScriptRoot\Common.ps1"
try {
    Assert-Administrator
    Assert-ServiceOwnership $AppRoot
    Stop-AlGymServices
    foreach ($name in @('AlGymMigration', 'AlGymWeb', 'AlGymSync', 'AlGymBackend')) {
        if (Get-Service $name -ErrorAction SilentlyContinue) { Invoke-Checked (Join-Path $AppRoot "services\$name.exe") @('uninstall') }
    }
    if (Get-Service AlGymPostgres -ErrorAction SilentlyContinue) {
        Invoke-Checked (Join-Path $AppRoot 'runtime\postgres\bin\pg_ctl.exe') @('unregister', '-N', 'AlGymPostgres')
    }
    if (Get-ScheduledTask -TaskName 'AlGym Backup' -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName 'AlGym Backup' -Confirm:$false
    }
    Remove-NetFirewallRule -Name 'AlGym-Biometric' -ErrorAction SilentlyContinue
    # DataRoot is deliberately never removed, including on partial installations.
    exit 0
} catch { Write-Error $_ -ErrorAction Continue; exit 1 }

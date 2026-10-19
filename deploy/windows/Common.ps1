Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Assert-Administrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'Ejecute el instalador con permisos de administrador.'
    }
}

function Write-Utf8File([string]$Path, [string]$Text) {
    [IO.File]::WriteAllText($Path, $Text, (New-Object Text.UTF8Encoding($false)))
}

function Invoke-Checked([string]$File, [string[]]$Arguments) {
    & $File @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Falló $([IO.Path]::GetFileName($File)) (código $LASTEXITCODE)." }
}

function New-Secret {
    $bytes = New-Object byte[] 32
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    return ([BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant()
}

# SID strings work on Spanish and English Windows alike.
function Protect-Directory([string]$Path, [string[]]$ReadSids = @(), [string[]]$ModifySids = @()) {
    [IO.Directory]::CreateDirectory($Path) | Out-Null
    $acl = New-Object Security.AccessControl.DirectorySecurity
    $acl.SetAccessRuleProtection($true, $false)
    foreach ($sid in @('S-1-5-18', 'S-1-5-32-544')) {
        $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule(
            (New-Object Security.Principal.SecurityIdentifier($sid)), 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')))
    }
    foreach ($entry in @(@{Sids=$ReadSids; Rights='ReadAndExecute'}, @{Sids=$ModifySids; Rights='Modify'})) {
        foreach ($sid in $entry.Sids) {
            $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule(
                (New-Object Security.Principal.SecurityIdentifier($sid)), $entry.Rights, 'ContainerInherit,ObjectInherit', 'None', 'Allow')))
        }
    }
    Set-Acl -LiteralPath $Path -AclObject $acl
}

function Read-Installation([string]$DataRoot, [string]$AppRoot) {
    $file = Join-Path $DataRoot 'private\installation.json'
    if (-not (Test-Path -LiteralPath $file)) { return $null }
    $state = Get-Content -LiteralPath $file -Raw | ConvertFrom-Json
    if ($state.kind -ne 'AlGym.Windows.Native' -or $state.postgresMajor -ne 17 -or
        $state.installationId -notmatch '^[a-f0-9-]{36}$' -or
        [IO.Path]::GetFullPath($state.appRoot) -ne [IO.Path]::GetFullPath($AppRoot)) {
        throw 'La carpeta de datos pertenece a otra instalación o versión de PostgreSQL.'
    }
    return $state
}

function Wait-Http([string]$Uri, [int]$Seconds = 120) {
    $deadline = [DateTime]::UtcNow.AddSeconds($Seconds)
    do {
        try {
            $response = Invoke-WebRequest -Uri $Uri -UseBasicParsing -TimeoutSec 3
            if ($response.StatusCode -eq 200) { return }
        } catch { }
        Start-Sleep -Milliseconds 750
    } while ([DateTime]::UtcNow -lt $deadline)
    throw "El servicio no respondió a tiempo: $Uri. Revise los registros de AlGym."
}

function Stop-AlGymServices {
    foreach ($name in @('AlGymWeb', 'AlGymSync', 'AlGymBackend', 'AlGymPostgres')) {
        $service = Get-Service -Name $name -ErrorAction SilentlyContinue
        if ($service -and $service.Status -ne 'Stopped') {
            Stop-Service -Name $name -ErrorAction Stop
            $service.WaitForStatus('Stopped', [TimeSpan]::FromSeconds(45))
        }
    }
}

function Assert-ServiceOwnership([string]$AppRoot) {
    foreach ($name in @('AlGymWeb', 'AlGymSync', 'AlGymBackend', 'AlGymPostgres')) {
        $service = Get-CimInstance Win32_Service -Filter "Name='$name'"
        if ($service -and -not $service.PathName.StartsWith(('"' + $AppRoot + '\'), [StringComparison]::OrdinalIgnoreCase)) {
            throw "El servicio $name pertenece a otra instalación."
        }
    }
}

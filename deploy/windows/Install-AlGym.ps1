param([Parameter(Mandatory=$true)][string]$AppRoot, [Parameter(Mandatory=$true)][string]$DataRoot)
. "$PSScriptRoot\Common.ps1"
$configurationLog = Join-Path $env:TEMP ('AlGym-configuration-' + [guid]::NewGuid().ToString('N') + '.log')
function Write-InstallStage([string]$Message) {
    Add-Content -LiteralPath $configurationLog -Encoding UTF8 -Value ((Get-Date -Format o) + ' ' + $Message)
    Write-Host $Message
}

# A click in the legacy Windows console must not suspend installation output.
# This affects this process's console only, never the user's global settings.
function Disable-ConsoleSelection {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class AlGymConsoleMode {
    [DllImport("kernel32.dll")] public static extern IntPtr GetStdHandle(int id);
    [DllImport("kernel32.dll")] public static extern bool GetConsoleMode(IntPtr handle, out uint mode);
    [DllImport("kernel32.dll")] public static extern bool SetConsoleMode(IntPtr handle, uint mode);
}
'@
    $inputHandle = [AlGymConsoleMode]::GetStdHandle(-10)
    [uint32]$mode = 0
    if ([AlGymConsoleMode]::GetConsoleMode($inputHandle, [ref]$mode)) {
        [AlGymConsoleMode]::SetConsoleMode($inputHandle, (($mode -band 0xFFFFFFBF) -bor 0x0080)) | Out-Null
    }
}

function Get-OwnerAccount {
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    $form = New-Object Windows.Forms.Form
    $form.Text = 'AlGym - Cuenta propietaria'
    $form.Size = New-Object Drawing.Size(490, 380)
    $form.StartPosition = 'CenterScreen'
    $form.TopMost = $true
    $form.FormBorderStyle = 'FixedDialog'; $form.MaximizeBox = $false; $form.MinimizeBox = $false
    $fields = @()
    $labels = @('Nombre completo', 'Correo electrónico', 'Contraseña (mínimo 12 caracteres)', 'Confirmar contraseña')
    for ($i = 0; $i -lt 4; $i++) {
        $label = New-Object Windows.Forms.Label
        $label.Text = $labels[$i]; $label.SetBounds(20, 15 + $i * 65, 440, 20)
        $field = New-Object Windows.Forms.TextBox
        $field.SetBounds(20, 38 + $i * 65, 435, 25)
        if ($i -ge 2) { $field.UseSystemPasswordChar = $true }
        $form.Controls.Add($label); $form.Controls.Add($field); $fields += $field
    }
    $button = New-Object Windows.Forms.Button
    $button.Text = 'Crear cuenta'; $button.SetBounds(300, 285, 155, 32)
    $button.Add_Click({
        if ($fields[0].Text.Trim().Length -eq 0 -or $fields[0].Text.Length -gt 150 -or
            $fields[1].Text -notmatch '^[^\s@]+@[^\s@]+\.[^\s@]+$' -or
            $fields[2].Text.Length -lt 12 -or [Text.Encoding]::UTF8.GetByteCount($fields[2].Text) -gt 72 -or
            $fields[2].Text -ne $fields[3].Text) {
            [Windows.Forms.MessageBox]::Show('Revise el nombre, el correo y las contraseñas. La contraseña admite hasta 72 bytes.', 'AlGym') | Out-Null
            return
        }
        $form.DialogResult = 'OK'; $form.Close()
    })
    $form.Controls.Add($button); $form.AcceptButton = $button
    try {
        if ($form.ShowDialog() -ne 'OK') { throw 'Se canceló la creación de la cuenta propietaria.' }
        return @{name=$fields[0].Text.Trim(); email=$fields[1].Text.Trim(); password=$fields[2].Text}
    } finally { $form.Dispose() }
}

function Install-NodeService([string]$Id, [string]$Entry, [string]$EnvFile, [string[]]$Dependencies) {
    $services = Join-Path $AppRoot 'services'
    [IO.Directory]::CreateDirectory($services) | Out-Null
    $exe = Join-Path $services "$Id.exe"
    Copy-Item -LiteralPath (Join-Path $AppRoot 'runtime\WinSW-x64.exe') -Destination $exe -Force
    $escape = { param($s) [Security.SecurityElement]::Escape($s) }
    $node = & $escape (Join-Path $AppRoot 'runtime\node\node.exe')
    $arguments = & $escape ('--env-file="' + $EnvFile + '" "' + (Join-Path $AppRoot $Entry) + '"')
    $work = & $escape (Split-Path (Join-Path $AppRoot $Entry))
    $logs = & $escape (Join-Path $DataRoot "logs\$Id")
    Protect-Directory (Join-Path $DataRoot "logs\$Id") @() @('S-1-5-19')
    $depends = ($Dependencies | ForEach-Object { '<depend>' + $_ + '</depend>' }) -join ''
    Write-Utf8File (Join-Path $services "$Id.xml") @"
<service>
  <id>$Id</id><name>$Id</name><description>Servicio local de AlGym</description>
  <executable>$node</executable><arguments>$arguments</arguments><workingdirectory>$work</workingdirectory>
  <startmode>Automatic</startmode><delayedAutoStart>true</delayedAutoStart>
  <serviceaccount><domain>NT AUTHORITY</domain><user>LocalService</user><password></password></serviceaccount>
  $depends<onfailure action="restart" delay="10 sec"/><resetfailure>1 hour</resetfailure>
  <stoptimeout>30 sec</stoptimeout><logpath>$logs</logpath><log mode="roll-by-size"><sizeThreshold>10240</sizeThreshold><keepFiles>5</keepFiles></log>
</service>
"@
    if (-not (Get-Service -Name $Id -ErrorAction SilentlyContinue)) { Invoke-Checked $exe @('install') }
}

try {
    Disable-ConsoleSelection
    Write-InstallStage 'Validando la instalación local.'
    Assert-Administrator
    Assert-ServiceOwnership $AppRoot
    $state = Read-Installation $DataRoot $AppRoot
    $owner = $null
    if (-not $state) {
        if (Test-Path -LiteralPath $DataRoot) {
            if (@(Get-ChildItem -LiteralPath $DataRoot -Force).Count -gt 0) {
                throw 'La carpeta de datos ya tiene contenido ajeno al instalador. No se sobrescribirá.'
            }
        }
        foreach ($port in @(3000, 4000, 8080, 55432)) {
            if (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue) {
                throw "El puerto $port está ocupado. Libérelo antes de instalar AlGym."
            }
        }
        Write-InstallStage 'Esperando la cuenta propietaria.'
        $owner = Get-OwnerAccount
        Write-InstallStage 'Preparando carpetas y permisos.'
        Protect-Directory $DataRoot @('S-1-5-19', 'S-1-5-20', 'S-1-5-32-545')
        Protect-Directory (Join-Path $DataRoot 'private')
        $state = [pscustomobject]@{kind='AlGym.Windows.Native'; installationId=[guid]::NewGuid().ToString();
            appRoot=$AppRoot; postgresMajor=17; host='127.0.0.1'; port=55432; database='algym_windows';
            adminPassword=(New-Secret); appPassword=(New-Secret); syncPassword=(New-Secret); syncToken=(New-Secret);
            initialized=$false}
        Write-Utf8File (Join-Path $DataRoot 'private\installation.json') ($state | ConvertTo-Json)
    } elseif (-not $state.initialized) { $owner = Get-OwnerAccount }
    Protect-Directory (Join-Path $DataRoot 'migration') @('S-1-5-19')
    Protect-Directory (Join-Path $DataRoot 'migration\inbox') @() @('S-1-5-19')
    Protect-Directory (Join-Path $DataRoot 'migration\outbox') @('S-1-5-19')
    Protect-Directory (Join-Path $DataRoot 'config') @('S-1-5-19')
    Protect-Directory (Join-Path $DataRoot 'media') @() @('S-1-5-19')
    Protect-Directory (Join-Path $DataRoot 'postgres') @() @('S-1-5-20')
    Protect-Directory (Join-Path $DataRoot 'logs') @() @('S-1-5-19', 'S-1-5-20')
    Protect-Directory (Join-Path $DataRoot 'backups')
    Write-InstallStage 'Preparando PostgreSQL.'
    $pg = Join-Path $AppRoot 'runtime\postgres\bin'
    $pgData = Join-Path $DataRoot 'postgres'
    if (-not (Test-Path (Join-Path $pgData 'PG_VERSION'))) {
        $passwordFile = Join-Path $DataRoot 'private\init-password.txt'
        # initdb re-executes with a restricted token on Windows. Give the actual
        # installing user temporary access, then restore service-only ACLs.
        $installerSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
        Protect-Directory (Join-Path $DataRoot 'private') @($installerSid)
        Protect-Directory $pgData @() @('S-1-5-20', $installerSid)
        try {
            Write-Utf8File $passwordFile $state.adminPassword
            Invoke-Checked (Join-Path $pg 'initdb.exe') @('-D', $pgData, '-U', 'postgres', '--encoding=UTF8', '--locale=C',
                '--auth=scram-sha-256', "--pwfile=$passwordFile")
        } finally {
            Remove-Item -LiteralPath $passwordFile -Force -ErrorAction SilentlyContinue
            Protect-Directory (Join-Path $DataRoot 'private')
            Protect-Directory $pgData @() @('S-1-5-20')
        }
        Add-Content -LiteralPath (Join-Path $pgData 'postgresql.conf') -Encoding UTF8 -Value @"
listen_addresses = '127.0.0.1'
port = 55432
cluster_name = 'AlGym-$($state.installationId)'
password_encryption = 'scram-sha-256'
"@
    }
    if ((Get-Content (Join-Path $pgData 'PG_VERSION') -Raw).Trim() -ne '17') { throw 'La base requiere PostgreSQL 17.' }
    if (-not (Get-Service AlGymPostgres -ErrorAction SilentlyContinue)) {
        Invoke-Checked (Join-Path $pg 'pg_ctl.exe') @('register', '-N', 'AlGymPostgres', '-D', $pgData,
            '-U', 'NT AUTHORITY\NetworkService', '-S', 'auto')
    }
    Write-InstallStage 'Iniciando PostgreSQL.'
    Start-Service AlGymPostgres
    $env:PGPASSWORD = $state.adminPassword
    try {
        $ready = $false
        for ($attempt = 0; $attempt -lt 60; $attempt++) {
            & (Join-Path $pg 'pg_isready.exe') -h 127.0.0.1 -p 55432 -U postgres -d postgres *> $null
            if ($LASTEXITCODE -eq 0) { $ready = $true; break }
            Start-Sleep -Seconds 1
        }
        if (-not $ready) { throw 'PostgreSQL no pudo iniciarse.' }
    } finally { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue }
    Write-InstallStage 'Aplicando migraciones y preparando la cuenta.'
    $request = @{installationId=$state.installationId; host=$state.host; port=$state.port; database=$state.database;
        adminPassword=$state.adminPassword; appPassword=$state.appPassword; syncPassword=$state.syncPassword; owner=$owner}
    # Redirect stdin explicitly as UTF-8. Passwords never appear in command arguments.
    $psi = New-Object Diagnostics.ProcessStartInfo
    $psi.FileName = Join-Path $AppRoot 'runtime\node\node.exe'
    $psi.Arguments = '"' + (Join-Path $AppRoot 'backend\windows\bootstrap.mjs') + '"'
    $psi.UseShellExecute = $false; $psi.RedirectStandardInput = $true; $psi.CreateNoWindow = $true
    $proc = [Diagnostics.Process]::Start($psi)
    $bytes = [Text.Encoding]::UTF8.GetBytes(($request | ConvertTo-Json -Depth 4 -Compress))
    $proc.StandardInput.BaseStream.Write($bytes, 0, $bytes.Length); $proc.StandardInput.Close()
    $proc.WaitForExit()
    if ($proc.ExitCode -ne 0) { throw 'Falló la preparación de la base. Consulte el registro de instalación.' }
    $owner = $null; $request = $null
    $media = (Join-Path $DataRoot 'media').Replace('\', '/')
    Write-Utf8File (Join-Path $DataRoot 'config\backend.env') @"
NODE_ENV=production
HOST=127.0.0.1
PORT=4000
DB_HOST=127.0.0.1
DB_PORT=55432
DB_NAME=algym_windows
DB_USER=algym_app
DB_PASSWORD=$($state.appPassword)
LOCAL_MEDIA_ROOT=$media
ALGYM_MIGRATION_ROOT=$($DataRoot.Replace('\', '/'))/migration
CORS_ORIGINS=http://127.0.0.1:3000,http://localhost:3000
AUTH_COOKIE_SECURE=false
AUTH_COOKIE_SAME_SITE=lax
"@
    Write-Utf8File (Join-Path $DataRoot 'config\web.env') @"
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
HOSTNAME=127.0.0.1
PORT=3000
ALGYM_BACKEND_URL=http://127.0.0.1:4000
GYM_SYNC_SERVER_URL=http://127.0.0.1:8080
GYM_SYNC_API_TOKEN=$($state.syncToken)
"@
    $clockFile = Join-Path $DataRoot 'private\clock.json'
    if (Test-Path $clockFile) {
        $clock = Get-Content $clockFile -Raw | ConvertFrom-Json
        Add-Content (Join-Path $DataRoot 'config\web.env') -Encoding UTF8 -Value "`nDEFAULT_ZK_DEVICE_SN=$($clock.serial)"
    }
    # Preserve the technician's clock configuration on repair/update.
    $syncEnv = Join-Path $DataRoot 'config\sync.env'
    if (-not (Test-Path $syncEnv)) {
        Write-Utf8File $syncEnv @"
NODE_ENV=production
PORT=8080
SYNC_HOST=127.0.0.1
DB_HOST=127.0.0.1
DB_PORT=55432
DB_NAME=algym_windows
DB_USER=algym_sync
DB_PASSWORD=$($state.syncPassword)
SYNC_API_TOKEN=$($state.syncToken)
ZK_TIME_UTC_OFFSET=-06:00
SYNC_COMMAND_DELIVERY_PAUSED=true
"@
    }
    Write-InstallStage 'Registrando y verificando los servicios.'
    Install-NodeService 'AlGymBackend' 'backend\dist\server.js' (Join-Path $DataRoot 'config\backend.env') @('AlGymPostgres')
    Install-NodeService 'AlGymSync' 'sync\index.js' $syncEnv @('AlGymPostgres')
    Install-NodeService 'AlGymWeb' 'web\server.js' (Join-Path $DataRoot 'config\web.env') @('AlGymBackend', 'AlGymSync')
    Start-Service AlGymBackend; Start-Service AlGymSync
    Wait-Http 'http://127.0.0.1:4000/health/ready'; Wait-Http 'http://127.0.0.1:8080/health/ready'
    Start-Service AlGymWeb
    Wait-Http 'http://127.0.0.1:3000/api/health'
    $state.initialized = $true
    Write-Utf8File (Join-Path $DataRoot 'private\installation.json') ($state | ConvertTo-Json)
    $action = New-ScheduledTaskAction -Execute "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" `
        -Argument ('-NoProfile -ExecutionPolicy Bypass -File "' + (Join-Path $AppRoot 'tools\Backup-AlGym.ps1') + '" -AppRoot "' + $AppRoot + '" -DataRoot "' + $DataRoot + '"')
    $trigger = New-ScheduledTaskTrigger -Daily -At '21:00'
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 2)
    Register-ScheduledTask -TaskName 'AlGym Backup' -Action $action -Trigger $trigger -Settings $settings -User 'SYSTEM' -RunLevel Highest -Force | Out-Null
    Write-InstallStage 'Creando el primer respaldo.'
    & "$PSScriptRoot\Backup-AlGym.ps1" -AppRoot $AppRoot -DataRoot $DataRoot
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear el primer respaldo.' }
    & "$PSScriptRoot\Install-MigrationService.ps1" -AppRoot $AppRoot -DataRoot $DataRoot
    Write-InstallStage 'Configuración terminada.'
    exit 0
} catch {
    Write-InstallStage ('ERROR: ' + $_.Exception.Message)
    try { Stop-AlGymServices } catch { }
    Add-Type -AssemblyName System.Windows.Forms
    [Windows.Forms.MessageBox]::Show($_.Exception.Message + "`nLa instalación no está lista. Los datos existentes se conservaron. Puede volver a ejecutar el instalador.`nRegistro: $configurationLog", 'AlGym - Instalación incompleta') | Out-Null
    Write-Error $_ -ErrorAction Continue
    exit 1
}

# Windows PowerShell 5.1. Password input belongs exclusively to OpenSSH.
# No passwords, keys or database configuration are collected by this script.
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

function New-AlGymConnection([string]$Address, [string]$UserName, [string]$PortText) {
    $ip = $null; $portNumber = 0
    if ($Address -notmatch '^[0-9a-fA-F:.]+$' -or -not [Net.IPAddress]::TryParse($Address, [ref]$ip)) {
        throw 'Escribe una IP válida, sin http://, rutas ni comandos.'
    }
    if ([Net.IPAddress]::IsLoopback($ip) -or $ip.Equals([Net.IPAddress]::Any) -or $ip.Equals([Net.IPAddress]::IPv6Any)) {
        throw 'Escribe la IP de la VPS, no la dirección de esta computadora.'
    }
    if ($UserName -cne 'root') { throw 'El exportador instalado requiere el usuario SSH root.' }
    if (-not [int]::TryParse($PortText, [ref]$portNumber) -or $portNumber -lt 1 -or $portNumber -gt 65535) {
        throw 'El puerto debe ser un número entre 1 y 65535.'
    }
    $addressText = $ip.ToString()
    $scpHost = if ($ip.AddressFamily -eq [Net.Sockets.AddressFamily]::InterNetworkV6) { '[' + $addressText + ']' } else { $addressText }
    return [pscustomobject]@{ Destination = 'root@' + $addressText; ScpDestination = 'root@' + $scpHost; Port = $portNumber }
}

function Get-AlGymSshOptions {
    # Keep host verification enabled. Do not forward credentials or ports.
    return @('-o','StrictHostKeyChecking=ask','-o','BatchMode=no','-o','ConnectTimeout=20',
        '-o','ServerAliveInterval=15','-o','ServerAliveCountMax=3','-o','ClearAllForwardings=yes',
        '-o','ForwardAgent=no','-o','PermitLocalCommand=no')
}

function Get-AlGymRemoteCommand([string]$ScriptPath, [string]$JobId) {
    if ($JobId -cnotmatch '^[a-f0-9]{32}$') { throw 'Identificador de exportación inválido.' }
    $item = Get-Item -LiteralPath $ScriptPath
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint -or $item.Length -gt 16384) { throw 'Auxiliar del servidor inválido.' }
    $script = [IO.File]::ReadAllText($item.FullName).TrimStart([char]0xFEFF).Replace("`r`n", "`n")
    if (-not $script.StartsWith('#!/usr/bin/env bash')) { throw 'Falta el auxiliar del servidor.' }
    $encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($script))
    # Only validated hex and base64 enter the remote shell; no user text does.
    return "bash -o pipefail -c 'printf %s $encoded | base64 --decode | bash -s -- $JobId'"
}

function Invoke-AlGymNative([string]$Executable, [string[]]$Arguments, [string]$Failure) {
    & $Executable @Arguments | Out-Host
    if ($LASTEXITCODE -ne 0) { throw $Failure }
}

function Test-AlGymDownload([string]$Folder, [string]$JobId) {
    $names = @('Hostinger-AlGym.algym.partial','RESUMEN.json','VERIFICACION.json','SHA256SUMS.txt')
    $items = @(Get-ChildItem -LiteralPath $Folder -Force)
    if ($items.Count -ne 4) { throw 'La descarga está incompleta o contiene archivos inesperados.' }
    foreach ($item in $items) {
        if ($item.PSIsContainer -or $item.Attributes -band [IO.FileAttributes]::ReparsePoint -or $item.Name -cnotin $names) {
            throw 'La descarga contiene una ruta inesperada.'
        }
        $limit = if ($item.Name -ceq 'Hostinger-AlGym.algym.partial') { 268435456 } else { 1048576 }
        if ($item.Length -le 0 -or $item.Length -gt $limit) { throw 'Un archivo está vacío o supera el tamaño permitido.' }
    }
    $lines = @([IO.File]::ReadAllLines((Join-Path $Folder 'SHA256SUMS.txt')))
    if ($lines.Count -ne 3) { throw 'Lista de verificación incompleta.' }
    $hashes = @{}
    foreach ($line in $lines) {
        if ($line -cnotmatch '^([a-f0-9]{64})  (Hostinger-AlGym\.algym\.partial|RESUMEN\.json|VERIFICACION\.json)$') {
            throw 'Lista de verificación inválida.'
        }
        $expected = $Matches[1]; $name = $Matches[2]
        if ($hashes.ContainsKey($name)) { throw 'Lista de verificación repetida.' }
        $actual = (Get-FileHash -LiteralPath (Join-Path $Folder $name) -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($actual -cne $expected) { throw ('Archivo incompleto o alterado: ' + $name + '. No importar.') }
        $hashes[$name] = $actual
    }
    $summary = [IO.File]::ReadAllText((Join-Path $Folder 'RESUMEN.json')) | ConvertFrom-Json
    $verification = [IO.File]::ReadAllText((Join-Path $Folder 'VERIFICACION.json')) | ConvertFrom-Json
    if ($summary.jobId -cne $JobId -or $summary.source.kind -cne 'Hostinger' -or $summary.clockCommandQueue -ne 0 -or
        $summary.sha256 -cne $hashes['Hostinger-AlGym.algym.partial'] -or $verification.sha256 -cne $summary.sha256) {
        throw 'El respaldo no corresponde a esta ejecución o no pasó la verificación.'
    }
    $capture = [DateTimeOffset]::MinValue
    if (-not [DateTimeOffset]::TryParse($summary.snapshotAt, [ref]$capture)) { throw 'La fecha de la copia no es válida.' }
    foreach ($field in @('customers','plans','payments','attendance')) {
        $count = 0L
        if (-not [long]::TryParse([string]$summary.$field, [ref]$count) -or $count -lt 0 -or $summary.$field -ne $verification.$field) {
            throw 'Los conteos de verificación no coinciden.'
        }
    }
    $stream = [IO.File]::OpenRead((Join-Path $Folder 'Hostinger-AlGym.algym.partial'))
    try { if ($stream.ReadByte() -ne 31 -or $stream.ReadByte() -ne 139) { throw 'El archivo no tiene el formato esperado de AlGym.' } }
    finally { $stream.Dispose() }
    return [pscustomobject]@{ Summary = $summary; Capture = $capture; Hash = $summary.sha256 }
}

function Invoke-AlGymDownload($Connection, [string]$OutputRoot, [string]$RemoteScript, [string]$Ssh, [string]$Scp) {
    $jobId = [Guid]::NewGuid().ToString('N')
    $remoteFolder = '/root/algym-exportaciones/windows-' + $jobId
    $command = Get-AlGymRemoteCommand $RemoteScript $jobId
    $root = [IO.Path]::GetFullPath($OutputRoot)
    [IO.Directory]::CreateDirectory($root) | Out-Null
    if ((Get-Item -LiteralPath $root).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'La carpeta de descarga no puede ser un enlace.' }
    $drive = New-Object IO.DriveInfo ([IO.Path]::GetPathRoot($root))
    if ($drive.AvailableFreeSpace -lt 314572800) { throw 'Se requieren al menos 300 MB libres junto al auxiliar.' }
    $pending = Join-Path $root ('INCOMPLETA-' + $jobId)
    [IO.Directory]::CreateDirectory($pending) | Out-Null
    $completed = $false
    try {
        $options = @(Get-AlGymSshOptions)
        Write-Host "`n1/3 Generando una copia nueva en Hostinger..." -ForegroundColor Cyan
        Write-Host 'OpenSSH solicitará la contraseña del servidor. Al escribir no se ven caracteres.'
        Invoke-AlGymNative $Ssh ($options + @('-T','-p',[string]$Connection.Port,$Connection.Destination,$command)) 'No se pudo generar la copia. No se descargará un respaldo anterior.'
        Write-Host "`n2/3 Descargando esta copia..." -ForegroundColor Cyan
        Write-Host 'Puede volver a solicitarse la misma contraseña SSH.'
        # One directory glob, one scp invocation; never read a shared latest pointer.
        $source = $Connection.ScpDestination + ':' + $remoteFolder + '/para-windows/*'
        Invoke-AlGymNative $Scp ($options + @('-P',[string]$Connection.Port,$source,$pending)) 'La descarga no terminó. Los archivos parciales no se pueden importar.'
        Write-Host "`n3/3 Comprobando integridad y fecha..." -ForegroundColor Cyan
        $checked = Test-AlGymDownload $pending $jobId
        $stem = 'Hostinger-AlGym-' + $checked.Capture.UtcDateTime.ToString('yyyy-MM-dd-HHmmss') + '-' + $jobId.Substring(0,6)
        $fileName = $stem + '.algym'
        $manifest = Join-Path $pending 'SHA256SUMS.txt'
        $text = [IO.File]::ReadAllText($manifest).Replace('Hostinger-AlGym.algym.partial', $fileName)
        [IO.File]::WriteAllText($manifest, $text, (New-Object Text.UTF8Encoding $false))
        $note = "COPIA LISTA Y VERIFICADA`r`nArchivo: $fileName`r`nCaptura UTC: $($checked.Summary.snapshotAt)`r`nSHA-256: $($checked.Hash)`r`nRespaldo completo conservado en la VPS: $remoteFolder/source.dump`r`n`r`nPara un equipo que ya tiene datos, usa Administración > Importar datos > Actualizar este equipo en AlGym 0.3.5. Selecciona también el respaldo original en la primera actualización. Revisa los conflictos antes de confirmar. La descarga no importa ni modifica datos locales.`r`n"
        [IO.File]::WriteAllText((Join-Path $pending 'LEEME-COPIA.txt'), $note, (New-Object Text.UTF8Encoding $true))
        $destination = Join-Path $root $stem
        [IO.File]::Move((Join-Path $pending 'Hostinger-AlGym.algym.partial'), (Join-Path $pending $fileName))
        try { [IO.Directory]::Move($pending, $destination) }
        catch {
            [IO.File]::Move((Join-Path $pending $fileName), (Join-Path $pending 'Hostinger-AlGym.algym.partial'))
            throw
        }
        $completed = $true
        return [pscustomobject]@{ Folder = $destination; File = Join-Path $destination $fileName; Summary = $checked.Summary; RemoteFolder = $remoteFolder }
    } finally {
        if (-not $completed) { Write-Host ("`nLa copia NO está lista. No importes archivos de: " + $pending) -ForegroundColor Yellow }
    }
}

function Read-AlGymDefault([string]$Label, [string]$Default) {
    $value = Read-Host ($Label + ' [' + $Default + ']')
    if ([string]::IsNullOrWhiteSpace($value)) { return $Default }
    return $value.Trim()
}

function Start-AlGymDownload {
    Write-Host 'ALGYM - DESCARGAR DATOS DE HOSTINGER' -ForegroundColor Cyan
    Write-Host 'Genera una copia nueva y la descarga junto a este auxiliar. No la importa automáticamente.'
    Write-Host 'Usa la contraseña SSH del servidor, no la de Google ni la de AlGym.'
    $system = Join-Path $env:WINDIR 'System32\OpenSSH'
    if ([Environment]::Is64BitOperatingSystem -and -not [Environment]::Is64BitProcess) { $system = Join-Path $env:WINDIR 'Sysnative\OpenSSH' }
    $ssh = Join-Path $system 'ssh.exe'; $scp = Join-Path $system 'scp.exe'
    if (-not (Test-Path -LiteralPath $ssh) -or -not (Test-Path -LiteralPath $scp)) {
        throw 'Falta Cliente OpenSSH de Windows. Actívalo en Configuración > Aplicaciones > Características opcionales > Agregar una característica > Cliente OpenSSH. Después vuelve a abrir este auxiliar.'
    }
    $address = Read-AlGymDefault 'IP de Hostinger' '2.25.212.207'
    $userName = Read-AlGymDefault 'Usuario SSH' 'root'
    $portText = Read-AlGymDefault 'Puerto SSH' '22'
    $connection = New-AlGymConnection $address $userName $portText
    Write-Host "`nPrimera conexión: si SSH muestra una huella, compárala con la de tu VPS antes de aceptar."
    Write-Host 'Si cambió la identidad del servidor, el proceso se detendrá. No desactives esa comprobación.'
    $output = Join-Path (Split-Path -Parent $PSScriptRoot) 'Respaldos-Hostinger'
    $result = Invoke-AlGymDownload $connection $output (Join-Path $PSScriptRoot 'Exportar-Hostinger.sh') $ssh $scp
    Write-Host "`nCOPIA LISTA Y VERIFICADA" -ForegroundColor Green
    Write-Host ('Captura UTC: ' + $result.Summary.snapshotAt)
    Write-Host ('Clientes: {0} | Planes: {1} | Pagos: {2} | Asistencias: {3}' -f $result.Summary.customers,$result.Summary.plans,$result.Summary.payments,$result.Summary.attendance)
    Write-Host ('Archivo para arrastrar a AlGym: ' + $result.File)
    Write-Host 'Usa Actualizar este equipo y el respaldo original. Revisa la comparación antes de aplicar.'
    try { Start-Process explorer.exe -ArgumentList ('"' + $result.Folder + '"') | Out-Null } catch { Write-Host ('Abre esta carpeta: ' + $result.Folder) }
}

if ($MyInvocation.InvocationName -ne '.') {
    $exitCode = 0
    try { Start-AlGymDownload }
    catch { Write-Host ("`nERROR: " + $_.Exception.Message) -ForegroundColor Red; $exitCode = 1 }
    try { Read-Host 'Pulsa Enter para cerrar' | Out-Null } catch { }
    exit $exitCode
}

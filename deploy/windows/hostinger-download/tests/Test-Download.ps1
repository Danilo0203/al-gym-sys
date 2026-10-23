$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '..\Herramientas-Hostinger\Descargar-Hostinger.ps1')
$script:checks=0; $script:cases=New-Object Collections.Generic.List[string]
function Assert($Condition,[string]$Label) { if (-not $Condition) { throw ('FALLO: '+$Label) };$script:checks++;$script:cases.Add($Label) }
function Reject([scriptblock]$Action,[string]$Label) {
    $failed=$false;try { & $Action | Out-Null }catch { $failed=$true };Assert $failed $Label
}
$base=Join-Path $env:TEMP ('AlGym pruebas ñ '+[guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($base)|Out-Null
$remote=Join-Path $PSScriptRoot '..\Herramientas-Hostinger\Exportar-Hostinger.sh'
try {
    $c=New-AlGymConnection '2.25.212.207' 'root' '22'
    Assert ($c.Destination -eq 'root@2.25.212.207') 'IPv4 y root correctos'
    $v6=New-AlGymConnection '2001:db8::1' 'root' '2222'
    Assert ($v6.ScpDestination -eq 'root@[2001:db8::1]') 'IPv6 protegido para SCP'
    Reject { New-AlGymConnection '2.25.212.207;whoami' 'root' '22' } 'IP con comando rechazada'
    Reject { New-AlGymConnection '-oProxyCommand=cmd' 'root' '22' } 'Opciones inyectadas rechazadas'
    Reject { New-AlGymConnection '2.25.212.207' 'root;id' '22' } 'Usuario inyectado rechazado'
    Reject { New-AlGymConnection '2.25.212.207' 'root' '22;id' } 'Puerto inyectado rechazado'
    Reject { New-AlGymConnection '127.0.0.1' 'root' '22' } 'Destino local rechazado'
    Reject { New-AlGymConnection '2.25.212.207' 'root' '65536' } 'Puerto fuera de rango rechazado'
    $job='a'*32;$command=Get-AlGymRemoteCommand $remote $job
    Assert ($command -match "^bash -o pipefail -c 'printf %s ([A-Za-z0-9+/=]+) \| base64 --decode \| bash -s -- ([a-f0-9]{32})'$" ) 'Comando remoto sin texto libre'
    $decoded=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Matches[1]))
    Assert ($decoded -eq [IO.File]::ReadAllText($remote).Replace("`r`n","`n")) 'Transporte conserva el script UTF8'
    Reject { Get-AlGymRemoteCommand $remote "a'; rm" } 'Trabajo inyectado rechazado'
    Assert ((Get-AlGymSshOptions) -contains 'StrictHostKeyChecking=ask') 'Comprobación de identidad SSH activa'
    Reject { Invoke-AlGymNative $env:ComSpec @('/d','/c','exit 7') 'esperado' } 'Error nativo detiene el flujo'
    $script:mode='ok';$script:calls=@();$script:currentJob=''
    function Write-TestFiles([string]$Folder) {
        $bytes=[byte[]]@(31,139,8,0,1,2,3,4,5)
        $package=Join-Path $Folder 'Hostinger-AlGym.algym.partial';[IO.File]::WriteAllBytes($package,$bytes)
        $digest=(Get-FileHash $package -Algorithm SHA256).Hash.ToLowerInvariant()
        $id=if($script:mode -eq 'wrong-job'){'b'*32}else{$script:currentJob}
        $record=@{jobId=$id;source=@{kind='Hostinger'};clockCommandQueue=0;sha256=$digest;snapshotAt='2026-10-22T12:00:00Z';customers=2;plans=1;payments=3;attendance=4}
        [IO.File]::WriteAllText((Join-Path $Folder 'RESUMEN.json'),($record|ConvertTo-Json -Depth 5))
        [IO.File]::WriteAllText((Join-Path $Folder 'VERIFICACION.json'),($record|ConvertTo-Json -Depth 5))
        $lines=@();foreach($name in @('Hostinger-AlGym.algym.partial','RESUMEN.json','VERIFICACION.json')) {
            $lines+=((Get-FileHash (Join-Path $Folder $name) -Algorithm SHA256).Hash.ToLowerInvariant()+'  '+$name)
        }
        if($script:mode -eq 'manifest-traversal'){$lines[1]=('a'*64)+'  ../RESUMEN.json'}
        if($script:mode -eq 'manifest-duplicate'){$lines[1]=$lines[0]}
        [IO.File]::WriteAllLines((Join-Path $Folder 'SHA256SUMS.txt'),$lines)
        if($script:mode -eq 'corrupt'){[IO.File]::AppendAllText($package,'alterado')}
        if($script:mode -eq 'missing'){Remove-Item -LiteralPath (Join-Path $Folder 'RESUMEN.json')}
        if($script:mode -eq 'extra'){[IO.File]::WriteAllText((Join-Path $Folder 'unexpected.txt'),'extra')}
    }
    function Invoke-AlGymNative([string]$Executable,[string[]]$Arguments,[string]$Failure) {
        $script:calls+=,$Arguments
        if($Executable -eq 'fake-ssh') {
            if($script:mode -eq 'remote-failure'){throw 'Fallo remoto simulado'}
            if($Arguments[-1] -notmatch "-- ([a-f0-9]{32})'$"){throw 'Comando remoto inesperado'}
            $script:currentJob=$Matches[1]
        } elseif($Executable -eq 'fake-scp') {
            if($script:mode -eq 'download-failure'){throw 'Fallo de descarga simulado'}
            Assert ($Arguments[-2] -eq ('root@2.25.212.207:/root/algym-exportaciones/windows-'+$script:currentJob+'/para-windows/*')) 'Descarga ligada a su trabajo, sin ultima'
            Write-TestFiles $Arguments[-1]
        } else {throw 'Ejecutable inesperado'}
    }
    $result=Invoke-AlGymDownload $c $base $remote 'fake-ssh' 'fake-scp'
    Assert ((Test-Path -LiteralPath $result.File) -and $result.File.EndsWith('.algym')) 'Flujo correcto publica el .algym'
    Assert ($script:calls.Count -eq 2) 'Una conexión de exportación y una de descarga'
    Assert (-not (Get-ChildItem -LiteralPath $result.Folder -Filter '*.partial')) 'Éxito no deja archivos parciales'
    Assert ((Get-Content (Join-Path $result.Folder 'SHA256SUMS.txt') -Raw).Contains([IO.Path]::GetFileName($result.File))) 'Manifiesto actualizado con nombre final'
    $second=Invoke-AlGymDownload $c $base $remote 'fake-ssh' 'fake-scp'
    Assert ($second.Folder -ne $result.Folder -and (Test-Path -LiteralPath $result.File)) 'Repetir crea otra carpeta sin sobrescribir'
    foreach($failure in @('remote-failure','download-failure','corrupt','wrong-job','manifest-traversal','manifest-duplicate','missing','extra')) {
        $script:mode=$failure;$script:calls=@();$before=@(Get-ChildItem $base -Recurse -Filter '*.algym').Count
        Reject { Invoke-AlGymDownload $c $base $remote 'fake-ssh' 'fake-scp' } ('Bloqueo: '+$failure)
        Assert (@(Get-ChildItem $base -Recurse -Filter '*.algym').Count -eq $before) ('Sin copia lista tras '+$failure)
        if($failure -eq 'remote-failure'){Assert ($script:calls.Count -eq 1) 'Fallo remoto no intenta descargar datos anteriores'}
    }
    @{passed=$script:checks;failed=0;cases=@($script:cases);powershell=$PSVersionTable.PSVersion.ToString();transport='simulado; no se conectó a Hostinger'}|ConvertTo-Json -Depth 5
} finally { Remove-Item -LiteralPath $base -Recurse -Force -ErrorAction SilentlyContinue }

$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '..\Herramientas-Hostinger\Descargar-Hostinger.ps1')
$script:commonOptions=@(Get-AlGymSshOptions)
$fixtures=Join-Path $PSScriptRoot 'fixtures'
$script:testKey=Join-Path $fixtures 'test_identity'
$script:testHosts=Join-Path $fixtures 'known_hosts'
& icacls.exe $script:testKey /inheritance:r /grant:r '*S-1-5-18:(R)' | Out-Null
if($LASTEXITCODE -ne 0){throw 'ACL de clave ficticia inválida'}
function Get-AlGymSshOptions {
    return $script:commonOptions + @('-o',('IdentityFile='+$script:testKey),'-o','IdentitiesOnly=yes','-o',('UserKnownHostsFile='+$script:testHosts),'-o',('GlobalKnownHostsFile='+$script:testHosts))
}
$c=New-AlGymConnection '10.211.55.2' 'root' '18737'
$ssh=Join-Path $env:WINDIR 'System32\OpenSSH\ssh.exe'
$scp=Join-Path $env:WINDIR 'System32\OpenSSH\scp.exe'
$output=Join-Path $env:TEMP ('AlGym transporte ñ '+[guid]::NewGuid().ToString('N'))
$remote=Join-Path $PSScriptRoot '..\Herramientas-Hostinger\Exportar-Hostinger.sh'
try {
    $one=Invoke-AlGymDownload $c $output $remote $ssh $scp
    if(-not(Test-Path -LiteralPath $one.File)){throw 'No se completó SFTP'}
    function Invoke-AlGymNative([string]$Executable,[string[]]$Arguments,[string]$Failure) {
        if($Executable.EndsWith('\scp.exe')){$Arguments=@('-O')+$Arguments}
        & $Executable @Arguments | Out-Host
        if($LASTEXITCODE -ne 0){throw $Failure}
    }
    $two=Invoke-AlGymDownload $c $output $remote $ssh $scp
    if(-not(Test-Path -LiteralPath $two.File)){throw 'No se completó SCP clásico'}
    $script:testHosts=Join-Path $fixtures 'wrong_hosts'
    $rejected=$false;try {Invoke-AlGymDownload $c $output $remote $ssh $scp|Out-Null}catch{$rejected=$true}
    if(-not $rejected){throw 'Se aceptó una identidad de servidor distinta'}
    if(@(Get-ChildItem $output -Recurse -Filter '*.algym').Count -ne 2){throw 'El fallo publicó un paquete'}
    @{passed=3;failed=0;checks=@('SSH real y SFTP nativo','SCP clásico, compatible con clientes anteriores','Identidad SSH cambiada rechazada');powershell=$PSVersionTable.PSVersion.ToString();server='Simulador aislado en la Mac; sin Hostinger';credentials='Clave efímera de prueba, sin contraseñas reales'}|ConvertTo-Json
} finally {Remove-Item -LiteralPath $output -Recurse -Force -ErrorAction SilentlyContinue}

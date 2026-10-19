param([Parameter(Mandatory=$true)][string]$AppRoot, [Parameter(Mandatory=$true)][string]$DataRoot)
. "$PSScriptRoot\Common.ps1"
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Start-Process "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -Verb RunAs -ArgumentList (
        '-NoProfile -ExecutionPolicy Bypass -STA -File "' + $PSCommandPath + '" -AppRoot "' + $AppRoot + '" -DataRoot "' + $DataRoot + '"')
    exit
}
try {
    $state = Read-Installation $DataRoot $AppRoot
    if (-not $state -or -not $state.initialized) { throw 'Complete primero la instalación.' }
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    $form = New-Object Windows.Forms.Form
    $form.Text = 'AlGym - Reloj biométrico'; $form.Size = New-Object Drawing.Size(530, 330)
    $form.StartPosition = 'CenterScreen'; $form.FormBorderStyle = 'FixedDialog'; $form.MaximizeBox = $false
    $fields = @()
    $labels = @('IP local del reloj (ejemplo: 192.168.1.50)', 'Número de serie del reloj')
    for ($i = 0; $i -lt 2; $i++) {
        $label = New-Object Windows.Forms.Label; $label.Text = $labels[$i]; $label.SetBounds(20, 15 + $i * 65, 480, 20)
        $field = New-Object Windows.Forms.TextBox; $field.SetBounds(20, 38 + $i * 65, 470, 25)
        $form.Controls.Add($label); $form.Controls.Add($field); $fields += $field
    }
    $active = New-Object Windows.Forms.CheckBox
    $active.Text = 'Habilitar envío de comandos (cola del reloj revisada)'; $active.SetBounds(20, 150, 480, 30)
    $hint = New-Object Windows.Forms.Label
    $hint.Text = 'En el reloj configure ADMS con la IP de esta PC y el puerto 8080. Use una IP fija o reserva DHCP.'
    $hint.SetBounds(20, 185, 480, 45)
    $button = New-Object Windows.Forms.Button; $button.Text = 'Guardar'; $button.SetBounds(350, 240, 140, 30)
    $button.Add_Click({
        $ip = $null
        if (-not [Net.IPAddress]::TryParse($fields[0].Text.Trim(), [ref]$ip) -or $ip.AddressFamily -ne 'InterNetwork' -or
            $fields[1].Text -notmatch '^[a-zA-Z0-9_-]{1,64}$') {
            [Windows.Forms.MessageBox]::Show('Ingrese una IPv4 local y un número de serie válido.', 'AlGym') | Out-Null; return
        }
        $bytes = $ip.GetAddressBytes()
        if (-not ($bytes[0] -eq 10 -or ($bytes[0] -eq 192 -and $bytes[1] -eq 168) -or
                ($bytes[0] -eq 172 -and $bytes[1] -ge 16 -and $bytes[1] -le 31))) {
            [Windows.Forms.MessageBox]::Show('La IP debe pertenecer a la red privada del gimnasio.', 'AlGym') | Out-Null; return
        }
        $form.DialogResult = 'OK'; $form.Close()
    })
    foreach ($control in @($active, $hint, $button)) { $form.Controls.Add($control) }
    try {
        if ($form.ShowDialog() -ne 'OK') { exit 0 }
        $clock = @{ip=$fields[0].Text.Trim(); serial=$fields[1].Text.Trim(); active=$active.Checked}
    } finally { $form.Dispose() }
    Assert-ServiceOwnership $AppRoot
    Stop-Service AlGymWeb; Stop-Service AlGymSync
    $syncFile = Join-Path $DataRoot 'config\sync.env'
    $sync = Get-Content $syncFile | Where-Object { $_ -notmatch '^(SYNC_HOST|ZK_DEVICE_IP|SYNC_COMMAND_DELIVERY_PAUSED)=' }
    $paused = if ($clock.active) {'false'} else {'true'}
    Write-Utf8File $syncFile (($sync + @('SYNC_HOST=0.0.0.0', "ZK_DEVICE_IP=$($clock.ip)", "SYNC_COMMAND_DELIVERY_PAUSED=$paused")) -join "`n")
    $webFile = Join-Path $DataRoot 'config\web.env'
    $web = Get-Content $webFile | Where-Object { $_ -notmatch '^DEFAULT_ZK_DEVICE_SN=' }
    Write-Utf8File $webFile (($web + @("DEFAULT_ZK_DEVICE_SN=$($clock.serial)")) -join "`n")
    Write-Utf8File (Join-Path $DataRoot 'private\clock.json') ($clock | ConvertTo-Json)
    Remove-NetFirewallRule -Name 'AlGym-Biometric' -ErrorAction SilentlyContinue
    New-NetFirewallRule -Name 'AlGym-Biometric' -DisplayName 'AlGym - Reloj biométrico' -Direction Inbound -Action Allow `
        -Protocol TCP -LocalPort 8080 -RemoteAddress $clock.ip -Profile Private -Program (Join-Path $AppRoot 'runtime\node\node.exe') | Out-Null
    Start-Service AlGymSync; Start-Service AlGymWeb
    Wait-Http 'http://127.0.0.1:8080/health/ready'
    [Windows.Forms.MessageBox]::Show('Configuración guardada. Pruebe un marcaje y un comando con el reloj real.', 'AlGym') | Out-Null
} catch {
    Add-Type -AssemblyName System.Windows.Forms
    [Windows.Forms.MessageBox]::Show($_.Exception.Message, 'AlGym - Configuración incompleta') | Out-Null
    exit 1
}

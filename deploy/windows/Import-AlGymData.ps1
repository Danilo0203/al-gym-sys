param(
    [string]$AppRoot = "$env:ProgramFiles\AlGym",
    [string]$DataRoot = "$env:ProgramData\AlGym"
)
# Keep the selector unelevated: Windows Explorer cannot drag files into an
# elevated window. Only the confirmed import worker requests administrator rights.
. "$PSScriptRoot\Common.ps1"
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$script:selected = $null
$script:preview = $null
$form = New-Object Windows.Forms.Form
$form.Text = 'AlGym - Importar datos de Hostinger'
$form.Size = New-Object Drawing.Size(650, 570)
$form.StartPosition = 'CenterScreen'; $form.FormBorderStyle = 'FixedDialog'; $form.MaximizeBox = $false
$title = New-Object Windows.Forms.Label
$title.Text = 'Trae los datos de tu gimnasio'; $title.Font = New-Object Drawing.Font('Segoe UI', 16, [Drawing.FontStyle]::Bold)
$title.SetBounds(25, 20, 585, 35)
$drop = New-Object Windows.Forms.Label
$drop.Text = "Arrastra aquí tu archivo .algym`nO pulsa para seleccionarlo"
$drop.BorderStyle = 'FixedSingle'; $drop.TextAlign = 'MiddleCenter'; $drop.AllowDrop = $true
$drop.SetBounds(25, 65, 585, 100)
$details = New-Object Windows.Forms.TextBox
$details.Multiline = $true; $details.ReadOnly = $true; $details.ScrollBars = 'Vertical'
$details.SetBounds(25, 180, 585, 210)
$details.Text = 'Selecciona el paquete preparado desde Hostinger. El origen no se conecta ni se modifica durante esta importación.'
$confirm = New-Object Windows.Forms.CheckBox
$confirm.Text = 'Esta es una instalación nueva. Usaré las cuentas del respaldo.'
$confirm.SetBounds(25, 400, 585, 30)
$note = New-Object Windows.Forms.Label
$note.Text = 'Se guardará un respaldo local. El envío de comandos al reloj quedará pausado.'
$note.SetBounds(25, 435, 585, 30)
$button = New-Object Windows.Forms.Button
$button.Text = 'Importar datos'; $button.Enabled = $false; $button.SetBounds(440, 475, 170, 35)
function Read-Preview([string]$File) {
    $script:selected = $null; $script:preview = $null; $button.Enabled = $false; $confirm.Checked = $false
    try {
        if ([IO.Path]::GetExtension($File) -ne '.algym' -or -not (Test-Path -LiteralPath $File -PathType Leaf)) {
            throw 'Selecciona un archivo de migración con extensión .algym.'
        }
        $details.Text = 'Comprobando integridad, imágenes y cuentas...'; $form.Refresh()
        $psi = New-Object Diagnostics.ProcessStartInfo
        $psi.FileName = Join-Path $AppRoot 'runtime\node\node.exe'
        $psi.Arguments = '"' + (Join-Path $AppRoot 'backend\windows\transfer.mjs') + '" inspect "' + $File + '"'
        $psi.UseShellExecute = $false; $psi.CreateNoWindow = $true
        $psi.RedirectStandardOutput = $true; $psi.RedirectStandardError = $true
        $proc = [Diagnostics.Process]::Start($psi)
        $stdout = $proc.StandardOutput.ReadToEnd(); $stderr = $proc.StandardError.ReadToEnd(); $proc.WaitForExit()
        if ($proc.ExitCode -ne 0) { throw $stderr.Trim() }
        $script:preview = $stdout | ConvertFrom-Json
        $script:selected = [IO.Path]::GetFullPath($File)
        $date = ([DateTimeOffset]::Parse($script:preview.snapshotAt)).ToLocalTime().ToString('dd/MM/yyyy HH:mm')
        $details.Text = "Respaldo preparado: $date`r`n`r`nClientes: $($script:preview.customers)`r`nPlanes: $($script:preview.plans)`r`nMembresías: $($script:preview.memberships)`r`nPagos: $($script:preview.payments)`r`nAsistencias: $($script:preview.attendance)`r`nRutinas: $($script:preview.routines)`r`nImágenes: $($script:preview.images)`r`n`r`nLa cuenta creada durante la instalación será reemplazada por las cuentas del respaldo."
    } catch { $details.Text = $_.Exception.Message }
}
$drop.Add_DragEnter({
    if ($_.Data.GetDataPresent([Windows.Forms.DataFormats]::FileDrop)) { $_.Effect = [Windows.Forms.DragDropEffects]::Copy }
})
$drop.Add_DragDrop({
    $files = $_.Data.GetData([Windows.Forms.DataFormats]::FileDrop)
    if ($files.Count -eq 1) { Read-Preview $files[0] } else { $details.Text = 'Arrastra un solo archivo .algym.' }
})
$drop.Add_Click({
    $dialog = New-Object Windows.Forms.OpenFileDialog
    $dialog.Filter = 'Paquete de AlGym (*.algym)|*.algym'; $dialog.CheckFileExists = $true
    try { if ($dialog.ShowDialog() -eq 'OK') { Read-Preview $dialog.FileName } } finally { $dialog.Dispose() }
})
$confirm.Add_CheckedChanged({ $button.Enabled = $confirm.Checked -and $null -ne $script:selected })
$button.Add_Click({
    $button.Enabled = $false; $drop.Enabled = $false; $confirm.Enabled = $false
    try {
        $arguments = '-NoProfile -ExecutionPolicy Bypass -STA -File "' + (Join-Path $AppRoot 'tools\Apply-AlGymData.ps1') +
            '" -AppRoot "' + $AppRoot + '" -DataRoot "' + $DataRoot + '" -Package "' + $script:selected +
            '" -ExpectedHash ' + $script:preview.sha256
        $process = Start-Process "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -Verb RunAs -ArgumentList $arguments -PassThru
        $details.AppendText("`r`n`r`nImportando... Espera a que termine la comprobación.")
        while (-not $process.HasExited) { [Windows.Forms.Application]::DoEvents(); Start-Sleep -Milliseconds 200 }
        if ($process.ExitCode -ne 0) { throw 'La importación no terminó. Revisa el mensaje del importador antes de intentar nuevamente.' }
        $details.AppendText("`r`n`r`nImportación verificada. Inicia sesión con una cuenta de Hostinger.")
        [Windows.Forms.MessageBox]::Show('Los datos están listos. Inicia sesión con tu cuenta de Hostinger.', 'AlGym') | Out-Null
        Start-Process 'http://127.0.0.1:3000/iniciar-sesion'
    } catch { [Windows.Forms.MessageBox]::Show($_.Exception.Message, 'AlGym - Importación pendiente') | Out-Null }
    finally { $drop.Enabled = $true; $confirm.Enabled = $true; $button.Enabled = $confirm.Checked }
})
foreach ($control in @($title,$drop,$details,$confirm,$note,$button)) { $form.Controls.Add($control) }
try { $form.ShowDialog() | Out-Null } finally { $form.Dispose() }

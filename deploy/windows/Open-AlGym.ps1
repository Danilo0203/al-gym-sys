$ErrorActionPreference = 'Stop'
try {
    . "$PSScriptRoot\Common.ps1"
    Wait-Http 'http://127.0.0.1:4000/health/ready' 180
    Wait-Http 'http://127.0.0.1:8080/health/ready' 180
    Wait-Http 'http://127.0.0.1:3000/api/health' 180
    Start-Process 'http://127.0.0.1:3000'
} catch {
    Add-Type -AssemblyName System.Windows.Forms
    [Windows.Forms.MessageBox]::Show($_.Exception.Message, 'AlGym no está disponible') | Out-Null
    exit 1
}

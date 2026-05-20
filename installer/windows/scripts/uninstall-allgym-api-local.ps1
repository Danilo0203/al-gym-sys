param(
  [string]$InstallRoot = "C:\Program Files\AllGym",
  [string]$ProgramDataRoot = "C:\ProgramData\AllGym"
)

$ErrorActionPreference = "Stop"

$currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($currentIdentity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw "Run this script from an elevated PowerShell session (Run as Administrator)."
}

$WinswRoot = Join-Path $InstallRoot "winsw"
$ServiceExe = Join-Path $WinswRoot "allgym-api-local.exe"
$LogsRoot = Join-Path $ProgramDataRoot "logs"
$InstallerLog = Join-Path $LogsRoot "installer.log"

New-Item -ItemType Directory -Force -Path $LogsRoot | Out-Null
New-Item -ItemType File -Force -Path $InstallerLog | Out-Null

function Write-InstallerLog {
  param([string]$Message)

  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Add-Content -Path $InstallerLog -Value "[$timestamp] $Message"
}

if (-not (Test-Path $ServiceExe)) {
  Write-InstallerLog "WinSW executable not found during uninstall at $ServiceExe"
  exit 0
}

Push-Location $WinswRoot
try {
  Write-InstallerLog "Stopping WinSW service allgym-api-local"
  try {
    & $ServiceExe stop *>> $InstallerLog
  } catch {
    Write-InstallerLog "Stop returned an error but uninstall will continue: $($_.Exception.Message)"
  }

  Write-InstallerLog "Uninstalling WinSW service allgym-api-local"
  try {
    & $ServiceExe uninstall *>> $InstallerLog
  } catch {
    Write-InstallerLog "Uninstall returned an error but file cleanup will continue: $($_.Exception.Message)"
  }
} finally {
  Pop-Location
}

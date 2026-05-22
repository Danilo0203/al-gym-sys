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
$ServiceXml = Join-Path $WinswRoot "allgym-api-local.xml"
$ConfigTemplate = Join-Path $InstallRoot "templates\api-local.env.example"
$ConfigTarget = Join-Path $ProgramDataRoot "config\api-local.env"
$LogsRoot = Join-Path $ProgramDataRoot "logs"
$InstallerLog = Join-Path $LogsRoot "installer.log"

New-Item -ItemType Directory -Force -Path $LogsRoot | Out-Null
New-Item -ItemType File -Force -Path $InstallerLog | Out-Null

function Write-InstallerLog {
  param([string]$Message)

  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  [System.IO.File]::AppendAllText($InstallerLog, "[$timestamp] $Message`r`n", (New-Object System.Text.UTF8Encoding($false)))
}

if (-not (Test-Path $ServiceExe)) {
  Write-InstallerLog "Missing WinSW executable at $ServiceExe"
  throw "WinSW executable not found at $ServiceExe"
}

if (-not (Test-Path $ServiceXml)) {
  Write-InstallerLog "Missing WinSW XML at $ServiceXml"
  throw "WinSW XML not found at $ServiceXml"
}

New-Item -ItemType Directory -Force -Path (Join-Path $ProgramDataRoot "config") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $ProgramDataRoot "data") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $ProgramDataRoot "uploads") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $ProgramDataRoot "backups") | Out-Null

if ((Test-Path $ConfigTemplate) -and -not (Test-Path $ConfigTarget)) {
  Copy-Item $ConfigTemplate $ConfigTarget
  Write-InstallerLog "Copied api-local env template to $ConfigTarget"
}

Push-Location $WinswRoot
try {
  Write-InstallerLog "Installing WinSW service allgym-api-local"
  & $ServiceExe install *>> $InstallerLog

  Write-InstallerLog "Configuring SCM recovery for allgym-api-local"
  & sc.exe config allgym-api-local start= auto *>> $InstallerLog
  & sc.exe failure allgym-api-local reset= 86400 actions= restart/5000/restart/15000/restart/30000 *>> $InstallerLog
  & sc.exe failureflag allgym-api-local 1 *>> $InstallerLog

  Write-InstallerLog "Starting WinSW service allgym-api-local"
  & $ServiceExe start *>> $InstallerLog
} finally {
  Pop-Location
}

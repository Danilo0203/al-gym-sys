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
$ServiceExe = Join-Path $WinswRoot "allgym-web.exe"
$ServiceXml = Join-Path $WinswRoot "allgym-web.xml"
$ConfigTemplate = Join-Path $InstallRoot "templates\allgym-web.env.example"
$ConfigTarget = Join-Path $ProgramDataRoot "config\allgym-web.env"
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
  Write-InstallerLog "Missing WinSW executable at $ServiceExe"
  throw "WinSW executable not found at $ServiceExe"
}

if (-not (Test-Path $ServiceXml)) {
  Write-InstallerLog "Missing WinSW XML at $ServiceXml"
  throw "WinSW XML not found at $ServiceXml"
}

if (-not (Test-Path (Join-Path $InstallRoot "allgym-web\server.js"))) {
  Write-InstallerLog "Missing allgym-web standalone bundle at $InstallRoot\allgym-web"
  throw "allgym-web standalone bundle not found at $InstallRoot\allgym-web"
}

New-Item -ItemType Directory -Force -Path (Join-Path $ProgramDataRoot "config") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $ProgramDataRoot "logs") | Out-Null

if ((Test-Path $ConfigTemplate) -and -not (Test-Path $ConfigTarget)) {
  Copy-Item $ConfigTemplate $ConfigTarget
  Write-InstallerLog "Copied allgym-web env template to $ConfigTarget"
}

Push-Location $WinswRoot
try {
  Write-InstallerLog "Installing WinSW service allgym-web"
  & $ServiceExe install *>> $InstallerLog

  Write-InstallerLog "Starting WinSW service allgym-web"
  & $ServiceExe start *>> $InstallerLog
} finally {
  Pop-Location
}

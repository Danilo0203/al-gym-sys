param(
  [string]$InstallRoot = "C:\Program Files\AllGym",
  [string]$ProgramDataRoot = "C:\ProgramData\AllGym"
)

$ErrorActionPreference = "Stop"
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Import-DotEnvFile {
  param([string]$EnvFilePath)

  if (-not (Test-Path $EnvFilePath)) {
    throw "Missing env file: $EnvFilePath"
  }

  Get-Content $EnvFilePath | ForEach-Object {
    $line = $_.Trim()
    if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith("#")) {
      return
    }

    $parts = $line -split "=", 2
    if ($parts.Count -ne 2) {
      throw "Invalid env line: $line"
    }

    $name = $parts[0].Trim()
    $value = $parts[1].Trim()
    if ($value.StartsWith('"') -and $value.EndsWith('"')) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    Set-Item -Path "Env:$name" -Value $value
  }
}

function Write-LogLine {
  param([string]$Message)

  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  [System.IO.File]::AppendAllText($LogFile, "[$timestamp] $Message`r`n", $Utf8NoBom)
}

$WebRoot = Join-Path $InstallRoot "allgym-web"
$NodeExecutable = Join-Path $InstallRoot "runtime\node\node.exe"
$ServerJs = Join-Path $WebRoot "server.js"
$EnvFile = Join-Path $ProgramDataRoot "config\allgym-web.env"
$LogsDir = Join-Path $ProgramDataRoot "logs"
$LogFile = Join-Path $LogsDir "web.log"

New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null
if (-not (Test-Path $LogFile)) {
  [System.IO.File]::WriteAllText($LogFile, "", $Utf8NoBom)
}

try {
  if (-not (Test-Path $NodeExecutable)) {
    throw "Node runtime not found at $NodeExecutable"
  }

  if (-not (Test-Path $ServerJs)) {
    throw "allgym-web standalone bundle not found at $WebRoot"
  }

  Import-DotEnvFile -EnvFilePath $EnvFile

  if (-not $env:NODE_ENV) {
    $env:NODE_ENV = "production"
  }

  if (-not $env:PORT) {
    $env:PORT = "3000"
  }

  if (-not $env:HOSTNAME) {
    $env:HOSTNAME = "127.0.0.1"
  }

  if (-not $env:NEXT_TELEMETRY_DISABLED) {
    $env:NEXT_TELEMETRY_DISABLED = "1"
  }

  [Console]::OutputEncoding = $Utf8NoBom
  $OutputEncoding = $Utf8NoBom

  Write-LogLine "Launching allgym-web"
  Write-LogLine "Node executable: $NodeExecutable"
  Write-LogLine "Working directory: $WebRoot"
  Write-LogLine "Entrypoint: $ServerJs"
  Write-LogLine "PORT=$($env:PORT) HOSTNAME=$($env:HOSTNAME)"

  Push-Location $WebRoot
  try {
    & $NodeExecutable $ServerJs 2>&1 | ForEach-Object {
      Write-LogLine ($_.ToString())
    }

    $exitCode = if ($null -ne $LASTEXITCODE) { [int]$LASTEXITCODE } else { 0 }
    Write-LogLine "allgym-web exited with code $exitCode"
    exit $exitCode
  } finally {
    Pop-Location
  }
} catch {
  Write-LogLine "Fatal wrapper error: $($_.Exception.Message)"
  if ($_.ScriptStackTrace) {
    Write-LogLine $_.ScriptStackTrace
  }
  exit 1
}

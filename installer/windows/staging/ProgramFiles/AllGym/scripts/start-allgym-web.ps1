param(
  [string]$InstallRoot = "C:\Program Files\AllGym",
  [string]$ProgramDataRoot = "C:\ProgramData\AllGym"
)

$ErrorActionPreference = "Stop"

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

$WebRoot = Join-Path $InstallRoot "allgym-web"
$NodeExecutable = Join-Path $InstallRoot "runtime\node\node.exe"
$EnvFile = Join-Path $ProgramDataRoot "config\allgym-web.env"
$LogsDir = Join-Path $ProgramDataRoot "logs"
$LogFile = Join-Path $LogsDir "web.log"

New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null

if (-not (Test-Path $NodeExecutable)) {
  throw "Node runtime not found at $NodeExecutable"
}

if (-not (Test-Path (Join-Path $WebRoot "server.js"))) {
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

Push-Location $WebRoot
try {
  & $NodeExecutable (Join-Path $WebRoot "server.js") >> $LogFile 2>&1
  exit $LASTEXITCODE
} finally {
  Pop-Location
}

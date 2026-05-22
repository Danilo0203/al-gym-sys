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

$ApiRoot = Join-Path $InstallRoot "api-local"
$NodeExecutable = Join-Path $InstallRoot "runtime\node\node.exe"
$EnvFile = Join-Path $ProgramDataRoot "config\api-local.env"
$LogsDir = Join-Path $ProgramDataRoot "logs"
$LogFile = Join-Path $LogsDir "backend.log"

New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null

if (-not (Test-Path $NodeExecutable)) {
  throw "Node runtime not found at $NodeExecutable"
}

if (-not (Test-Path (Join-Path $ApiRoot "dist\server.js"))) {
  throw "api-local bundle not found at $ApiRoot"
}

Import-DotEnvFile -EnvFilePath $EnvFile

if (-not $env:NODE_ENV) {
  $env:NODE_ENV = "production"
}

Push-Location $ApiRoot
try {
  & $NodeExecutable (Join-Path $ApiRoot "dist\server.js") >> $LogFile 2>&1
  exit $LASTEXITCODE
} finally {
  Pop-Location
}

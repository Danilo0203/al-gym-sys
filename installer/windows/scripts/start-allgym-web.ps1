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
$ServerJs = Join-Path $WebRoot "server.js"
$EnvFile = Join-Path $ProgramDataRoot "config\allgym-web.env"
$LogsDir = Join-Path $ProgramDataRoot "logs"
$LogFile = Join-Path $LogsDir "web.log"

New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null

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

$logWriter = New-Object System.IO.StreamWriter($LogFile, $true, [System.Text.UTF8Encoding]::new($false))
$logWriter.AutoFlush = $true

function Write-WebLogLine {
  param([string]$Message)

  if ([string]::IsNullOrWhiteSpace($Message)) {
    return
  }

  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  $logWriter.WriteLine("[$timestamp] $Message")
}

$process = New-Object System.Diagnostics.Process
$process.StartInfo = New-Object System.Diagnostics.ProcessStartInfo
$process.StartInfo.FileName = $NodeExecutable
$process.StartInfo.Arguments = "`"$ServerJs`""
$process.StartInfo.WorkingDirectory = $WebRoot
$process.StartInfo.UseShellExecute = $false
$process.StartInfo.CreateNoWindow = $true
$process.StartInfo.RedirectStandardOutput = $true
$process.StartInfo.RedirectStandardError = $true

$stdoutHandler = [System.Diagnostics.DataReceivedEventHandler]{
  param($sender, $eventArgs)

  if ($null -ne $eventArgs.Data) {
    Write-WebLogLine $eventArgs.Data
  }
}

$stderrHandler = [System.Diagnostics.DataReceivedEventHandler]{
  param($sender, $eventArgs)

  if ($null -ne $eventArgs.Data) {
    Write-WebLogLine $eventArgs.Data
  }
}

$process.add_OutputDataReceived($stdoutHandler)
$process.add_ErrorDataReceived($stderrHandler)

try {
  Write-WebLogLine "Launching allgym-web with $NodeExecutable $ServerJs"

  $started = $process.Start()
  if (-not $started) {
    throw "Failed to start allgym-web node process."
  }

  $process.BeginOutputReadLine()
  $process.BeginErrorReadLine()
  $process.WaitForExit()
  $process.WaitForExit()

  Write-WebLogLine "allgym-web exited with code $($process.ExitCode)"
  exit $process.ExitCode
} finally {
  if ($null -ne $process) {
    $process.remove_OutputDataReceived($stdoutHandler)
    $process.remove_ErrorDataReceived($stderrHandler)
    $process.Dispose()
  }

  $logWriter.Dispose()
}

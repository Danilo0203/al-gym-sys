param(
  [string]$HealthUrl = "http://127.0.0.1:4000/health"
)

$ErrorActionPreference = "Stop"

$response = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 10

if ($response.StatusCode -ne 200) {
  throw "Health check failed with status $($response.StatusCode)"
}

$body = $response.Content | ConvertFrom-Json

if (-not $body.ok) {
  throw "Health payload is not ok"
}

$body | ConvertTo-Json -Depth 5

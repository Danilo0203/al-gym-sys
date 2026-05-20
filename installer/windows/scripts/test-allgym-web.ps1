param(
  [string]$RootUrl = "http://127.0.0.1:3000/",
  [string]$HealthUrl = "http://127.0.0.1:3000/api/health"
)

$ErrorActionPreference = "Stop"

$rootResponse = Invoke-WebRequest -Uri $RootUrl -UseBasicParsing -TimeoutSec 10 -MaximumRedirection 5
if ($rootResponse.StatusCode -lt 200 -or $rootResponse.StatusCode -ge 400) {
  throw "Root request failed with status $($rootResponse.StatusCode)"
}

$healthResponse = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 10
if ($healthResponse.StatusCode -ne 200) {
  throw "Health check failed with status $($healthResponse.StatusCode)"
}

$healthBody = $healthResponse.Content | ConvertFrom-Json
if (-not $healthBody.ok) {
  throw "Health payload is not ok"
}

[pscustomobject]@{
  rootStatus = $rootResponse.StatusCode
  healthStatus = $healthResponse.StatusCode
  healthBody = $healthBody
} | ConvertTo-Json -Depth 6

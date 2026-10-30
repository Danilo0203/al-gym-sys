$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '..\Common.ps1')
$fixture = Join-Path ([IO.Path]::GetTempPath()) ('algym-env-test-' + [guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($fixture) | Out-Null
try {
    $configPath = Join-Path $fixture 'web.env'
    Initialize-EnvironmentFile $configPath "HOSTNAME=127.0.0.1`nPORT=3000`n"
    if ([IO.File]::ReadAllText($configPath) -ne "HOSTNAME=127.0.0.1`nPORT=3000`n") {
        throw 'A fresh install did not create its defaults.'
    }
    # Preserve exact bytes: network binding, clock settings, credentials and comments.
    $existing = "# Synthetic configuration`r`nHOSTNAME=0.0.0.0`r`nPORT=3000`r`nGYM_SYNC_API_TOKEN=synthetic-only`r`nDEFAULT_ZK_DEVICE_SN=TEST`r`n"
    [IO.File]::WriteAllText($configPath, $existing, [Text.Encoding]::UTF8)
    $before = (Get-FileHash -LiteralPath $configPath -Algorithm SHA256).Hash
    Initialize-EnvironmentFile $configPath "HOSTNAME=127.0.0.1`nPORT=3000`n"
    if ((Get-FileHash -LiteralPath $configPath -Algorithm SHA256).Hash -ne $before) {
        throw 'The update changed existing environment settings.'
    }
    Write-Output 'PASS: fresh environment created; existing configuration preserved byte for byte.'
} finally {
    $resolvedFixture = [IO.Path]::GetFullPath($fixture)
    if ([IO.Path]::GetDirectoryName($resolvedFixture) -ne [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') -or
        -not [IO.Path]::GetFileName($resolvedFixture).StartsWith('algym-env-test-')) {
        throw 'Unsafe fixture cleanup path.'
    }
    Remove-Item -LiteralPath $resolvedFixture -Recurse -Force
}

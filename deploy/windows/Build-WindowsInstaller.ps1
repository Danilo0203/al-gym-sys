param(
    [string]$BackendPath = (Join-Path $PSScriptRoot '..\..\..\algym-local-backend'),
    [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\..\build\windows'),
    [ValidatePattern('^\d+\.\d+\.\d+$')][string]$Version = '0.1.0',
    [string]$InnoCompiler = "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe"
)
. "$PSScriptRoot\Common.ps1"
if ($env:OS -ne 'Windows_NT' -or -not [Environment]::Is64BitProcess -or $env:PROCESSOR_ARCHITECTURE -notin @('AMD64', 'ARM64')) {
    throw 'Compile en Windows de 64 bits. Se utilizará Node x64, también en Windows ARM con emulación x64.'
}
if (-not (Test-Path $InnoCompiler)) { throw 'Instale Inno Setup 6.4 o posterior y especifique -InnoCompiler si es necesario.' }
$frontend = (Resolve-Path "$PSScriptRoot\..\..").Path
$backend = (Resolve-Path $BackendPath).Path
if (-not (Test-Path "$backend\windows\bootstrap.mjs")) { throw 'Seleccione la rama Windows del backend, que incluye windows/bootstrap.mjs.' }
$output = [IO.Path]::GetFullPath($OutputDirectory)
[IO.Directory]::CreateDirectory($output) | Out-Null
$stage = Join-Path $output ('build-' + [guid]::NewGuid().ToString('N'))
$payload = Join-Path $stage 'payload'
$cache = Join-Path $output 'downloads'
foreach ($dir in @($stage, $payload, $cache, "$payload\runtime", "$payload\tools")) { [IO.Directory]::CreateDirectory($dir) | Out-Null }

function Get-VerifiedAsset($Asset) {
    $target = Join-Path $cache $Asset.file
    if (-not (Test-Path $target)) {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $Asset.url -OutFile $target -UseBasicParsing
    }
    if ((Get-FileHash $target -Algorithm SHA256).Hash.ToLowerInvariant() -ne $Asset.sha256) {
        throw "Hash incorrecto: $($Asset.file). No se ejecutó ni empaquetó el archivo."
    }
    return $target
}

function Copy-Source([string]$Repo, [string]$Prefix, [string]$Destination) {
    # Allow only versioned and visible untracked source; never private .env, data,
    # databases, caches, macOS node_modules, or another build's native binaries.
    if (Test-Path (Join-Path $Repo '.windows-source.json')) {
        $files = (Get-Content (Join-Path $Repo '.windows-source.json') -Raw | ConvertFrom-Json).files
    } else {
        $files = & git -C $Repo -c core.quotepath=false ls-files --cached --others --exclude-standard
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo inventariar el código fuente.' }
    }
    foreach ($file in $files) {
        if ([IO.Path]::IsPathRooted($file) -or $file -match '(^|[/\\])\.\.([/\\]|$)') { throw 'Ruta de fuente inválida.' }
        if ($Prefix -and -not $file.StartsWith($Prefix + '/')) { continue }
        $relative = if ($Prefix) { $file.Substring($Prefix.Length + 1) } else { $file }
        if ($relative -match '(^|/)(\.env[^/]*|node_modules|\.git|\.next|\.agents|\.codex|data|backups|build|dist)(/|$)') { continue }
        $source = Join-Path $Repo $file
        if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { continue }
        $destinationFile = Join-Path $Destination $relative
        [IO.Directory]::CreateDirectory((Split-Path $destinationFile)) | Out-Null
        Copy-Item -LiteralPath $source -Destination $destinationFile
    }
}

$assets = Get-Content "$PSScriptRoot\vendors.json" -Raw | ConvertFrom-Json
$nodeZip = Get-VerifiedAsset $assets.node
$postgresZip = Get-VerifiedAsset $assets.postgres
Copy-Item (Get-VerifiedAsset $assets.winsw) "$payload\runtime\WinSW-x64.exe"
Copy-Item (Get-VerifiedAsset $assets.vcredist) "$payload\runtime\vc_redist.x64.exe"
$signature = Get-AuthenticodeSignature "$payload\runtime\vc_redist.x64.exe"
if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'Microsoft Corporation') {
    throw 'El redistribuible de Microsoft no tiene una firma válida.'
}
Expand-Archive -LiteralPath $nodeZip -DestinationPath "$stage\node"
Move-Item "$stage\node\node-v24.16.0-win-x64" "$payload\runtime\node"
[IO.Directory]::CreateDirectory("$payload\runtime\postgres") | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead($postgresZip)
try {
    foreach ($entry in $zip.Entries) {
        if ($entry.FullName -notmatch '^pgsql/(bin/|lib/|share/|[^/]*license[^/]*\.txt$)' -or $entry.FullName.EndsWith('/')) { continue }
        $destination = [IO.Path]::GetFullPath((Join-Path "$payload\runtime\postgres" $entry.FullName.Substring(6)))
        if (-not $destination.StartsWith(("$payload\runtime\postgres\"), [StringComparison]::OrdinalIgnoreCase)) { throw 'Ruta ZIP inválida.' }
        [IO.Directory]::CreateDirectory((Split-Path $destination)) | Out-Null
        [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $destination)
    }
} finally { $zip.Dispose() }
$node = "$payload\runtime\node\node.exe"
if ((& $node -p 'process.arch') -ne 'x64') { throw 'El runtime del paquete debe ser x64.' }
$npm = "$payload\runtime\node\node_modules\npm\bin\npm-cli.js"
$env:PATH = "$payload\runtime\node;$env:PATH"
$env:NEXT_TELEMETRY_DISABLED = '1'
$env:npm_config_cache = "$output\npm-cache"
Invoke-Checked $node @($npm, 'install', '--prefix', "$stage\tooling", '--ignore-scripts', '--no-audit', '--no-fund', 'pnpm@11.3.0')
$pnpm = "$stage\tooling\node_modules\pnpm\bin\pnpm.cjs"
Copy-Source $frontend 'all-gym-vf' "$stage\sources\web"
Copy-Source $frontend 'gym-sync-server' "$stage\sources\sync"
Copy-Source $backend '' "$stage\sources\backend"

Push-Location "$stage\sources\web"
try { Invoke-Checked $node @($npm, 'ci', '--no-audit', '--no-fund'); Invoke-Checked $node @($npm, 'run', 'build') }
finally { Pop-Location }
Copy-Item "$stage\sources\web\.next\standalone" "$payload\web" -Recurse
Copy-Item "$stage\sources\web\.next\static" "$payload\web\.next\static" -Recurse
Copy-Item "$stage\sources\web\public" "$payload\web\public" -Recurse

Push-Location "$stage\sources\backend"
try {
    Invoke-Checked $node @($pnpm, 'install', '--frozen-lockfile')
    Invoke-Checked $node @($pnpm, 'build')
    Invoke-Checked $node @('--test', 'windows/bootstrap.test.mjs')
} finally { Pop-Location }
[IO.Directory]::CreateDirectory("$payload\backend") | Out-Null
foreach ($folder in @('dist', 'database', 'windows')) { Copy-Item "$stage\sources\backend\$folder" "$payload\backend\$folder" -Recurse }
foreach ($file in @('package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml')) {
    Copy-Item "$stage\sources\backend\$file" "$payload\backend\$file"
}
# A hoisted production install preserves Node resolution without pnpm junctions
# referring back to a developer's store or source directory.
Push-Location "$payload\backend"
try { Invoke-Checked $node @($pnpm, 'install', '--prod', '--frozen-lockfile', '--config.node-linker=hoisted') }
finally { Pop-Location }

Push-Location "$stage\sources\sync"
try { Invoke-Checked $node @($npm, 'ci', '--omit=dev', '--no-audit', '--no-fund') }
finally { Pop-Location }
Copy-Item "$stage\sources\sync" "$payload\sync" -Recurse
Copy-Item "$PSScriptRoot\*.ps1" "$payload\tools"
Copy-Item "$PSScriptRoot\README.md" "$payload\tools\README.md"
Copy-Item "$PSScriptRoot\vendors.json" "$payload\vendors.json"
Copy-Item "$PSScriptRoot\THIRD-PARTY-NOTICES.md" "$payload\THIRD-PARTY-NOTICES.md"

# Fail closed if a private environment file or database accidentally entered the package.
$unexpected = @(Get-ChildItem $payload -Recurse -Force -File | Where-Object {
    ($_.Name -like '.env*' -and $_.Name -notlike '*.example') -or $_.Extension -in @('.dump', '.backup')
})
if ($unexpected.Count -gt 0) { throw 'El paquete contiene archivos privados; no se generó el instalador.' }
function Get-SourceRevision([string]$Repo) {
    if (Test-Path (Join-Path $Repo '.windows-source.json')) {
        return (Get-Content (Join-Path $Repo '.windows-source.json') -Raw | ConvertFrom-Json).revision
    }
    return (& git -C $Repo rev-parse HEAD)
}
Invoke-Checked $node @("$PSScriptRoot\create-manifest.cjs", $payload, $Version,
    (Get-SourceRevision $frontend), (Get-SourceRevision $backend))
Invoke-Checked $InnoCompiler @('/Q', "/DPayloadDir=$payload", "/DReleaseVersion=$Version", "/DOutputPath=$output", "$PSScriptRoot\AlGym.iss")
$installer = Join-Path $output "AlGym-Setup-$Version-win-x64.exe"
Write-Output "Instalador generado: $installer"
Get-FileHash -LiteralPath $installer -Algorithm SHA256

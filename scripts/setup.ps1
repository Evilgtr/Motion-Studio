$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root
$runtime = Join-Path $root '.runtime'
New-Item -ItemType Directory -Force -Path $runtime | Out-Null
try {
    if (-not [Environment]::Is64BitOperatingSystem) { throw 'Windows 64-bit is required.' }
    Write-Host 'Mezofill Motion Studio - Initial setup' -ForegroundColor Cyan
    Write-Host 'Internet is required for this step only. Keep this window open.'
    $nodeDir = Join-Path $runtime 'node'
    $node = Join-Path $nodeDir 'node.exe'
    if (-not (Test-Path -LiteralPath $node)) {
        Write-Host '[1/4] Downloading portable Node.js 24 LTS...'
        $base = 'https://nodejs.org/dist/latest-v24.x/'
        $hashText = (Invoke-WebRequest -UseBasicParsing -Uri ($base + 'SHASUMS256.txt')).Content
        $line = ($hashText -split "`n" | Where-Object { $_ -match '^([a-f0-9]{64})\s+(node-v[\d.]+-win-x64\.zip)\s*$' } | Select-Object -First 1)
        if (-not $line) { throw 'Cannot find the Node.js Windows x64 download.' }
        $parts = $line.Trim() -split '\s+'
        $expectedHash = $parts[0]
        $archiveName = $parts[1]
        $archive = Join-Path $runtime $archiveName
        Invoke-WebRequest -UseBasicParsing -Uri ($base + $archiveName) -OutFile $archive
        $actualHash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash
        if ($actualHash -ne $expectedHash) { throw 'Node.js checksum mismatch. Run setup again.' }
        $unpack = Join-Path $runtime 'node-unpack'
        if (Test-Path -LiteralPath $unpack) { Remove-Item -LiteralPath $unpack -Recurse -Force }
        Expand-Archive -LiteralPath $archive -DestinationPath $unpack -Force
        $extracted = Get-ChildItem -LiteralPath $unpack -Directory | Select-Object -First 1
        if (Test-Path -LiteralPath $nodeDir) { Remove-Item -LiteralPath $nodeDir -Recurse -Force }
        Move-Item -LiteralPath $extracted.FullName -Destination $nodeDir
        Remove-Item -LiteralPath $archive -Force
        Remove-Item -LiteralPath $unpack -Recurse -Force
    } else { Write-Host '[1/4] Portable Node.js is already installed.' }
    $env:PATH = $nodeDir + ';' + $env:PATH
    $env:PLAYWRIGHT_BROWSERS_PATH = Join-Path $runtime 'browsers'
    $env:npm_config_cache = Join-Path $runtime 'npm-cache'
    Write-Host '[2/4] Installing application dependencies and FFmpeg...'
    & (Join-Path $nodeDir 'npm.cmd') ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'Dependency download failed. Check your internet/VPN and run setup again.' }
    Write-Host '[3/4] Installing the offline render browser...'
    & $node (Join-Path $root 'node_modules/playwright/cli.js') install chromium
    if ($LASTEXITCODE -ne 0) {
        Write-Warning 'Browser download failed. The system check will try installed Edge or Chrome.'
    }
    Write-Host '[4/4] Checking the browser and MP4 encoder...'
    & $node (Join-Path $PSScriptRoot 'doctor.js')
    if ($LASTEXITCODE -ne 0) { throw 'System check failed. See the messages above and README-FA.html.' }
    Write-Host "`nSetup complete. Run Start-Studio.cmd. You can now disconnect the internet." -ForegroundColor Green
    exit 0
} catch {
    Write-Host ('SETUP ERROR: ' + $_.Exception.Message) -ForegroundColor Red
    Write-Host 'If downloads are blocked, enable a VPN for setup and retry. Your projects are kept.'
    exit 1
}

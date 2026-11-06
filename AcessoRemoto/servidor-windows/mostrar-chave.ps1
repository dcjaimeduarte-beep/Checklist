$ErrorActionPreference = 'Stop'
if (-not $PSScriptRoot) {
    $inv = $MyInvocation.MyCommand.Path
    if (-not $inv) { $inv = $MyInvocation.MyCommand.Definition }
    $PSScriptRoot = Split-Path -Parent $inv
}
$pub = Join-Path $PSScriptRoot 'data\id_ed25519.pub'
if (-not (Test-Path -LiteralPath $pub)) {
    Write-Host 'A chave ainda nao existe. Rode Subir-servidor.bat neste Windows.'
    exit 1
}
Write-Host 'Chave publica:'
Write-Host ((Get-Content -LiteralPath $pub | Select-Object -First 1).Trim())

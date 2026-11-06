param(
    [string]$Id = '',
    [string]$Senha = ''
)

$ErrorActionPreference = 'Stop'

$exe = Join-Path $env:ProgramFiles 'RustDesk\rustdesk.exe'
if (-not (Test-Path -LiteralPath $exe)) {
    $exe = Join-Path ${env:ProgramFiles(x86)} 'RustDesk\rustdesk.exe'
}
if (-not (Test-Path -LiteralPath $exe)) {
    Write-Host 'Rode Instalar-tecnico.bat antes de conectar.'
    exit 1
}

if (-not $Id) { $Id = Read-Host 'ID do computador do cliente' }
$Id = ($Id -replace '\s', '')
if ($Id -notmatch '^\d{6,}$') {
    Write-Host 'O ID e o numero que apareceu no arquivo da maquina do cliente.'
    exit 1
}
if (-not $Senha) {
    $Senha = Read-Host 'Senha desta maquina (a do cofre)'
}
if (-not $Senha) {
    Write-Host 'Informe a senha desta maquina.'
    exit 1
}

Start-Process -FilePath $exe -ArgumentList @('--connect', $Id, '--password', $Senha)
Write-Host "Abrindo o computador $Id."

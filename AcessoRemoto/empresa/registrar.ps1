param(
    [string]$Cliente = '',
    [string]$Computador = '',
    [string]$Id = '',
    [string]$Senha = '',
    [string]$Observacao = '',
    [string]$Arquivo = ''
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'cadastro.ps1')

if ($Arquivo) {
    if (-not (Test-Path -LiteralPath $Arquivo)) {
        Write-Host "Arquivo nao encontrado: $Arquivo"
        exit 1
    }
    $txt = Get-Content -LiteralPath $Arquivo -Raw
    if (-not $Id -and $txt -match 'ID:\s*(\d{6,})') { $Id = $Matches[1] }
    if (-not $Senha -and $txt -match '(?m)^Senha:\s*(.+)$') { $Senha = $Matches[1].Trim() }
    if (-not $Computador -and $txt -match '(?m)^Computador:\s*(.+)$') { $Computador = $Matches[1].Trim() }
    if ($Senha -like '*continua valendo*') { $Senha = '' }
}

if (-not $Cliente) { $Cliente = Read-Host 'Nome do cliente (a empresa dele)' }
if (-not $Computador) { $Computador = Read-Host 'Qual computador (caixa, escritorio, notebook)' }
if (-not $Id) { $Id = Read-Host 'ID do RustDesk' }
$Id = ($Id -replace '\s', '')
if ($Id -notmatch '^\d{6,}$') {
    Write-Host 'O ID e o numero de pelo menos 6 digitos que o RustDesk mostra.'
    exit 1
}
if (-not $Senha) { $Senha = Read-Host 'Senha permanente desta maquina' }
if (-not $Senha) {
    Write-Host 'A lista precisa da senha para qualquer pessoa da equipe entrar.'
    exit 1
}
if (-not $Observacao) { $Observacao = Read-Host 'Observacao (Enter deixa em branco)' }

$caminho = Get-CaminhoCadastro
$salvo = Add-Maquina -Caminho $caminho -Cliente $Cliente -Computador $Computador -Id $Id -Senha $Senha -Observacao $Observacao
Write-Host ("Salvo em " + $caminho)
Write-Host ($salvo.cliente + ' | ' + $salvo.computador + ' | ' + $salvo.id)
Write-Host 'Quem mais atende ve este computador no Conectar.bat, se usar o mesmo cadastro.conf.'

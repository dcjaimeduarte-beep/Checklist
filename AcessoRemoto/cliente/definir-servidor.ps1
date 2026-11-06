$ErrorActionPreference = 'Stop'

function Update-ServidorConf {
    param([switch]$PerguntarSempre)
    $confPath = Join-Path $PSScriptRoot 'servidor.conf'
    if (-not (Test-Path -LiteralPath $confPath)) {
        Write-Host 'Falta servidor.conf nesta pasta.'
        exit 1
    }
    $linhas = @(Get-Content -LiteralPath $confPath)
    $hostAtual = ''
    foreach ($linha in $linhas) {
        $t = $linha.Trim()
        if ($t -eq '' -or $t.StartsWith('#')) { continue }
        $i = $t.IndexOf('=')
        if ($i -lt 1) { continue }
        if ($t.Substring(0, $i).Trim() -eq 'ID_SERVER') {
            $hostAtual = $t.Substring($i + 1).Trim()
        }
    }
    if ($hostAtual -match ':') { $hostAtual = ($hostAtual -split ':')[0] }
    $precisa = $PerguntarSempre -or -not $hostAtual -or $hostAtual -eq 'DEFINIR'
    if ($precisa) {
        Write-Host 'Digite o IP publico ou o dominio do Linux onde o servidor esta.'
        Write-Host 'Sem http e sem barra. Exemplo: 203.0.113.10'
        $hostAtual = Read-Host 'IP ou dominio'
        if ($hostAtual -match ':') { $hostAtual = ($hostAtual -split ':')[0] }
        if ($hostAtual -notmatch '^[A-Za-z0-9._-]+$' -or $hostAtual -eq 'DEFINIR') {
            Write-Host 'Endereco invalido.'
            exit 1
        }
        $novas = @()
        $trocou = $false
        foreach ($linha in $linhas) {
            if ($linha -match '^\s*ID_SERVER=') {
                $novas += "ID_SERVER=$hostAtual"
                $trocou = $true
            } else {
                $novas += $linha
            }
        }
        if (-not $trocou) { $novas += "ID_SERVER=$hostAtual" }
        Set-Content -LiteralPath $confPath -Value $novas -Encoding ASCII
        Write-Host "Endereco salvo em servidor.conf: $hostAtual"
    }
    return $hostAtual
}

if ($MyInvocation.InvocationName -ne '.') {
    Update-ServidorConf -PerguntarSempre | Out-Null
    Write-Host 'Pode copiar esta pasta para os computadores e rodar a instalacao.'
}

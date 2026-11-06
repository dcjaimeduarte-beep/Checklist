$ErrorActionPreference = 'Stop'
if (-not $PSScriptRoot) {
    $inv = $MyInvocation.MyCommand.Path
    if (-not $inv) { $inv = $MyInvocation.MyCommand.Definition }
    $PSScriptRoot = Split-Path -Parent $inv
}

function Update-ServidorConf {
    param([switch]$PerguntarSempre)
    $confPath = Join-Path $PSScriptRoot 'servidor.conf'
    if (-not (Test-Path -Path $confPath)) {
        Write-Host 'Falta servidor.conf nesta pasta.'
        exit 1
    }
    $linhas = @(Get-Content -Path $confPath)
    $hostAtual = ''
    $chaveAtual = ''
    foreach ($linha in $linhas) {
        $t = $linha.Trim()
        if ($t -eq '' -or $t.StartsWith('#')) { continue }
        $i = $t.IndexOf('=')
        if ($i -lt 1) { continue }
        $nome = $t.Substring(0, $i).Trim()
        $valor = $t.Substring($i + 1).Trim()
        if ($nome -eq 'ID_SERVER') { $hostAtual = $valor }
        if ($nome -eq 'KEY') { $chaveAtual = $valor }
    }
    if ($hostAtual -match ':') { $hostAtual = ($hostAtual -split ':')[0] }

    $precisaIp = $PerguntarSempre -or -not $hostAtual -or $hostAtual -eq 'DEFINIR'
    if ($precisaIp) {
        Write-Host 'Digite o IP publico ou o dominio do Linux onde o servidor esta.'
        Write-Host 'Sem http e sem barra. Exemplo: 203.0.113.10'
        $hostAtual = Read-Host 'IP ou dominio'
        if ($hostAtual -match ':') { $hostAtual = ($hostAtual -split ':')[0] }
        if ($hostAtual -notmatch '^[A-Za-z0-9._-]+$' -or $hostAtual -eq 'DEFINIR') {
            Write-Host 'Endereco invalido.'
            exit 1
        }
    }

    $chaveVazia = (-not $chaveAtual) -or $chaveAtual -eq 'COLE_A_CHAVE_PUBLICA'
    if ($chaveVazia) {
        Write-Host 'Cole a chave publica que o servidor mostrou ao subir (arquivo id_ed25519.pub).'
        $chaveAtual = Read-Host 'Chave publica'
        $chaveAtual = $chaveAtual.Trim()
        if ($chaveAtual -notmatch '^[A-Za-z0-9+/=]{40,128}$' -or $chaveAtual -eq 'COLE_A_CHAVE_PUBLICA') {
            Write-Host 'Chave invalida. Copie a linha inteira, sem espaco.'
            exit 1
        }
    }

    $novas = @()
    $temIp = $false
    $temChave = $false
    foreach ($linha in $linhas) {
        if ($linha -match '^\s*ID_SERVER=') {
            $novas += "ID_SERVER=$hostAtual"
            $temIp = $true
        } elseif ($linha -match '^\s*KEY=') {
            $novas += "KEY=$chaveAtual"
            $temChave = $true
        } else {
            $novas += $linha
        }
    }
    if (-not $temIp) { $novas += "ID_SERVER=$hostAtual" }
    if (-not $temChave) { $novas += "KEY=$chaveAtual" }
    Set-Content -Path $confPath -Value $novas -Encoding ASCII
    Write-Host "Servidor salvo: $hostAtual"
    return $hostAtual
}

if ($MyInvocation.InvocationName -ne '.') {
    Update-ServidorConf -PerguntarSempre | Out-Null
    Write-Host 'Pode copiar esta pasta para os computadores e rodar a instalacao.'
}

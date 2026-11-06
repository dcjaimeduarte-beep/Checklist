# Funcoes da lista compartilhada. Conectar.bat e Registrar.bat carregam este arquivo.

function Get-CaminhoCadastro {
    $conf = Join-Path $PSScriptRoot 'cadastro.conf'
    $rel = 'cadastro.csv'
    if (Test-Path -LiteralPath $conf) {
        foreach ($linha in Get-Content -LiteralPath $conf) {
            $t = $linha.Trim()
            if ($t -eq '' -or $t.StartsWith('#')) { continue }
            $i = $t.IndexOf('=')
            if ($i -lt 1) { continue }
            if ($t.Substring(0, $i).Trim() -eq 'CADASTRO') {
                $rel = $t.Substring($i + 1).Trim()
                break
            }
        }
    }
    if ([System.IO.Path]::IsPathRooted($rel)) { return $rel }
    return (Join-Path $PSScriptRoot $rel)
}

function Get-Maquinas {
    param([string]$Caminho)
    if (-not (Test-Path -LiteralPath $Caminho)) { return @() }
    $linhas = @(Import-Csv -LiteralPath $Caminho)
    $saida = @()
    foreach ($linha in $linhas) {
        if (-not $linha.id) { continue }
        $saida += [pscustomobject]@{
            cliente     = [string]$linha.cliente
            computador  = [string]$linha.computador
            id          = ([string]$linha.id) -replace '\s', ''
            senha       = [string]$linha.senha
            observacao  = [string]$linha.observacao
        }
    }
    return $saida
}

function Save-Maquinas {
    param([string]$Caminho, [object[]]$Linhas)
    $pasta = Split-Path -Parent $Caminho
    if ($pasta -and -not (Test-Path -LiteralPath $pasta)) {
        New-Item -ItemType Directory -Force -Path $pasta | Out-Null
    }
    $tmp = $Caminho + '.tmp'
    $linhas = @($Linhas | Select-Object cliente, computador, id, senha, observacao)
    if ($linhas.Count -eq 0) {
        $vazio = [pscustomobject]@{ cliente = ''; computador = ''; id = ''; senha = ''; observacao = '' }
        $linhas = @($vazio)
        $linhas | Export-Csv -LiteralPath $tmp -NoTypeInformation -Encoding UTF8
        $texto = Get-Content -LiteralPath $tmp -Raw
        $cabeca = ($texto -split "`n")[0]
        Set-Content -LiteralPath $tmp -Value $cabeca -Encoding UTF8
    } else {
        $linhas | Export-Csv -LiteralPath $tmp -NoTypeInformation -Encoding UTF8
    }
    Move-Item -LiteralPath $tmp -Destination $Caminho -Force
}

function Add-Maquina {
    param(
        [string]$Caminho,
        [string]$Cliente,
        [string]$Computador,
        [string]$Id,
        [string]$Senha,
        [string]$Observacao
    )
    $Id = ($Id -replace '\s', '')
    $lista = New-Object System.Collections.Generic.List[object]
    foreach ($item in @(Get-Maquinas $Caminho)) { $lista.Add($item) }
    $achou = -1
    for ($i = 0; $i -lt $lista.Count; $i++) {
        if ($lista[$i].id -eq $Id) { $achou = $i; break }
    }
    $novo = [pscustomobject]@{
        cliente     = $Cliente
        computador  = $Computador
        id          = $Id
        senha       = $Senha
        observacao  = $Observacao
    }
    if ($achou -ge 0) { $lista[$achou] = $novo } else { $lista.Add($novo) }
    Save-Maquinas -Caminho $Caminho -Linhas @($lista.ToArray())
    return $novo
}

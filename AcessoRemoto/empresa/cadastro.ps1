# Funcoes da lista compartilhada. Conectar.bat e Registrar.bat carregam este arquivo.
if (-not $PSScriptRoot) {
    $inv = $MyInvocation.MyCommand.Path
    if (-not $inv) { $inv = $MyInvocation.MyCommand.Definition }
    $PSScriptRoot = Split-Path -Parent $inv
}

function Get-CaminhoCadastro {
    $conf = Join-Path $PSScriptRoot 'cadastro.conf'
    $rel = 'cadastro.csv'
    if (Test-Path -Path $conf) {
        foreach ($linha in Get-Content -Path $conf) {
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
    if (-not (Test-Path -Path $Caminho)) { return @() }
    $linhas = @(Import-Csv -Path $Caminho)
    $saida = @()
    foreach ($linha in $linhas) {
        if (-not $linha.id) { continue }
        $saida += (New-Registro $linha.cliente $linha.computador (($linha.id) -replace '\s', '') $linha.senha $linha.observacao)
    }
    return $saida
}

function Save-Maquinas {
    param([string]$Caminho, [object[]]$Linhas)
    $pasta = Split-Path -Parent $Caminho
    if ($pasta -and -not (Test-Path -Path $pasta)) {
        New-Item -ItemType Directory -Force -Path $pasta | Out-Null
    }
    $tmp = $Caminho + '.tmp'
    $linhas = @($Linhas | Select-Object cliente, computador, id, senha, observacao)
    if ($linhas.Count -eq 0) {
        Set-Content -Path $tmp -Value 'cliente,computador,id,senha,observacao'
    } elseif ($PSVersionTable.PSVersion.Major -ge 3) {
        $linhas | Export-Csv -Path $tmp -NoTypeInformation -Encoding UTF8
    } else {
        $linhas | Export-Csv -Path $tmp -NoTypeInformation
    }
    Move-Item -Path $tmp -Destination $Caminho -Force
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
    $novo = New-Registro $Cliente $Computador $Id $Senha $Observacao
    if ($achou -ge 0) { $lista[$achou] = $novo } else { $lista.Add($novo) }
    Save-Maquinas -Caminho $Caminho -Linhas @($lista.ToArray())
    return $novo
}

param(
    [string]$Id = '',
    [string]$Senha = '',
    [string]$Busca = ''
)

$ErrorActionPreference = 'Stop'
if (-not $PSScriptRoot) {
    $inv = $MyInvocation.MyCommand.Path
    if (-not $inv) { $inv = $MyInvocation.MyCommand.Definition }
    $PSScriptRoot = Split-Path -Parent $inv
}
. (Join-Path $PSScriptRoot 'windows.ps1')
. (Join-Path $PSScriptRoot 'cadastro.ps1')

function Open-Maquina {
    param($Exe, $Maquina, [string]$SenhaForcada)
    $senhaUsada = $SenhaForcada
    if (-not $senhaUsada) { $senhaUsada = $Maquina.senha }
    if (-not $senhaUsada) {
        $senhaUsada = Read-Host ("Senha de " + $Maquina.cliente + " / " + $Maquina.computador)
    }
    if (-not $senhaUsada) {
        Write-Host 'Sem senha, conexao cancelada.'
        return
    }
    Start-RustDesk -Exe $Exe -Argumentos @('--connect', $Maquina.id, '--password', $senhaUsada)
    Write-Host ("Abrindo " + $Maquina.cliente + " / " + $Maquina.computador + " (" + $Maquina.id + ").")
}

$exe = Get-RustDeskExe
if (-not $exe) {
    Write-Host 'Rode Instalar-tecnico.bat neste computador antes de conectar.'
    exit 1
}

$caminho = Get-CaminhoCadastro
Write-Host "Lista da equipe: $caminho"

if ($Id) {
    $Id = ($Id -replace '\s', '')
    $lista = @(Get-Maquinas $caminho)
    $achou = $lista | Where-Object { $_.id -eq $Id } | Select-Object -First 1
    if (-not $achou) {
        $achou = New-Registro 'Avulso' $Id $Id $Senha ''
    }
    Open-Maquina -Exe $exe -Maquina $achou -SenhaForcada $Senha
    exit 0
}

while ($true) {
    $lista = @(Get-Maquinas $caminho)
    Write-Host ''
    if ($lista.Count -eq 0) {
        Write-Host 'Nenhum computador cadastrado ainda.'
    } else {
        Write-Host 'Computadores que a equipe pode acessar:'
        $n = 1
        foreach ($m in $lista) {
            Write-Host ("{0,3}  {1} | {2} | {3}" -f $n, $m.cliente, $m.computador, $m.id)
            $n++
        }
    }
    Write-Host ''
    Write-Host 'Numero da lista, parte do nome do cliente, ou um ID.'
    Write-Host 'R registra outro computador. Enter vazio sai.'
    $resp = $Busca
    $Busca = ''
    if (-not $resp) { $resp = Read-Host 'Escolha' }
    if ($resp -eq $null -or $resp.Trim() -eq '') { exit 0 }
    $resp = $resp.Trim()

    if ($resp -eq 'R' -or $resp -eq 'r') {
        & (Join-Path $PSScriptRoot 'registrar.ps1')
        continue
    }

    $escolhida = @()
    if ($resp -match '^\d{1,4}$' -and [int]$resp -ge 1 -and [int]$resp -le $lista.Count) {
        $escolhida = @($lista[[int]$resp - 1])
    } elseif ($resp -match '^\d{6,}$') {
        $idLimpo = $resp
        $escolhida = @($lista | Where-Object { $_.id -eq $idLimpo })
        if ($escolhida.Count -eq 0) {
            $senhaAvulsa = Read-Host 'Esse ID ainda nao esta na lista. Senha desta maquina'
            if ($senhaAvulsa) {
                Open-Maquina -Exe $exe -Maquina (New-Registro 'Avulso' $idLimpo $idLimpo $senhaAvulsa '')
                $guardar = Read-Host 'Registrar na lista da equipe? Digite S para sim'
                if ($guardar -eq 'S' -or $guardar -eq 's') {
                    & (Join-Path $PSScriptRoot 'registrar.ps1') -Id $idLimpo -Senha $senhaAvulsa
                }
            }
            continue
        }
    } else {
        $trecho = $resp -replace '([*?\[\]])', '`$1'
        $escolhida = @($lista | Where-Object {
            $_.cliente -like "*$trecho*" -or $_.computador -like "*$trecho*" -or $_.id -like "*$trecho*"
        })
    }

    if ($escolhida.Count -eq 0) {
        Write-Host 'Nada encontrado com esse texto.'
        continue
    }
    if ($escolhida.Count -gt 1) {
        Write-Host 'Mais de um computador. Escolha o numero:'
        $n = 1
        foreach ($m in $escolhida) {
            Write-Host ("{0,3}  {1} | {2} | {3}" -f $n, $m.cliente, $m.computador, $m.id)
            $n++
        }
        $num = Read-Host 'Numero'
        if ($num -notmatch '^\d+$' -or [int]$num -lt 1 -or [int]$num -gt $escolhida.Count) {
            Write-Host 'Numero fora da lista.'
            continue
        }
        $escolhida = @($escolhida[[int]$num - 1])
    }

    Open-Maquina -Exe $exe -Maquina $escolhida[0]
}

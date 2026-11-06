# Funcoes que rodam no Windows PowerShell 2 em diante (Windows 7, 8, 10 e 11).

function Enable-Tls12 {
    try {
        $atual = [int][Net.ServicePointManager]::SecurityProtocol
        $junto = $atual -bor 3072
        [Net.ServicePointManager]::SecurityProtocol = [Enum]::ToObject([Net.SecurityProtocolType], $junto)
    } catch {}
}

function New-Registro {
    param($Cliente, $Computador, $Id, $Senha, $Observacao)
    $o = New-Object PSObject
    $o | Add-Member -MemberType NoteProperty -Name cliente -Value $Cliente
    $o | Add-Member -MemberType NoteProperty -Name computador -Value $Computador
    $o | Add-Member -MemberType NoteProperty -Name id -Value $Id
    $o | Add-Member -MemberType NoteProperty -Name senha -Value $Senha
    $o | Add-Member -MemberType NoteProperty -Name observacao -Value $Observacao
    return $o
}

function Test-Arquivo {
    param([string]$Caminho)
    if (-not $Caminho) { return $false }
    if ($PSVersionTable.PSVersion.Major -ge 3) { return Test-Path -LiteralPath $Caminho }
    return Test-Path -Path $Caminho
}

function Get-RustDeskExe {
    $lista = @()
    if ($env:ProgramFiles) { $lista += (Join-Path $env:ProgramFiles 'RustDesk\rustdesk.exe') }
    if (${env:ProgramFiles(x86)}) { $lista += (Join-Path ${env:ProgramFiles(x86)} 'RustDesk\rustdesk.exe') }
    foreach ($c in $lista) {
        if (Test-Arquivo $c) { return $c }
    }
    return $null
}

function Get-SufixoInstalador {
    # Build 10240 e o Windows 10. Antes disso o instalador de 64 bits (Flutter) nao abre.
    $build = 0
    try {
        $cv = Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion'
        if ($cv.CurrentBuildNumber) { $build = [int]$cv.CurrentBuildNumber }
    } catch {}
    $arch = $env:PROCESSOR_ARCHITECTURE
    if ($env:PROCESSOR_ARCHITEW6432) { $arch = $env:PROCESSOR_ARCHITEW6432 }
    if ($build -ge 10240 -and $arch -eq 'ARM64') { return 'aarch64.exe' }
    if ($build -ge 10240 -and $arch -eq 'AMD64') { return 'x86_64.exe' }
    return 'x86-sciter.exe'
}

function Receive-Texto {
    param([string]$Url)
    Enable-Tls12
    $wc = New-Object System.Net.WebClient
    $wc.Headers.Add('User-Agent', 'AcessoRemoto')
    return $wc.DownloadString($Url)
}

function Receive-Arquivo {
    param([string]$Url, [string]$Destino)
    Enable-Tls12
    $wc = New-Object System.Net.WebClient
    $wc.Headers.Add('User-Agent', 'AcessoRemoto')
    $wc.DownloadFile($Url, $Destino)
}

function Get-UrlInstalador {
    param([string]$Sufixo)
    $json = Receive-Texto 'https://api.github.com/repos/rustdesk/rustdesk/releases/latest'
    $rx = 'https://[^" ]+/rustdesk-[0-9][^" ]*-' + [regex]::Escape($Sufixo)
    $m = [regex]::Match($json, $rx)
    if ($m.Success) { return $m.Value }
    return $null
}

function Find-InstaladorLocal {
    param([string]$Pasta)
    foreach ($nome in @('rustdesk-instalador.exe')) {
        $c = Join-Path $Pasta $nome
        if (Test-Arquivo $c) { return $c }
    }
    return $null
}

function Start-RustDesk {
    param(
        [string]$Exe,
        [string[]]$Argumentos,
        [switch]$Aguardar
    )
    $texto = ''
    foreach ($a in $Argumentos) {
        if ($texto) { $texto += ' ' }
        $texto += '"' + ($a -replace '"', '\"') + '"'
    }
    if ($Aguardar) {
        Start-Process -FilePath $Exe -ArgumentList $texto -Wait -WindowStyle Hidden
    } else {
        Start-Process -FilePath $Exe -ArgumentList $texto
    }
}

function Install-RustDeskSePrecisar {
    param([string]$PastaPacote)
    $exe = Get-RustDeskExe
    if ($exe) { return $exe }

    $destino = Join-Path $env:TEMP 'rustdesk-acesso-remoto.exe'
    $local = Find-InstaladorLocal $PastaPacote
    if ($local) {
        Copy-Item -Path $local -Destination $destino -Force
        Write-Host 'Usando o instalador que esta nesta pasta.'
    } else {
        $sufixo = Get-SufixoInstalador
        Write-Host "Baixando o RustDesk para este Windows ($sufixo)..."
        $url = Get-UrlInstalador $sufixo
        if (-not $url) {
            Write-Host "Nao achei o instalador $sufixo."
            Write-Host 'Baixe o RustDesk no GitHub, grave como rustdesk-instalador.exe nesta pasta e rode de novo.'
            exit 1
        }
        try {
            Receive-Arquivo $url $destino
        } catch {
            Write-Host 'O download falhou. Neste Windows antigo, instale a atualizacao de TLS 1.2'
            Write-Host 'ou copie o instalador para esta pasta com o nome rustdesk-instalador.exe.'
            exit 1
        }
    }

    Write-Host 'Instalando...'
    Start-Process -FilePath $destino -ArgumentList '--silent-install' -Wait
    $limite = (Get-Date).AddSeconds(50)
    do {
        Start-Sleep -Seconds 2
        $exe = Get-RustDeskExe
    } while (-not $exe -and (Get-Date) -lt $limite)
    Remove-Item -Path $destino -Force -ErrorAction SilentlyContinue
    if (-not $exe) {
        Write-Host 'O RustDesk nao apareceu em Arquivos de Programas.'
        exit 1
    }
    return $exe
}

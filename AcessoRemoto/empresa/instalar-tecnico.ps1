$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
if (-not $PSScriptRoot) {
    $inv = $MyInvocation.MyCommand.Path
    if (-not $inv) { $inv = $MyInvocation.MyCommand.Definition }
    $PSScriptRoot = Split-Path -Parent $inv
}
. (Join-Path $PSScriptRoot 'windows.ps1')

function Test-Admin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $p = New-Object Security.Principal.WindowsPrincipal($id)
    return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-Admin)) {
    $arg = '-NoProfile -ExecutionPolicy Bypass -File "' + $PSCommandPath + '"'
    Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList $arg -Wait
    exit
}

$hostServidor = ''
$chave = ''
$confPath = Join-Path $PSScriptRoot 'servidor.conf'
if (Test-Path -Path $confPath) {
    foreach ($linhaBruta in @(Get-Content -Path $confPath)) {
        $linha = $linhaBruta.Trim()
        if ($linha -eq '' -or $linha.StartsWith('#')) { continue }
        $i = $linha.IndexOf('=')
        if ($i -lt 1) { continue }
        $nome = $linha.Substring(0, $i).Trim()
        $valor = $linha.Substring($i + 1).Trim()
        if ($nome -eq 'ID_SERVER') { $hostServidor = $valor }
        if ($nome -eq 'KEY') { $chave = $valor }
    }
}
if ($hostServidor -match ':') { $hostServidor = ($hostServidor -split ':')[0] }
$usaServidorProprio = ($hostServidor -match '^[A-Za-z0-9._-]+$' -and $hostServidor -ne 'DEFINIR' -and $chave -match '^[A-Za-z0-9+/=]{40,128}$' -and $chave -ne 'COLE_A_CHAVE_PUBLICA')

$exe = Install-RustDeskSePrecisar -PastaPacote $PSScriptRoot
if (-not $exe) { Write-Host 'RustDesk nao instalou.'; exit 1 }

if ($usaServidorProprio) {
    $utf8 = New-Object System.Text.UTF8Encoding $false
    $toml = @"
rendezvous_server = '$hostServidor:21116'
nat_type = 1
serial = 0

[options]
custom-rendezvous-server = '$hostServidor'
relay-server = '$hostServidor'
key = '$chave'
"@
    $pasta = Join-Path $env:APPDATA 'RustDesk\config'
    New-Item -ItemType Directory -Force -Path $pasta | Out-Null
    [System.IO.File]::WriteAllText((Join-Path $pasta 'RustDesk2.toml'), $toml, $utf8)
    Start-RustDesk -Exe $exe -Argumentos @('--option', 'custom-rendezvous-server', $hostServidor) -Aguardar
    Start-RustDesk -Exe $exe -Argumentos @('--option', 'relay-server', $hostServidor) -Aguardar
    Start-RustDesk -Exe $exe -Argumentos @('--option', 'key', $chave) -Aguardar
    Write-Host "RustDesk deste computador aponta para $hostServidor."
} else {
    Write-Host 'RustDesk instalado neste computador.'
}

Write-Host 'Para entrar no cliente, abra o RustDesk, digite o ID e a senha do arquivo que ele enviou.'
Write-Host 'Ou use Conectar.bat com esse ID.'
Write-Host 'Pressione Enter para fechar.'
Read-Host | Out-Null

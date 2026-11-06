$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
if (-not $PSScriptRoot) {
    $inv = $MyInvocation.MyCommand.Path
    if (-not $inv) { $inv = $MyInvocation.MyCommand.Definition }
    $PSScriptRoot = Split-Path -Parent $inv
}
. (Join-Path $PSScriptRoot 'windows.ps1')
. (Join-Path $PSScriptRoot 'definir-servidor.ps1')
Update-ServidorConf | Out-Null

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

$confPath = Join-Path $PSScriptRoot 'servidor.conf'
if (-not (Test-Path $confPath)) {
    Write-Host 'Falta servidor.conf. Rode ./scripts/preparar-cliente.sh no Linux e use a pasta para-a-empresa.'
    exit 1
}

$conf = @{}
foreach ($linhaBruta in @(Get-Content -Path $confPath)) {
    $linha = $linhaBruta.Trim()
    if ($linha -eq '' -or $linha.StartsWith('#')) { continue }
    $i = $linha.IndexOf('=')
    if ($i -lt 1) { continue }
    $conf[$linha.Substring(0, $i).Trim()] = $linha.Substring($i + 1).Trim()
}

$hostServidor = $conf['ID_SERVER']
$chave = $conf['KEY']
if ($hostServidor -match ':') { $hostServidor = ($hostServidor -split ':')[0] }
if ($hostServidor -notmatch '^[A-Za-z0-9._-]+$' -or $chave -notmatch '^[A-Za-z0-9+/=]{40,128}$' -or $chave -eq 'COLE_A_CHAVE_PUBLICA') {
    Write-Host 'servidor.conf ainda esta com o exemplo. Gere o pacote de novo com a chave publica do servidor.'
    exit 1
}

$exe = Install-RustDeskSePrecisar -PastaPacote $PSScriptRoot
if (-not $exe) { Write-Host 'RustDesk nao instalou.'; exit 1 }

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
Write-Host 'Para entrar no cliente, use Conectar.bat com o ID que ele enviou.'
Write-Host 'Pressione Enter para fechar.'
Read-Host | Out-Null

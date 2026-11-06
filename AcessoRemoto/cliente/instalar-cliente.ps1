param(
    [switch]$Confirmado,
    [switch]$NovaSenha,
    [string]$Desktop = '',
    [string]$PerfilUsuario = ''
)

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
    if (-not $Desktop) { $Desktop = [Environment]::GetFolderPath('Desktop') }
    if (-not $PerfilUsuario) { $PerfilUsuario = $env:USERPROFILE }
    $arg = '-NoProfile -ExecutionPolicy Bypass -File "' + $PSCommandPath + '" -Desktop "' + $Desktop + '" -PerfilUsuario "' + $PerfilUsuario + '"'
    if ($Confirmado) { $arg += ' -Confirmado' }
    if ($NovaSenha) { $arg += ' -NovaSenha' }
    Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList $arg -Wait
    exit
}

if (-not $PerfilUsuario) { $PerfilUsuario = $env:USERPROFILE }
if (-not $Desktop) { $Desktop = Join-Path $PerfilUsuario 'Desktop' }

$empresa = 'Empresa de informatica'
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
        if ($nome -eq 'EMPRESA' -and $valor) { $empresa = $valor }
        if ($nome -eq 'ID_SERVER') { $hostServidor = $valor }
        if ($nome -eq 'KEY') { $chave = $valor }
    }
}
if ($hostServidor -match ':') { $hostServidor = ($hostServidor -split ':')[0] }
$usaServidorProprio = ($hostServidor -match '^[A-Za-z0-9._-]+$' -and $hostServidor -ne 'DEFINIR' -and $chave -match '^[A-Za-z0-9+/=]{40,128}$' -and $chave -ne 'COLE_A_CHAVE_PUBLICA')

if (-not $Confirmado) {
    Write-Host ''
    Write-Host "Isto instala o RustDesk para $empresa acessar a tela deste computador."
    Write-Host 'O icone fica visivel perto do relogio. So siga se esse acesso foi autorizado.'
    $resposta = Read-Host 'Digite SIM para autorizar'
    if ($resposta -ne 'SIM') {
        Write-Host 'Instalacao cancelada.'
        exit 1
    }
}

$jaExistia = $null -ne (Get-Service -Name 'Rustdesk' -ErrorAction SilentlyContinue)

$exe = Install-RustDeskSePrecisar -PastaPacote $PSScriptRoot

if (-not $exe) {
    Write-Host 'O RustDesk nao apareceu em Arquivos de Programas. Abra o instalador oficial e rode este arquivo de novo.'
    exit 1
}

Write-Host 'Ativando o servico, com o icone na bandeja...'
Start-Process -FilePath $exe -ArgumentList '--install-service' -Wait
$limiteServico = (Get-Date).AddSeconds(40)
do {
    $svc = Get-Service -Name 'Rustdesk' -ErrorAction SilentlyContinue
    if ($svc -and $svc.Status -eq 'Running') { break }
    if ($svc) { Start-Service -Name 'Rustdesk' -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 2
} while ((Get-Date) -lt $limiteServico)

$utf8 = New-Object System.Text.UTF8Encoding $false
if ($usaServidorProprio) {
    $toml = @"
rendezvous_server = '$hostServidor:21116'
nat_type = 1
serial = 0

[options]
custom-rendezvous-server = '$hostServidor'
relay-server = '$hostServidor'
key = '$chave'
approve-mode = 'password'
"@
} else {
    $hostServidor = 'rede do RustDesk'
    $toml = @"
nat_type = 1
serial = 0

[options]
approve-mode = 'password'
"@
}

$pastas = @(
    'C:\Windows\ServiceProfiles\LocalService\AppData\Roaming\RustDesk\config',
    (Join-Path $PerfilUsuario 'AppData\Roaming\RustDesk\config')
)
foreach ($pasta in $pastas) {
    New-Item -ItemType Directory -Force -Path $pasta | Out-Null
    [System.IO.File]::WriteAllText((Join-Path $pasta 'RustDesk2.toml'), $toml, $utf8)
}

if ($usaServidorProprio) {
    Start-RustDesk -Exe $exe -Argumentos @('--option', 'custom-rendezvous-server', $hostServidor) -Aguardar
    Start-RustDesk -Exe $exe -Argumentos @('--option', 'relay-server', $hostServidor) -Aguardar
    Start-RustDesk -Exe $exe -Argumentos @('--option', 'key', $chave) -Aguardar
}
Start-RustDesk -Exe $exe -Argumentos @('--option', 'approve-mode', 'password') -Aguardar

Restart-Service -Name 'Rustdesk' -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3

$senhaTexto = 'A senha permanente anterior continua valendo. Ela esta no cofre da empresa.'
if (-not $jaExistia -or $NovaSenha) {
    $alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'.ToCharArray()
    $bytes = New-Object byte[] 16
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    $chars = foreach ($b in $bytes) { $alfabeto[$b % $alfabeto.Length] }
    $senha = -join $chars
    Start-RustDesk -Exe $exe -Argumentos @('--password', $senha) -Aguardar
    $senhaTexto = $senha
}

$id = ''
foreach ($t in 1..15) {
    $saida = & $exe --get-id 2>&1 | Out-String
    $m = [regex]::Match($saida, '\d{6,}')
    if ($m.Success) { $id = $m.Value; break }
    Start-Sleep -Seconds 2
}
if (-not $id) { $id = '(abra o RustDesk e copie o numero da janela)' }

$texto = @"
$empresa
Computador: $env:COMPUTERNAME
ID: $id
Senha: $senhaTexto

Envie este arquivo para o tecnico.
No computador dele, abra o RustDesk, digite este ID e esta senha.
O icone do RustDesk fica perto do relogio.
"@

New-Item -ItemType Directory -Force -Path 'C:\ProgramData\AcessoRemoto' | Out-Null
$arquivoPrograma = 'C:\ProgramData\AcessoRemoto\maquina.txt'
[System.IO.File]::WriteAllText($arquivoPrograma, $texto, $utf8)
if ($Desktop) {
    New-Item -ItemType Directory -Force -Path $Desktop | Out-Null
    [System.IO.File]::WriteAllText((Join-Path $Desktop 'Acesso-remoto-desta-maquina.txt'), $texto, $utf8)
}

Write-Host ''
Write-Host $texto
Write-Host "Copia em $arquivoPrograma"
Write-Host 'Pressione Enter para fechar.'
Read-Host | Out-Null

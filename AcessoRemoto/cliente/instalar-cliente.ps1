param(
    [switch]$Confirmado,
    [switch]$NovaSenha,
    [string]$Desktop = '',
    [string]$PerfilUsuario = ''
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ProgressPreference = 'SilentlyContinue'
. (Join-Path $PSScriptRoot 'definir-servidor.ps1')
Update-ServidorConf | Out-Null

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

$confPath = Join-Path $PSScriptRoot 'servidor.conf'
if (-not (Test-Path $confPath)) {
    Write-Host 'Falta servidor.conf nesta pasta. Na empresa, rode ./scripts/preparar-cliente.sh e envie o pacote gerado.'
    exit 1
}

$conf = @{}
Get-Content -LiteralPath $confPath | ForEach-Object {
    $linha = $_.Trim()
    if ($linha -eq '' -or $linha.StartsWith('#')) { return }
    $i = $linha.IndexOf('=')
    if ($i -lt 1) { return }
    $conf[$linha.Substring(0, $i).Trim()] = $linha.Substring($i + 1).Trim()
}

$empresa = $conf['EMPRESA']
if (-not $empresa) { $empresa = 'Empresa de informatica' }
$hostServidor = $conf['ID_SERVER']
$chave = $conf['KEY']
if ($hostServidor -match ':') { $hostServidor = ($hostServidor -split ':')[0] }

if ($hostServidor -notmatch '^[A-Za-z0-9._-]+$') {
    Write-Host 'ID_SERVER invalido em servidor.conf. Use o IP ou o dominio, sem http e sem barra.'
    exit 1
}
if ($chave -notmatch '^[A-Za-z0-9+/=]{40,128}$' -or $chave -eq 'COLE_A_CHAVE_PUBLICA') {
    Write-Host 'KEY invalida em servidor.conf. Use a chave publica id_ed25519.pub do servidor.'
    exit 1
}

if (-not $Confirmado) {
    Write-Host ""
    Write-Host "Isto instala o RustDesk para $empresa acessar a tela deste computador."
    Write-Host 'O icone fica visivel perto do relogio. So siga se esse acesso foi autorizado.'
    $resposta = Read-Host 'Digite SIM para autorizar'
    if ($resposta -ne 'SIM') {
        Write-Host 'Instalacao cancelada.'
        exit 1
    }
}

$jaExistia = $null -ne (Get-Service -Name 'Rustdesk' -ErrorAction SilentlyContinue)

function Get-RustDeskExe {
    $candidatos = @(
        (Join-Path $env:ProgramFiles 'RustDesk\rustdesk.exe'),
        (Join-Path ${env:ProgramFiles(x86)} 'RustDesk\rustdesk.exe')
    )
    foreach ($c in $candidatos) {
        if ($c -and (Test-Path -LiteralPath $c)) { return $c }
    }
    return $null
}

$exe = Get-RustDeskExe
if (-not $exe) {
    Write-Host 'Baixando o RustDesk no GitHub...'
    $headers = @{ 'User-Agent' = 'AcessoRemoto' }
    $release = Invoke-RestMethod -Headers $headers -Uri 'https://api.github.com/repos/rustdesk/rustdesk/releases/latest'
    $asset = $release.assets | Where-Object { $_.name -match '^rustdesk-.+-x86_64\.exe$' } | Select-Object -First 1
    if (-not $asset) {
        Write-Host 'Nao achei o instalador Windows de 64 bits na versao mais recente do RustDesk.'
        exit 1
    }
    $destino = Join-Path $env:TEMP 'rustdesk-acesso-remoto.exe'
    Invoke-WebRequest -Headers $headers -Uri $asset.browser_download_url -OutFile $destino
    Write-Host 'Instalando...'
    Start-Process -FilePath $destino -ArgumentList '--silent-install' -Wait
    $limite = (Get-Date).AddSeconds(40)
    do {
        Start-Sleep -Seconds 2
        $exe = Get-RustDeskExe
    } while (-not $exe -and (Get-Date) -lt $limite)
    Remove-Item -LiteralPath $destino -Force -ErrorAction SilentlyContinue
}

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

$pastas = @(
    'C:\Windows\ServiceProfiles\LocalService\AppData\Roaming\RustDesk\config',
    (Join-Path $PerfilUsuario 'AppData\Roaming\RustDesk\config')
)
foreach ($pasta in $pastas) {
    New-Item -ItemType Directory -Force -Path $pasta | Out-Null
    [System.IO.File]::WriteAllText((Join-Path $pasta 'RustDesk2.toml'), $toml, $utf8)
}

foreach ($par in @(
    @('custom-rendezvous-server', $hostServidor),
    @('relay-server', $hostServidor),
    @('key', $chave),
    @('approve-mode', 'password')
)) {
    Start-Process -FilePath $exe -ArgumentList @('--option', $par[0], $par[1]) -Wait -WindowStyle Hidden
}

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
    Start-Process -FilePath $exe -ArgumentList @('--password', $senha) -Wait -WindowStyle Hidden
    $senhaTexto = $senha
}

$id = ''
foreach ($t in 1..8) {
    $saida = & $exe --get-id 2>&1 | Out-String
    $m = [regex]::Match($saida, '\d{6,}')
    if ($m.Success) { $id = $m.Value; break }
    Start-Sleep -Seconds 2
}
if (-not $id) { $id = '(abra o RustDesk e copie o ID da janela)' }

$texto = @"
$empresa
Computador: $env:COMPUTERNAME
ID: $id
Senha: $senhaTexto
Servidor: $hostServidor

Envie este arquivo para a empresa. A senha e so desta maquina.
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

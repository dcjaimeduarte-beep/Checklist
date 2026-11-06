$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ProgressPreference = 'SilentlyContinue'

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
Get-Content -LiteralPath $confPath | ForEach-Object {
    $linha = $_.Trim()
    if ($linha -eq '' -or $linha.StartsWith('#')) { return }
    $i = $linha.IndexOf('=')
    if ($i -lt 1) { return }
    $conf[$linha.Substring(0, $i).Trim()] = $linha.Substring($i + 1).Trim()
}

$hostServidor = $conf['ID_SERVER']
$chave = $conf['KEY']
if ($hostServidor -match ':') { $hostServidor = ($hostServidor -split ':')[0] }
if ($hostServidor -notmatch '^[A-Za-z0-9._-]+$' -or $chave -notmatch '^[A-Za-z0-9+/=]{40,128}$' -or $chave -eq 'COLE_A_CHAVE_PUBLICA') {
    Write-Host 'servidor.conf ainda esta com o exemplo. Gere o pacote de novo com a chave publica do servidor.'
    exit 1
}

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
    if (-not $asset) { Write-Host 'Instalador Windows de 64 bits nao encontrado.'; exit 1 }
    $destino = Join-Path $env:TEMP 'rustdesk-acesso-remoto.exe'
    Invoke-WebRequest -Headers $headers -Uri $asset.browser_download_url -OutFile $destino
    Start-Process -FilePath $destino -ArgumentList '--silent-install' -Wait
    $limite = (Get-Date).AddSeconds(40)
    do {
        Start-Sleep -Seconds 2
        $exe = Get-RustDeskExe
    } while (-not $exe -and (Get-Date) -lt $limite)
    Remove-Item -LiteralPath $destino -Force -ErrorAction SilentlyContinue
}
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

foreach ($par in @(
    @('custom-rendezvous-server', $hostServidor),
    @('relay-server', $hostServidor),
    @('key', $chave)
)) {
    Start-Process -FilePath $exe -ArgumentList @('--option', $par[0], $par[1]) -Wait -WindowStyle Hidden
}

Write-Host "RustDesk deste computador aponta para $hostServidor."
Write-Host 'Para entrar no cliente, use Conectar.bat com o ID que ele enviou.'
Write-Host 'Pressione Enter para fechar.'
Read-Host | Out-Null

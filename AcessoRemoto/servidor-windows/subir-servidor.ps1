$ErrorActionPreference = 'Stop'
if (-not $PSScriptRoot) {
    $inv = $MyInvocation.MyCommand.Path
    if (-not $inv) { $inv = $MyInvocation.MyCommand.Definition }
    $PSScriptRoot = Split-Path -Parent $inv
}

function Test-Admin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $p = New-Object Security.Principal.WindowsPrincipal($id)
    return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Enable-Tls12 {
    try {
        $atual = [int][Net.ServicePointManager]::SecurityProtocol
        $junto = $atual -bor 3072
        [Net.ServicePointManager]::SecurityProtocol = [Enum]::ToObject([Net.SecurityProtocolType], $junto)
    } catch {}
}

if (-not (Test-Admin)) {
    $arg = '-NoProfile -ExecutionPolicy Bypass -File "' + $PSCommandPath + '"'
    Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList $arg -Wait
    exit
}

$raiz = $PSScriptRoot
$bin = Join-Path $raiz 'bin'
$data = Join-Path $raiz 'data'
New-Item -ItemType Directory -Force -Path $bin | Out-Null
New-Item -ItemType Directory -Force -Path $data | Out-Null

$hbbs = Join-Path $bin 'hbbs.exe'
$hbbr = Join-Path $bin 'hbbr.exe'
if (-not (Test-Path -LiteralPath $hbbs) -or -not (Test-Path -LiteralPath $hbbr)) {
    Write-Host 'Baixando o servidor do RustDesk para Windows...'
    Enable-Tls12
    $wc = New-Object System.Net.WebClient
    $wc.Headers.Add('User-Agent', 'AcessoRemoto')
    $url = 'https://github.com/rustdesk/rustdesk-server/releases/download/1.1.16/rustdesk-server-windows-x86_64-unsigned.zip'
    try {
        $json = $wc.DownloadString('https://api.github.com/repos/rustdesk/rustdesk-server/releases/latest')
        $m = [regex]::Match($json, 'https://[^" ]+rustdesk-server-windows-x86_64-unsigned\.zip')
        if ($m.Success) { $url = $m.Value }
    } catch {}
    $zip = Join-Path $env:TEMP 'rustdesk-server-windows.zip'
    $extraido = Join-Path $env:TEMP 'rustdesk-server-windows'
    if (Test-Path -LiteralPath $extraido) { Remove-Item -LiteralPath $extraido -Recurse -Force }
    $wc.DownloadFile($url, $zip)
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::ExtractToDirectory($zip, $extraido)
    Copy-Item -LiteralPath (Join-Path $extraido 'x86_64\hbbs.exe') -Destination $hbbs -Force
    Copy-Item -LiteralPath (Join-Path $extraido 'x86_64\hbbr.exe') -Destination $hbbr -Force
    Write-Host 'Download concluido.'
}

$regras = @(
    @{ Nome = 'AcessoRemoto 21115 TCP'; Proto = 'TCP'; Porta = '21115' },
    @{ Nome = 'AcessoRemoto 21116 TCP'; Proto = 'TCP'; Porta = '21116' },
    @{ Nome = 'AcessoRemoto 21116 UDP'; Proto = 'UDP'; Porta = '21116' },
    @{ Nome = 'AcessoRemoto 21117 TCP'; Proto = 'TCP'; Porta = '21117' }
)
foreach ($r in $regras) {
    cmd /c ('netsh advfirewall firewall delete rule name="' + $r.Nome + '"') | Out-Null
    cmd /c ('netsh advfirewall firewall add rule name="' + $r.Nome + '" dir=in action=allow protocol=' + $r.Proto + ' localport=' + $r.Porta) | Out-Null
}

function Test-NossoProcesso {
    param([string]$Nome)
    $filtro = "Name='" + $Nome + "'"
    $procs = @(Get-WmiObject Win32_Process -Filter $filtro)
    foreach ($p in $procs) {
        if (-not $p.ExecutablePath) { continue }
        $prefixo = $bin.ToLower()
        if (-not $prefixo.EndsWith('\')) { $prefixo += '\' }
        if ($p.ExecutablePath.ToLower().StartsWith($prefixo)) { return $true }
    }
    return $false
}

if (-not (Test-NossoProcesso 'hbbr.exe')) {
    Start-Process -FilePath $hbbr -WorkingDirectory $data -WindowStyle Minimized
    Start-Sleep -Seconds 2
}
if (-not (Test-NossoProcesso 'hbbs.exe')) {
    Start-Process -FilePath $hbbs -WorkingDirectory $data -WindowStyle Minimized
}

$pub = Join-Path $data 'id_ed25519.pub'
$espera = 0
while (-not (Test-Path -LiteralPath $pub) -and $espera -lt 25) {
    Start-Sleep -Seconds 1
    $espera++
}
if (-not (Test-Path -LiteralPath $pub)) {
    Write-Host 'A chave nao apareceu.'
    Write-Host 'Se o Windows bloqueou hbbs.exe ou hbbr.exe, clique em Mais informacoes e em Executar assim mesmo.'
    Write-Host 'Depois rode Subir-servidor.bat de novo.'
    exit 1
}

$tarefa = Join-Path $raiz 'iniciar-com-o-windows.bat'
$linhasBat = @(
    '@echo off',
    'cd /d "' + $data + '"',
    'tasklist /FI "IMAGENAME eq hbbr.exe" | find /I "hbbr.exe" >nul',
    'if errorlevel 1 start "" /MIN "' + $hbbr + '"',
    'timeout /t 2 /nobreak >nul',
    'tasklist /FI "IMAGENAME eq hbbs.exe" | find /I "hbbs.exe" >nul',
    'if errorlevel 1 start "" /MIN "' + $hbbs + '"'
)
Set-Content -LiteralPath $tarefa -Value $linhasBat -Encoding ASCII
cmd /c ('schtasks /Create /F /TN AcessoRemoto /SC ONSTART /RL HIGHEST /RU SYSTEM /TR "\"' + $tarefa + '\""') | Out-Null

Write-Host ''
Write-Host 'Servidor no ar neste Windows.'
Write-Host 'Chave publica (cole no Definir-servidor.bat):'
Write-Host ((Get-Content -LiteralPath $pub | Select-Object -First 1).Trim())
Write-Host ''
Write-Host 'IP deste Windows, para computadores na mesma rede:'
$nics = @(Get-WmiObject Win32_NetworkAdapterConfiguration -Filter 'IPEnabled=True')
foreach ($n in $nics) {
    foreach ($ip in @($n.IPAddress)) {
        if ($ip -match '^\d+\.\d+\.\d+\.\d+$' -and $ip -notlike '127.*') {
            Write-Host $ip
        }
    }
}
Write-Host ''
Write-Host 'Deixe este computador ligado. Se ele desligar, ninguem entra no cliente.'
Write-Host 'Cliente em outro endereco: no roteador, encaminhe 21115/tcp, 21116/tcp, 21116/udp e 21117/tcp'
Write-Host 'para este Windows e use o IP publico da internet no Definir-servidor.bat.'
Write-Host ''
Write-Host 'Pressione Enter para fechar. O servidor continua rodando.'
Read-Host | Out-Null

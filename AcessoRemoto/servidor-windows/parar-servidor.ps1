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

if (-not (Test-Admin)) {
    $arg = '-NoProfile -ExecutionPolicy Bypass -File "' + $PSCommandPath + '"'
    Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList $arg -Wait
    exit
}

$bin = (Join-Path $PSScriptRoot 'bin').ToLower()
$procs = @(Get-WmiObject Win32_Process -Filter "Name='hbbs.exe' OR Name='hbbr.exe'")
foreach ($p in $procs) {
    $caminho = ''
    if ($p.ExecutablePath) { $caminho = $p.ExecutablePath.ToLower() }
    $prefixo = $bin
    if (-not $prefixo.EndsWith('\')) { $prefixo += '\' }
    if ($caminho.StartsWith($prefixo)) {
        Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
    }
}
cmd /c 'schtasks /End /TN AcessoRemoto' | Out-Null
Write-Host 'Servidor parado. A pasta data e a chave publica continuam neste computador.'

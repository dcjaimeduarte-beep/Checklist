; ══════════════════════════════════════════════════════════════════════════════
;  Checklist Seven v2.1 — Script Inno Setup
;  Compilar com: Inno Setup 6  (https://jrsoftware.org/isinfo.php)
;  Gera: ChecklistSeven-Setup.exe
;
;  COMO COMPILAR:
;    1. Instale o Inno Setup 6
;    2. Abra este arquivo no Inno Setup
;    3. Menu Build → Compile  (ou F9)
;    4. O instalador será gerado na mesma pasta deste arquivo
; ══════════════════════════════════════════════════════════════════════════════

#define AppName      "Checklist Seven"
#define AppVersion   "2.1"
#define AppPublisher "Seven Sistemas de Automacao"
#define AppGUID      "{{A7B3C2D1-E4F5-4A6B-8C9D-0E1F2A3B4C5D}"
#define SrcDir       "checklist-seven-v2-deploy"

; ── Informações do instalador ─────────────────────────────────────────────────

[Setup]
AppId={#AppGUID}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL=http://localhost:3000
AppSupportURL=http://localhost:3000
VersionInfoVersion={#AppVersion}.0.0
VersionInfoCompany={#AppPublisher}
VersionInfoDescription=Instalador do {#AppName}

DefaultDirName={autopf}\Seven\ChecklistSeven
DefaultGroupName={#AppName}
AllowNoIcons=yes
DisableProgramGroupPage=no

OutputDir=.
OutputBaseFilename=ChecklistSeven-Setup

Compression=lzma2/ultra64
SolidCompression=yes

PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=dialog

WizardStyle=modern
WizardSizePercent=120
DisableWelcomePage=no

MinVersion=6.1

; ── Idioma ────────────────────────────────────────────────────────────────────

[Languages]
Name: "ptbr"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

; ── Mensagens customizadas ────────────────────────────────────────────────────

[CustomMessages]
ptbr.NodeNotFound=Node.js nao foi encontrado neste computador.%n%nE necessario instalar o Node.js 20 LTS antes de continuar.%n%nDeseja abrir o site de download agora?
ptbr.UpgradeDetected=Uma versao anterior do Checklist Seven foi detectada.%n%nSeus dados (configuracoes, vistorias e fotos) serao preservados.%n%nDeseja continuar a atualizacao?
ptbr.InstallDeps=Instalando dependencias Node.js...
ptbr.InstallPM2=Instalando PM2 (gerenciador de processos)...
ptbr.ConfigAutostart=Configurando inicializacao automatica com o Windows...
ptbr.StartServer=Iniciando servidor Checklist Seven...
ptbr.ConfigFirewall=Configurando firewall (porta 3000)...

; ── Tarefas opcionais ─────────────────────────────────────────────────────────

[Tasks]
Name: desktopicon; Description: "Criar atalho na Area de Trabalho"; GroupDescription: "Atalhos adicionais:"; Flags: unchecked
Name: openkanban;  Description: "Abrir o Kanban da Oficina ao finalizar"; GroupDescription: "Ao concluir:"

; ── Arquivos ──────────────────────────────────────────────────────────────────

[Files]
; Código backend (Node.js)
Source: "{#SrcDir}\backend\src\*"; DestDir: "{app}\backend\src"; Flags: ignoreversion recursesubdirs createallsubdirs
; Frontend compilado (React)
Source: "{#SrcDir}\backend\public\*"; DestDir: "{app}\backend\public"; Flags: ignoreversion recursesubdirs createallsubdirs
; Configuração
Source: "{#SrcDir}\backend\package.json"; DestDir: "{app}\backend"; Flags: ignoreversion
Source: "{#SrcDir}\backend\ecosystem.config.js"; DestDir: "{app}\backend"; Flags: ignoreversion
Source: "{#SrcDir}\backend\.env.example"; DestDir: "{app}\backend"; Flags: ignoreversion
; Atalhos e scripts (criados como arquivos reais no deploy folder)
Source: "{#SrcDir}\Abrir Checklist.url"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#SrcDir}\Abrir Kanban.url"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#SrcDir}\reiniciar.bat"; DestDir: "{app}"; Flags: ignoreversion

; ── Pastas de dados (criadas vazias) ─────────────────────────────────────────

[Dirs]
Name: "{app}\backend\data"
Name: "{app}\backend\uploads"
Name: "{app}\backend\logs"

; ── Ícones do Menu Iniciar ────────────────────────────────────────────────────

[Icons]
Name: "{group}\Abrir Checklist"; Filename: "{app}\Abrir Checklist.url"
Name: "{group}\Abrir Kanban da Oficina"; Filename: "{app}\Abrir Kanban.url"
Name: "{group}\Reiniciar Servidor"; Filename: "{app}\reiniciar.bat"; WorkingDir: "{app}"
Name: "{group}\Editar Configuracoes (.env)"; Filename: "{app}\backend\.env"
Name: "{group}\Ver Logs do Servidor"; Filename: "{app}\backend\logs"
Name: "{group}\Desinstalar {#AppName}"; Filename: "{uninstallexe}"
Name: "{commondesktop}\Checklist Seven"; Filename: "{app}\Abrir Checklist.url"; Tasks: desktopicon

; ── Execução pós-instalação ───────────────────────────────────────────────────

[Run]

; 1. Instalar dependências Node.js
Filename: "{cmd}"; Parameters: "/c npm install --omit=dev"; WorkingDir: "{app}\backend"; StatusMsg: "{cm:InstallDeps}"; Flags: runhidden waituntilterminated

; 2. Instalar PM2 e pm2-windows-startup globalmente
Filename: "{cmd}"; Parameters: "/c npm install -g pm2 pm2-windows-startup"; StatusMsg: "{cm:InstallPM2}"; Flags: runhidden waituntilterminated

; 3. Registrar PM2 para iniciar com o Windows
Filename: "{cmd}"; Parameters: "/c pm2-startup install"; StatusMsg: "{cm:ConfigAutostart}"; Flags: runhidden waituntilterminated

; 4. Parar processo anterior se existir, iniciar e salvar
Filename: "{cmd}"; Parameters: "/c pm2 delete checklist-seven 2>nul & pm2 start ecosystem.config.js & pm2 save"; WorkingDir: "{app}\backend"; StatusMsg: "{cm:StartServer}"; Flags: runhidden waituntilterminated

; 5. Criar regra de firewall para a porta 3000
Filename: "netsh"; Parameters: "advfirewall firewall add rule name=""Checklist Seven"" dir=in action=allow protocol=TCP localport=3000 enable=yes"; StatusMsg: "{cm:ConfigFirewall}"; Flags: runhidden waituntilterminated

; 6. Abrir no navegador ao finalizar
Filename: "{app}\Abrir Checklist.url"; Flags: shellexec skipifsilent nowait
Filename: "{app}\Abrir Kanban.url"; Flags: shellexec skipifsilent nowait; Tasks: openkanban

; ── Execução na desinstalação ─────────────────────────────────────────────────

[UninstallRun]
Filename: "{cmd}"; Parameters: "/c pm2 stop checklist-seven & pm2 delete checklist-seven & pm2 save"; Flags: runhidden waituntilterminated; RunOnceId: "pm2stop"
Filename: "netsh"; Parameters: "advfirewall firewall delete rule name=""Checklist Seven"""; Flags: runhidden waituntilterminated; RunOnceId: "fwremove"

; ── Lógica Pascal ─────────────────────────────────────────────────────────────

[Code]

function NodeInstalled(): Boolean;
var
  ResultCode: Integer;
begin
  Result := Exec(ExpandConstant('{cmd}'), '/c node --version >nul 2>&1',
                 '', SW_HIDE, ewWaitUntilTerminated, ResultCode)
            and (ResultCode = 0);
end;

function IsUpgrade(): Boolean;
begin
  Result := RegKeyExists(HKLM, 'Software\Microsoft\Windows\CurrentVersion\Uninstall\{#AppGUID}_is1')
         or RegKeyExists(HKCU, 'Software\Microsoft\Windows\CurrentVersion\Uninstall\{#AppGUID}_is1');
end;

function InitializeSetup(): Boolean;
var
  ResultCode: Integer;
begin
  if not NodeInstalled() then begin
    if MsgBox(CustomMessage('NodeNotFound'), mbError, MB_YESNO) = IDYES then
      ShellExec('open', 'https://nodejs.org', '', '', SW_SHOW, ewNoWait, ResultCode);
    Result := False;
    Exit;
  end;

  if IsUpgrade() then begin
    if MsgBox(CustomMessage('UpgradeDetected'), mbConfirmation, MB_YESNO) = IDNO then begin
      Result := False;
      Exit;
    end;
  end;

  Result := True;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  EnvFile: String;
begin
  if CurStep = ssPostInstall then begin
    // Cria .env a partir do exemplo somente se nao existir (preserva em upgrades)
    EnvFile := ExpandConstant('{app}\backend\.env');
    if not FileExists(EnvFile) then
      FileCopy(ExpandConstant('{app}\backend\.env.example'), EnvFile, False);
  end;
end;

function UpdateReadyMemo(Space, NewLine, MemoUserInfoInfo, MemoDirInfo,
  MemoTypeInfo, MemoComponentsInfo, MemoGroupInfo, MemoTasksInfo: String): String;
begin
  Result :=
    MemoDirInfo + NewLine + NewLine +
    'Apos a instalacao, acesse:' + NewLine +
    Space + 'Checklist: http://localhost:3000' + NewLine +
    Space + 'Kanban:    http://localhost:3000/?kanban' + NewLine + NewLine +
    'O servidor inicia automaticamente com o Windows.' + NewLine + NewLine +
    MemoTasksInfo;
end;

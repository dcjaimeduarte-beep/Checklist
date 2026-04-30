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
#define AppPublisher "Seven Sistemas de Automação"
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
InternalCompressLevel=ultra64

; Requer administrador (firewall + PM2)
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=dialog

WizardStyle=modern
WizardSizePercent=120
DisableWelcomePage=no

; Windows 7 ou superior
MinVersion=6.1

; ── Idioma ────────────────────────────────────────────────────────────────────

[Languages]
Name: "ptbr"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

; ── Mensagens customizadas ────────────────────────────────────────────────────

[CustomMessages]
ptbr.WelcomeLabel2=Este assistente irá guiar a instalação do [name/ver] no seu computador.%n%nO sistema inclui:%n  • Checklist de Vistoria Veicular%n  • Painel Kanban da Oficina%n%nRecomenda-se fechar outros programas antes de continuar.
ptbr.NodeNotFound=Node.js não foi encontrado neste computador.%n%nÉ necessário instalar o Node.js 20 LTS antes de continuar.%n%nDeseja abrir o site de download agora?
ptbr.InstallDeps=Instalando dependências do sistema...
ptbr.InstallPM2=Instalando gerenciador de processos (PM2)...
ptbr.ConfigAutostart=Configurando inicialização automática com o Windows...
ptbr.StartServer=Iniciando servidor Checklist Seven...
ptbr.ConfigFirewall=Configurando firewall (porta 3000)...
ptbr.UpgradeDetected=Uma versão anterior do Checklist Seven foi detectada.%n%nSeus dados (configurações, vistorias e fotos) serão preservados.%n%nDeseja continuar a atualização?

; ── Tarefas opcionais ─────────────────────────────────────────────────────────

[Tasks]
Name: desktopicon; Description: "Criar atalho na Área de Trabalho"; GroupDescription: "Atalhos adicionais:"; Flags: unchecked
Name: openkanban;  Description: "Abrir o Kanban da Oficina ao finalizar"; GroupDescription: "Ao concluir:"

; ── Arquivos ──────────────────────────────────────────────────────────────────

[Files]
; Código backend (Node.js)
Source: "{#SrcDir}\backend\src\*"; DestDir: "{app}\backend\src"; Flags: ignoreversion recursesubdirs createallsubdirs
; Frontend compilado (React)
Source: "{#SrcDir}\backend\public\*"; DestDir: "{app}\backend\public"; Flags: ignoreversion recursesubdirs createallsubdirs
; Configuração do servidor
Source: "{#SrcDir}\backend\package.json"; DestDir: "{app}\backend"; Flags: ignoreversion
Source: "{#SrcDir}\backend\ecosystem.config.js"; DestDir: "{app}\backend"; Flags: ignoreversion
; Template de variáveis de ambiente (o .env real é criado em [Code])
Source: "{#SrcDir}\backend\.env.example"; DestDir: "{app}\backend"; Flags: ignoreversion

; ── Pastas de dados (criadas vazias) ─────────────────────────────────────────

[Dirs]
Name: "{app}\backend\data"
Name: "{app}\backend\uploads"
Name: "{app}\backend\logs"

; ── Ícones do Menu Iniciar ────────────────────────────────────────────────────

[Icons]
Name: "{group}\Abrir Checklist"; Filename: "{app}\Abrir Checklist.url"; Comment: "Abre o sistema de checklist no navegador"
Name: "{group}\Abrir Kanban da Oficina"; Filename: "{app}\Abrir Kanban.url"; Comment: "Abre o painel Kanban da oficina no navegador"
Name: "{group}\Reiniciar Servidor"; Filename: "{app}\reiniciar.bat"; WorkingDir: "{app}"; Comment: "Reinicia o servidor Checklist Seven"
Name: "{group}\Editar Configurações (.env)"; Filename: "{app}\backend\.env"; Comment: "Edita o arquivo de configuração"
Name: "{group}\Ver Logs do Servidor"; Filename: "{app}\backend\logs"; Comment: "Abre a pasta de logs"
Name: "{group}\Desinstalar {#AppName}"; Filename: "{uninstallexe}"
; Área de Trabalho (opcional)
Name: "{commondesktop}\Checklist Seven"; Filename: "{app}\Abrir Checklist.url"; Comment: "Abre o Checklist Seven no navegador"; Tasks: desktopicon

; ── Execução pós-instalação ───────────────────────────────────────────────────

[Run]

; 1. Instalar dependências Node.js
Filename: "{cmd}"; Parameters: "/c npm install --omit=dev"; WorkingDir: "{app}\backend"; StatusMsg: "{cm:InstallDeps}"; Flags: runhidden waituntilterminated

; 2. Instalar PM2 e pm2-windows-startup globalmente
Filename: "{cmd}"; Parameters: "/c npm install -g pm2 pm2-windows-startup"; StatusMsg: "{cm:InstallPM2}"; Flags: runhidden waituntilterminated

; 3. Registrar PM2 para iniciar com o Windows
Filename: "{cmd}"; Parameters: "/c pm2-startup install"; StatusMsg: "{cm:ConfigAutostart}"; Flags: runhidden waituntilterminated

; 4. Parar processo anterior (upgrade), iniciar e salvar
Filename: "{cmd}"; Parameters: "/c pm2 delete checklist-seven 2>nul & pm2 start ecosystem.config.js & pm2 save"; WorkingDir: "{app}\backend"; StatusMsg: "{cm:StartServer}"; Flags: runhidden waituntilterminated

; 5. Criar regra de firewall para a porta 3000
Filename: "netsh"; Parameters: "advfirewall firewall add rule name=""Checklist Seven"" dir=in action=allow protocol=TCP localport=3000 enable=yes"; StatusMsg: "{cm:ConfigFirewall}"; Flags: runhidden waituntilterminated

; 6. Abrir o sistema no navegador ao finalizar
Filename: "{app}\Abrir Checklist.url"; Flags: shellexec skipifsilent nowait
Filename: "{app}\Abrir Kanban.url"; Flags: shellexec skipifsilent nowait; Tasks: openkanban

; ── Execução na desinstalação ─────────────────────────────────────────────────

[UninstallRun]
; Para e remove o processo PM2
Filename: "{cmd}"; Parameters: "/c pm2 stop checklist-seven & pm2 delete checklist-seven & pm2 save"; Flags: runhidden waituntilterminated; RunOnceId: "pm2stop"
; Remove regra de firewall
Filename: "netsh"; Parameters: "advfirewall firewall delete rule name=""Checklist Seven"""; Flags: runhidden waituntilterminated; RunOnceId: "fwremove"

; ── Mensagens na desinstalação ────────────────────────────────────────────────

[UninstallDelete]
; Remove atalhos URL e bat criados pelo [Code]
Type: files; Name: "{app}\Abrir Checklist.url"
Type: files; Name: "{app}\Abrir Kanban.url"
Type: files; Name: "{app}\reiniciar.bat"

; ── Lógica Pascal ─────────────────────────────────────────────────────────────

[Code]

// ─── Verifica se Node.js está instalado ───────────────────────────────────────
function NodeInstalled(): Boolean;
var
  ResultCode: Integer;
begin
  Result := Exec(ExpandConstant('{cmd}'), '/c node --version >nul 2>&1',
                 '', SW_HIDE, ewWaitUntilTerminated, ResultCode)
            and (ResultCode = 0);
end;

// ─── Verifica se é uma atualização (versão anterior instalada) ────────────────
function IsUpgrade(): Boolean;
begin
  Result := RegKeyExists(HKLM, 'Software\Microsoft\Windows\CurrentVersion\Uninstall\{#AppGUID}_is1')
         or RegKeyExists(HKCU, 'Software\Microsoft\Windows\CurrentVersion\Uninstall\{#AppGUID}_is1');
end;

// ─── Antes de começar: verifica Node.js e pergunta sobre upgrade ──────────────
function InitializeSetup(): Boolean;
var
  ResultCode: Integer;
begin
  // Verifica Node.js
  if not NodeInstalled() then begin
    if MsgBox(CustomMessage('NodeNotFound'), mbError, MB_YESNO) = IDYES then
      ShellExec('open', 'https://nodejs.org', '', '', SW_SHOW, ewNoWait, ResultCode);
    Result := False;
    Exit;
  end;

  // Avisa sobre upgrade e preservação de dados
  if IsUpgrade() then begin
    if MsgBox(CustomMessage('UpgradeDetected'), mbConfirmation, MB_YESNO) = IDNO then begin
      Result := False;
      Exit;
    end;
  end;

  Result := True;
end;

// ─── Após instalar arquivos: cria .env e atalhos URL/bat ──────────────────────
procedure CurStepChanged(CurStep: TSetupStep);
var
  FilePath, Content: String;
begin
  if CurStep = ssPostInstall then begin

    // .env — cria a partir do exemplo SOMENTE se não existir (preserva em upgrades)
    FilePath := ExpandConstant('{app}\backend\.env');
    if not FileExists(FilePath) then begin
      if LoadStringFromFile(ExpandConstant('{app}\backend\.env.example'), Content) then
        SaveStringToFile(FilePath, Content, False);
    end;

    // Atalho URL — Checklist
    FilePath := ExpandConstant('{app}\Abrir Checklist.url');
    SaveStringToFile(FilePath,
      '[InternetShortcut]' + #13#10 +
      'URL=http://localhost:3000' + #13#10,
      False);

    // Atalho URL — Kanban
    FilePath := ExpandConstant('{app}\Abrir Kanban.url');
    SaveStringToFile(FilePath,
      '[InternetShortcut]' + #13#10 +
      'URL=http://localhost:3000/?kanban' + #13#10,
      False);

    // reiniciar.bat
    FilePath := ExpandConstant('{app}\reiniciar.bat');
    SaveStringToFile(FilePath,
      '@echo off' + #13#10 +
      'chcp 65001 > nul' + #13#10 +
      'title Checklist Seven - Reiniciar' + #13#10 +
      'echo Reiniciando Checklist Seven...' + #13#10 +
      'pm2 restart checklist-seven' + #13#10 +
      'pm2 status' + #13#10 +
      'echo.' + #13#10 +
      'pause' + #13#10,
      False);

  end;
end;

// ─── Página extra: exibe o IP local ao finalizar ──────────────────────────────
function GetLocalIP(): String;
var
  TmpFile, Content: String;
  ResultCode: Integer;
begin
  TmpFile := ExpandConstant('{tmp}\localip.txt');
  Exec(ExpandConstant('{cmd}'),
       '/c for /f "tokens=2 delims=:" %a in (''ipconfig ^| findstr IPv4'') do @echo %a > "' + TmpFile + '" & goto :done & :done',
       '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  if LoadStringFromFile(TmpFile, Content) then
    Result := Trim(Content)
  else
    Result := 'SEU_IP';
end;

procedure DeinitializeSetup();
begin
  // Nada — limpeza automática pelo Inno Setup
end;

// ─── Mensagem de conclusão personalizada ─────────────────────────────────────
function UpdateReadyMemo(Space, NewLine, MemoUserInfoInfo, MemoDirInfo,
  MemoTypeInfo, MemoComponentsInfo, MemoGroupInfo, MemoTasksInfo: String): String;
begin
  Result :=
    MemoDirInfo + NewLine + NewLine +
    'Após a instalação, acesse:' + NewLine +
    Space + 'Checklist: http://localhost:3000' + NewLine +
    Space + 'Kanban:    http://localhost:3000/?kanban' + NewLine + NewLine +
    'O servidor inicia automaticamente com o Windows.' + NewLine + NewLine +
    MemoTasksInfo;
end;

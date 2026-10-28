#ifndef PayloadDir
  #error PayloadDir is required. Use Build-WindowsInstaller.ps1.
#endif
#ifndef ReleaseVersion
  #define ReleaseVersion "0.3.5"
#endif
#ifndef OutputPath
  #define OutputPath "output"
#endif

[Setup]
AppId={{3F10430E-8241-40E0-B358-C8E0393D06C9}
AppName=AlGym
AppVersion={#ReleaseVersion}
AppPublisher=AlGym
DefaultDirName={autopf}\AlGym
DefaultGroupName=AlGym
DisableProgramGroupPage=yes
DisableDirPage=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
; Windows 10 22H2 (build 19045) and newer, including Windows 11.
MinVersion=10.0.19045
OutputDir={#OutputPath}
OutputBaseFilename=AlGym-Setup-{#ReleaseVersion}-win-x64
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
SetupLogging=yes
CloseApplications=no
UninstallDisplayName=AlGym

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Tasks]
Name: "desktopicon"; Description: "Crear acceso directo de AlGym en el escritorio"; Flags: checkedonce
Name: "autostart"; Description: "Abrir AlGym al iniciar sesión en Windows"; Flags: checkedonce

[Files]
Source: "{#PayloadDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#PayloadDir}\tools\Prepare-Upgrade.ps1"; Flags: dontcopy
Source: "{#PayloadDir}\tools\Common.ps1"; Flags: dontcopy
Source: "{#PayloadDir}\tools\Backup-AlGym.ps1"; Flags: dontcopy

[Icons]
Name: "{autodesktop}\AlGym"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\tools\Open-AlGym.ps1"""; WorkingDir: "{app}"; Tasks: desktopicon
Name: "{group}\AlGym"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\tools\Open-AlGym.ps1"""; WorkingDir: "{app}"
Name: "{commonstartup}\AlGym"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\tools\Open-AlGym.ps1"""; WorkingDir: "{app}"; Tasks: autostart
Name: "{group}\Configurar reloj biométrico"; Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -STA -WindowStyle Hidden -File ""{app}\tools\Configure-Clock.ps1"" -AppRoot ""{app}"" -DataRoot ""{commonappdata}\AlGym"""


[Run]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""{app}\tools\Open-AlGym.ps1"""; Description: "Abrir AlGym"; Flags: postinstall nowait skipifsilent runasoriginaluser


[InstallDelete]
Type: files; Name: "{group}\Importar datos de Hostinger.lnk"

[UninstallDelete]
Type: filesandordirs; Name: "{app}\services"

[Code]
function RunTool(Script: String): Boolean;
var Code: Integer;
begin
  Result := Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'),
    '-NoProfile -ExecutionPolicy Bypass -STA -File "' + ExpandConstant('{app}\tools\') + Script +
    '" -AppRoot "' + ExpandConstant('{app}') + '" -DataRoot "' + ExpandConstant('{commonappdata}\AlGym') + '"',
    ExpandConstant('{app}'), SW_SHOWNORMAL, ewWaitUntilTerminated, Code);
  Result := Result and (Code = 0);
end;

function InitializeSetup(): Boolean;
begin
  Result := not WizardSilent;
  if not Result then MsgBox('Esta versión requiere instalación interactiva para preparar la cuenta propietaria.', mbError, MB_OK);
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
var Code: Integer;
begin
  Result := '';
  if FileExists(ExpandConstant('{app}\tools\Prepare-Upgrade.ps1')) then begin
    ExtractTemporaryFile('Prepare-Upgrade.ps1');
    ExtractTemporaryFile('Common.ps1');
    ExtractTemporaryFile('Backup-AlGym.ps1');
    if not Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'),
      '-NoProfile -ExecutionPolicy Bypass -File "' + ExpandConstant('{tmp}\Prepare-Upgrade.ps1') +
      '" -AppRoot "' + ExpandConstant('{app}') + '" -DataRoot "' + ExpandConstant('{commonappdata}\AlGym') + '"',
      ExpandConstant('{tmp}'), SW_HIDE, ewWaitUntilTerminated, Code) then
      Result := 'No se pudo preparar el respaldo y detener los servicios. No se actualizaron los archivos.';
    if Code <> 0 then Result := 'Falló el respaldo previo. No se actualizaron los archivos; revise los servicios y el respaldo.';
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var Code: Integer;
begin
  if CurStep = ssPostInstall then begin
    if not Exec(ExpandConstant('{app}\runtime\vc_redist.x64.exe'), '/install /quiet /norestart', '', SW_HIDE, ewWaitUntilTerminated, Code) then
      RaiseException('No se pudo iniciar Microsoft Visual C++.');
    if (Code <> 0) and (Code <> 3010) and (Code <> 1638) then
      RaiseException('No se pudo instalar Microsoft Visual C++. Código: ' + IntToStr(Code));
    if not RunTool('Install-AlGym.ps1') then
      RaiseException('La configuración de AlGym no terminó. Los datos se conservaron; vuelva a ejecutar el instalador.');
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usUninstall then
    if not RunTool('Uninstall-AlGym.ps1') then
      RaiseException('No se pudieron retirar los servicios. No se borrarán los archivos del programa.');
end;

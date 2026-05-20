!include "LogicLib.nsh"

!macro customInstall
  CreateDirectory "$COMMONAPPDATA\AllGym"
  CreateDirectory "$COMMONAPPDATA\AllGym\config"
  CreateDirectory "$COMMONAPPDATA\AllGym\logs"
  CreateDirectory "$COMMONAPPDATA\AllGym\data"
  CreateDirectory "$COMMONAPPDATA\AllGym\uploads"
  CreateDirectory "$COMMONAPPDATA\AllGym\backups"

  IfFileExists "$COMMONAPPDATA\AllGym\config\api-local.env" +2 0
    CopyFiles /SILENT "$INSTDIR\templates\api-local.env.example" "$COMMONAPPDATA\AllGym\config\api-local.env"

  DetailPrint "Installing allgym-api-local WinSW service"
  nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\scripts\install-allgym-api-local.ps1"'
  Pop $0
  ${If} $0 != 0
    MessageBox MB_ICONSTOP "Failed to install All Gym API Local service. Check C:\ProgramData\AllGym\logs\installer.log"
    Abort
  ${EndIf}
!macroend

!macro customUnInstall
  DetailPrint "Uninstalling allgym-api-local WinSW service"
  nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\scripts\uninstall-allgym-api-local.ps1"'
  Pop $0
!macroend

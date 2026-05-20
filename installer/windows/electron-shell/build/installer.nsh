!include "LogicLib.nsh"

!macro customInstall
  ReadEnvStr $0 "ProgramData"
  StrCmp $0 "" 0 +2
  StrCpy $0 "C:\ProgramData"

  CreateDirectory "$0\AllGym"
  CreateDirectory "$0\AllGym\config"
  CreateDirectory "$0\AllGym\logs"
  CreateDirectory "$0\AllGym\data"
  CreateDirectory "$0\AllGym\uploads"
  CreateDirectory "$0\AllGym\backups"

  IfFileExists "$0\AllGym\config\api-local.env" +2 0
    CopyFiles /SILENT "$INSTDIR\templates\api-local.env.example" "$0\AllGym\config\api-local.env"

  DetailPrint "Installing allgym-api-local WinSW service"
  nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\scripts\install-allgym-api-local.ps1"'
  Pop $1
  ${If} $1 != 0
    MessageBox MB_ICONSTOP "Failed to install All Gym API Local service. Check C:\ProgramData\AllGym\logs\installer.log"
    Abort
  ${EndIf}
!macroend

!macro customUnInstall
  DetailPrint "Uninstalling allgym-api-local WinSW service"
  nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\scripts\uninstall-allgym-api-local.ps1"'
  Pop $1
!macroend

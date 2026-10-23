@echo off
setlocal
chcp 65001 >nul
title AlGym - Descargar datos de Hostinger
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Herramientas-Hostinger\Descargar-Hostinger.ps1"
if errorlevel 1 (
  echo.
  echo No se completo la descarga. Revisa el mensaje anterior.
  pause
)
endlocal

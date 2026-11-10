@echo off
setlocal
cd /d "%~dp0"
set "OUT_DIR=Programa Ejecutable"
set "TMP_DIR=ProgramaEjecutable_temp_%RANDOM%_%RANDOM%"

echo =======================================
echo Building FincaControl Electron executable...
echo =======================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-progress.ps1" -OutDir "%OUT_DIR%" -TempDir "%TMP_DIR%"
set "BUILD_EXIT=%ERRORLEVEL%"

if "%BUILD_EXIT%"=="0" (
  echo.
  echo Build completed successfully.
  echo Output folder: "%~dp0%OUT_DIR%"
  echo Installer folder: "%~dp0%OUT_DIR%\Instalador"
  echo Portable executable folder: "%~dp0%OUT_DIR%\Portable"
) else (
  echo.
  echo Build failed. Review the messages above before exiting.
)

echo.
choice /C S /N /M "Opcion: S) Salir "
exit /b %BUILD_EXIT%

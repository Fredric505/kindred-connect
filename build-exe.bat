@echo off
REM ============================================================
REM  iPhone Diagnostics - Compilador automatico para Windows
REM ============================================================
REM  Requisitos previos:
REM   1) Node.js 20+ instalado  (https://nodejs.org)
REM   2) iTunes o "Apple Devices" instalado  (driver USB del iPhone)
REM ============================================================

echo.
echo [1/4] Instalando dependencias (puede tardar 2-3 minutos)...
call npm install
if errorlevel 1 goto error

echo.
echo [2/4] Compilando la interfaz web...
call npm run build
if errorlevel 1 goto error

echo.
echo [3/4] Empaquetando el .exe con Electron...
call npx @electron/packager . "iPhoneDiagnostics" --platform=win32 --arch=x64 --out=release --overwrite --ignore="^/src" --ignore="^/public" --ignore="^/release"
if errorlevel 1 goto error

echo.
echo [4/4] LISTO!
echo.
echo  El ejecutable esta en:
echo    release\iPhoneDiagnostics-win32-x64\iPhoneDiagnostics.exe
echo.
echo  Conecta el iPhone, acepta "Confiar en este PC" y abre el .exe.
echo.
pause
exit /b 0

:error
echo.
echo ERROR durante la compilacion. Revisa el mensaje de arriba.
pause
exit /b 1

@echo off
REM ============================================================
REM  iPhone Diagnostics - Compilador automatico para Windows
REM ============================================================
REM  Requisitos previos:
REM   1) Node.js 20+ instalado  (https://nodejs.org)
REM   2) iTunes o "Apple Devices" instalado  (driver USB del iPhone)
REM ============================================================

echo.
echo [1/4] Instalando dependencias (2-3 minutos la primera vez)...
call npm install
if errorlevel 1 goto error

echo.
echo [2/4] Compilando la interfaz (SPA para Electron)...
call npx vite build --config electron-app/vite.config.ts
if errorlevel 1 goto error

echo.
echo [3/4] Generando el .exe con Electron...
call npx @electron/packager . "iPhoneDiagnostics" --platform=win32 --arch=x64 --out=release --overwrite --ignore="^/src$" --ignore="^/src/" --ignore="^/public$" --ignore="^/public/" --ignore="^/electron-app" --ignore="^/release" --ignore="^/dist$" --ignore="^/dist/" --ignore="^/\.git" --ignore="^/tsconfig" --ignore="^/eslint" --ignore="^/vite\.config"
if errorlevel 1 goto error

echo.
echo [4/4] LISTO!
echo.
echo  Version portable en:
echo    release\iPhoneDiagnostics-win32-x64\iPhoneDiagnostics.exe
echo.
echo  Para generar un INSTALADOR (.exe con setup), ejecuta:
echo    build-installer.bat
echo.
pause
exit /b 0

:error
echo.
echo ERROR durante la compilacion. Revisa el mensaje de arriba.
pause
exit /b 1

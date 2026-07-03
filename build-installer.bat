@echo off
REM ============================================================
REM  Generar INSTALADOR (Setup.exe) con electron-builder + NSIS
REM ============================================================
REM  Usa la carpeta portable ya generada por build-exe.bat
REM  Produce: release-installer\iPhoneDiagnostics Setup X.X.X.exe
REM ============================================================

if not exist "dist-electron\index.html" (
    echo.
    echo Primero debes ejecutar build-exe.bat para compilar la SPA.
    pause
    exit /b 1
)

echo.
echo [1/2] Instalando electron-builder...
call npm install --save-dev electron-builder
if errorlevel 1 goto error

echo.
echo [2/2] Creando instalador NSIS...
call npx electron-builder --win nsis --x64 --config electron-builder.json
if errorlevel 1 goto error

echo.
echo LISTO! Instalador en:  release-installer\
echo.
pause
exit /b 0

:error
echo.
echo ERROR generando el instalador.
pause
exit /b 1

# Construir el .exe (Windows) y .app (macOS)

Este proyecto se puede empaquetar como aplicación de escritorio con Electron
para leer el iPhone por USB usando **libimobiledevice**.

## Estado actual

- ✅ Puente IPC React ↔ Node (`electron/main.cjs`, `electron/preload.cjs`)
- ✅ Página `/diagnostico` que consume el puente
- ✅ `vite.config.ts` con `base: "./"` para cargar bajo `file://`
- ⏳ Binarios `libimobiledevice` para Windows/macOS (descargar antes de empaquetar)

## 1. Instalar dependencias de Electron

```bash
bun add -d electron @electron/packager
```

Después añade estos scripts a `package.json` (no los añado automáticamente
para no chocar con builds del preview):

```json
{
  "main": "electron/main.cjs",
  "scripts": {
    "electron:dev": "ELECTRON_START_URL=http://localhost:8080 electron .",
    "electron:build": "vite build && electron .",
    "electron:pack:win": "vite build && electron-packager . iPhoneDiag --platform=win32 --arch=x64 --out=electron-release --overwrite --extra-resource=libimobiledevice/win32-x64 --ignore='^/src' --ignore='^/public' --ignore='^/electron-release'",
    "electron:pack:mac": "vite build && electron-packager . iPhoneDiag --platform=darwin --arch=arm64 --out=electron-release --overwrite --extra-resource=libimobiledevice/darwin-arm64 --ignore='^/src' --ignore='^/public' --ignore='^/electron-release'"
  }
}
```

## 2. Bajar los binarios libimobiledevice

Estos son los que hablan con el iPhone por USB. Ponlos en la carpeta del OS:

### Windows

Descarga desde **imobiledevice-net** (build oficial mantenido):
https://github.com/libimobiledevice-win32/imobiledevice-net/releases

Extrae el zip a `libimobiledevice/win32-x64/` — necesitas estos ejecutables:
- `idevice_id.exe`
- `ideviceinfo.exe`
- `idevicediagnostics.exe`
- `ideviceinstaller.exe`
- `idevicesyslog.exe`
- todas las DLLs que vienen con ellos

**Importante:** el usuario final necesita **Apple Devices** (Microsoft Store)
o **iTunes** instalado para el driver USB. Sin eso, el iPhone no aparece.

### macOS

```bash
brew install libimobiledevice
# copiar binarios y dylibs a libimobiledevice/darwin-arm64/
```

## 3. Compilar

```bash
bun run electron:pack:win     # .exe en electron-release/iPhoneDiag-win32-x64/
bun run electron:pack:mac     # .app en electron-release/iPhoneDiag-darwin-arm64/
```

## 4. Probar en desarrollo sin empaquetar

Con el dev server corriendo:

```bash
IMD_BIN_DIR=/ruta/a/libimobiledevice bun run electron:dev
```

## Próximas fases

- **Fase 2**: historial de batería en SQLite local, detección de piezas no originales
  vía MobileGestalt, syslog en vivo.
- **Fase 3**: reporte PDF, comparativa con base de datos, modo técnico avanzado.

# Construir el .exe (Windows) y .app (macOS)

Todo el código de la app de escritorio ya está en el repo. Estos son los pasos
para generar el instalador en **tu propia máquina**.

## Por qué no puedo compilar el .exe desde el editor de Lovable

El sandbox de Lovable fuerza el build de Vite/Nitro al preset `cloudflare-module`
(Cloudflare Worker), que no es ejecutable dentro de Electron. En tu PC, sin ese
lock, el build usa el preset `node-server` y todo funciona.

Solución práctica: descarga el proyecto y ejecuta el packager localmente. La
compilación toma ~2 minutos y el resultado pesa ~200 MB.

## Requisitos en tu PC

- **Windows 10/11** (o macOS)
- **Node 20+** o **Bun**
- **Apple Devices** (Microsoft Store) o **iTunes** — proporciona el driver USB del iPhone
- Cable original Lightning / USB-C

## Pasos

```bash
# 1. Clonar o descargar el proyecto (ya incluye los binarios libimobiledevice/win32-x64)
git clone <tu-repo>
cd <proyecto>

# 2. Instalar dependencias
bun install    # o: npm install

# 3. Empaquetar
bun run electron:pack:win     # Windows → electron-release/iPhoneDiag-win32-x64/iPhoneDiag.exe
bun run electron:pack:mac     # macOS   → electron-release/iPhoneDiag-darwin-arm64/iPhoneDiag.app

# 4. Abrir la app
./electron-release/iPhoneDiag-win32-x64/iPhoneDiag.exe
```

**En Windows, Defender puede avisar** "editor desconocido" porque el `.exe` no
está firmado. Es normal para builds propios; pulsa "Más información → Ejecutar
de todos modos". Para eliminar el aviso definitivamente necesitas un
certificado de firma de código (~$100/año).

## Estructura de archivos ya generada

```
electron/
  main.cjs           # Proceso principal Electron + IPC handlers + syslog + historial
  preload.cjs        # Puente seguro al renderer (contextBridge)

libimobiledevice/
  win32-x64/         # 50 archivos: ideviceinfo.exe, idevicediagnostics.exe, DLLs…

src/
  lib/iphone-bridge.ts       # Tipos TS del bridge (window.iphoneBridge)
  routes/diagnostico.tsx     # Dashboard con score, batería, historial, syslog, PDF
```

## Funciones incluidas

| Sección | Datos leídos del iPhone |
|---|---|
| **Score global** | Cálculo ponderado sobre salud batería + ciclos + almacenamiento |
| **Identidad** | Nombre, modelo, iOS, build, nº serie, IMEI |
| **Batería** | Nivel actual, salud %, ciclos, capacidad diseño/actual, temperatura |
| **Almacenamiento** | Total, usado, libre, % ocupado |
| **Sistema y radios** | Región, modem, WiFi MAC, Bluetooth MAC, zona horaria, idioma |
| **Autenticidad de piezas** | Análisis de syslog para mensajes "Unknown Part" que iOS emite cuando detecta batería/pantalla no originales |
| **Historial** | Gráfico de salud y nivel de batería a lo largo del tiempo (JSON en `userData/`) |
| **Syslog en vivo** | Stream de logs del iPhone en tiempo real, con resaltado de errores |
| **Exportar PDF** | Informe completo descargable con fecha y todos los datos |

## Comprobar en desarrollo sin empaquetar

Con el dev server corriendo (`bun run dev`):

```bash
IMD_BIN_DIR=./libimobiledevice/win32-x64 bun run electron:dev
```

## Fase 3 (roadmap)

- Comparativa con base de datos comunitaria (¿mi batería está en el promedio?)
- Modo técnico avanzado: ~800 MobileGestalt keys crudos con búsqueda
- Backup y screenshots del iPhone desde la app
- Instalar/desinstalar `.ipa` (requiere firma Apple del usuario)

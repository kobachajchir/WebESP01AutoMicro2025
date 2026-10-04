# Actualización automática Web → ESP01

Desde la raíz del proyecto Web:

```powershell
npm run build
```

TypeScript/Vite generan el build, postbuild comprime index.html y después ejecuta automáticamente el script de copia. Se reemplaza **únicamente** `data/dist/index.html.gz` del proyecto ESP hermano y se elimina `data/dist/index.html` si existe. No se copia el HTML original. Vite puede conservar index.html en dist local, sin llevarlo al filesystem de ESP.

Los modelos, Draco y otros archivos de data se conservan. No se borra ni reemplaza data completo. El modelo final `public/models/auto_micro.glb` se copió por única vez a ESP al preparar este flujo; no se vuelve a copiar con cada build.

Si solo se desea copiar el gzip ya generado:

```powershell
npm run copy:esp
```

Otra ubicación ESP:

```powershell
npm run copy:esp -- --esp-dir "D:\ruta\FirmESP01MicroArduino2025"
```

`npm run build:esp` es un alias del build automático. El script resuelve rutas desde su ubicación, exige platformio.ini y un gzip no vacío, reemplaza el index usando un archivo temporal y falla con exit code distinto de cero si no puede copiar. Si build/compresión fallan, la copia no se ejecuta. No genera imagen LittleFS ni flashea la ESP: eso sigue siendo un paso separado de PlatformIO.

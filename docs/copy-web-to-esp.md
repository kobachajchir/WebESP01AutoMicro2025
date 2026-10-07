# Actualización automática Web → ESP01

Desde la raíz del proyecto Web:

```powershell
npm run build
```

TypeScript/Vite generan el build, postbuild comprime index.html y después ejecuta automáticamente el script de copia. Se reemplazan `data/dist/index.html.gz` y `data/dist/models/auto_micro.glb` del proyecto ESP hermano y se elimina `data/dist/index.html` si existe. No se copia el HTML original. Vite puede conservar index.html en dist local, sin llevarlo al filesystem de ESP.

El GLB vigente se toma de `public/models/auto_micro.glb` con cada copia, por lo que reemplazar ese asset actualiza tanto el modelo servido por la Web como el que se prepara para LittleFS. El script exige un archivo no vacío de menos de 900.000 bytes. Draco y los demás archivos de data se conservan; no se borra ni reemplaza data completo.

Desde el 2026-10-05 el asset corresponde a AutoMicro V2 embedded: **883.260 bytes**, **266.697 triángulos**, **681 piezas distintas**, 12 módulos de exportación y 8 materiales. Incluye los 16 cuerpos de acrílico con transmisión física. El modelo original y los `.blend` editables se conservan en la carpeta de exportación de Blender; no se copian a la flash.

Para copiar el gzip ya generado junto con el modelo vigente, sin compilar:

```powershell
npm run copy:esp
```

Otra ubicación ESP:

```powershell
npm run copy:esp -- --esp-dir "D:\ruta\FirmESP01MicroArduino2025"
```

`npm run build:esp` es un alias del build automático. El script resuelve rutas desde su ubicación, exige platformio.ini, un gzip no vacío y el GLB dentro del límite. Prepara ambos archivos temporales, publica primero el modelo y luego el index; cada reemplazo usa rename. Falla con exit code distinto de cero si no puede copiar. Si build/compresión fallan, la copia no se ejecuta. No genera imagen LittleFS ni flashea la ESP: eso sigue siendo un paso separado de PlatformIO.

La Web conserva la URL `/models/auto_micro.glb` y el firmware la sirve desde `/dist/models/auto_micro.glb`, con la política sin caché prolongada documentada en AMI-20261002-06. El decodificador Draco existente sigue siendo necesario.

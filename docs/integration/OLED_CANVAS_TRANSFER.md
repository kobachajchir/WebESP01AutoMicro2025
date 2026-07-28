# OLED Canvas: contrato Web -> ESP01 -> FirmwareF4

## Objetivo y autoridad

OLED Studio puede enviar el documento vivo completo al SSD1306 de la F4. No se crea un editor
alternativo: antes de enviar, la Web rasteriza todas las capas visibles del documento actual.

La F4 es la autoridad final. Una transferencia solo es valida con:

- WebSocket API v1 listo y `hello.features.oledCanvas=true`;
- sesion PIN F4 vigente;
- modo del auto `TEST`;
- pantalla actual `0x030503` (`Testeo > Pantalla > OLED Canvas`).

La Web consulta de nuevo `getCarMode` y `getCurrentScreen` al pulsar el boton. Los contextos
cacheados solo informan estado visual y nunca reemplazan ese preflight. Si falla, la recuperacion
visible es: `En la F4 entra a Testeo > Pantalla > OLED Canvas`.

`Mostrada con exito` significa que la respuesta final de F4 confirmo los 1024 bytes, el CRC y que
las ocho paginas terminaron por I2C/DMA. No significa que la Web haya comprobado opticamente el OLED.

## Framebuffer y CRC

El rasterizador puro recorre `zOrder`, omite capas `hidden` y `overlay`, recorta a 128x64 y compone
fondo, fills, strokes, texto bitmap, imagenes y capas de pintura. No lee el canvas DOM del editor.

```text
index = x + 128 * floor(y / 8)
mask  = 1 << (y % 8)
1     = pixel encendido
```

El resultado siempre tiene 1024 bytes y formato `ssd1306-page-lsb`. Se calcula CRC-32/ISO-HDLC:
polinomio reflejado `0xEDB88320`, init/xorout `0xFFFFFFFF`; el vector `123456789` produce
`CBF43926`.

## API WebSocket JSON

El transporte continua siendo JSON texto. El framebuffer se divide en dos bloques Base64 de 512
bytes para mantener cada request serializado por debajo de `WS_JSON_MAX=1024`.

```json
{
  "command": "oledCanvas.begin",
  "args": {
    "width": 128,
    "height": 64,
    "format": "ssd1306-page-lsb",
    "totalBytes": 1024,
    "crc32": "A1B2C3D4"
  }
}
```

Respuesta esperada: `{ "transferId": 42, "chunkBytes": 512, "nextOffset": 0 }`.
El `transferId` es un `u16` generado por ESP y se conserva en toda la secuencia.

```json
{
  "command": "oledCanvas.chunk",
  "args": { "transferId": 42, "offset": 0, "dataBase64": "..." }
}
```

Los offsets canonicos son `0` y `512`. Cada respuesta debe devolver el mismo `transferId` y
`nextOffset` igual a `512` o `1024`.

```json
{
  "command": "oledCanvas.commit",
  "args": { "transferId": 42 }
}
```

La respuesta final valida es:

```json
{
  "transferId": 42,
  "state": "rendered",
  "bytes": 1024,
  "crc32": "A1B2C3D4",
  "screenCode": 197891
}
```

`197891` es la representacion decimal de `0x030503`. Cualquier diferencia de ID, bytes, CRC,
estado o screenCode se trata como fallo y nunca como render exitoso.

`oledCanvas.cancel` recibe `{ "transferId": 42 }`. La Web lo envia al cancelar manualmente, ante
un cambio de conexion/sesion/modo/pantalla y como limpieza best-effort despues de un error. Un
timeout de `commit` no se interpreta como exito tardio.

## Estados de UI y validacion

La UI expone estas fases: preparacion, `512/1024`, `1024/1024`, espera de F4 y confirmacion final.
Solo se admite una transferencia Web activa. El preview a enviar representa el documento vivo; el
preview `Ultima mostrada` es local al cliente iniciador y conserva exclusivamente el framebuffer que
recibio confirmacion final.

Pruebas automatizadas obligatorias:

- packing de `(0,0)`, `(127,7)`, `(0,8)` y `(127,63)`;
- negro, blanco, zOrder, borrado negro, clipping y capas omitidas;
- formas, texto con glifos OLED, imagen y bitmap;
- vector CRC canonico y Base64 con padding;
- dos chunks exactos y envelope maximo menor a 1024 caracteres;
- correlacion y rechazo de respuestas begin/chunk/commit inconsistentes.

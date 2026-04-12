# WebSocket events a paquetes UNER para STM

## Objetivo

La web debe poder pedir reinicios desde la configuracion principal. Para eso emite paquetes WebSocket JSON hacia la ESP, y la ESP actua como bridge: toma los bytes de `payload.data` y los despacha al enlace UNER/STM.

## Formato UNER v2 usado

El frame que viaja dentro de `payload.data` sigue este orden:

```text
HEADER "UNER" | LEN | TOKEN ":" | VERSION 0x02 | ROUTE | CMD | PAYLOAD | CHK
```

- `LEN` es la cantidad de bytes de payload.
- `ROUTE` empaqueta `src` y `dst`: `(src << 4) | dst`.
- Para los reinicios solicitados desde la web se usa `src=0x02`, `dst=0x01`, `route=0x21`, igual que los ejemplos de test manual ESP/PC -> STM.
- `CHK` es XOR desde el header hasta el ultimo byte de payload.

## Comandos de reinicio

| Accion en la web | Paquete WebSocket | CMD | Payload | Frame UNER |
| --- | --- | --- | --- | --- |
| Reiniciar ESP | `type=stmPacket`, `action=resetEsp`, `data=[85,78,69,82,0,58,2,33,22,3]` | `CMD_REBOOT_ESP = 0x16` | vacio | `55 4E 45 52 00 3A 02 21 16 03` |
| Reiniciar STM32 | `type=stmPacket`, `action=resetMcu`, `data=[85,78,69,82,0,58,2,33,25,12]` | `CMD_RESET_MCU = 0x19` | vacio | `55 4E 45 52 00 3A 02 21 19 0C` |

Nota: el flujo "STM -> ESP real" para `CMD_REBOOT_ESP` usa ruta `0x12` y frame `55 4E 45 52 00 3A 02 12 16 30`. Ese tramo corresponde al firmware/STM cuando decide reiniciar la ESP desde el lado del micro.

## Telemetria real desde Sensores/Visor

La pantalla Sensores/Visor tambien envia frames UNER v2 dentro de `stmPacket` para controlar el stream real de MPU6050:

| Accion en la web | CMD | Payload | Regla |
| --- | --- | --- | --- |
| Iniciar o actualizar tasa | `TELEMETRY_SET_RATE = 0x20` | `u16 LE periodMs` | `periodMs > 0` activa o actualiza el stream |
| Detener stream | `TELEMETRY_SET_RATE = 0x20` | `00 00` | `periodMs = 0` es finalizador explicito |
| ACK esperado | `TELEMETRY_ACK = 0x21` | `[code, periodMsLow, periodMsHigh]` | `code=0` indica OK |
| Datos esperados | `TELEMETRY_DATA = 0x22` | 17 bytes | `[schema, seqL, seqH, accXl, accXh, accYl, accYh, accZl, accZh, gyroXl, gyroXh, gyroYl, gyroYh, gyroZl, gyroZh, tempL, tempH]` |

Modos de captura:

- Temporizado: la web envia `0x20` con el periodo elegido y, al vencer la duracion, envia automaticamente `0x20` con payload `00 00`. La duracion maxima de la UI es `240s`.
- Constante: la web envia `0x20` con el periodo elegido y mantiene el stream activo hasta que el usuario presiona `Detener`; ahi envia `00 00`.
- Si cambia el periodo mientras el stream esta activo, la web reenvia `0x20` con el nuevo `u16 LE`.

Ejemplos:

- `200ms` por `2s`: payload inicial `C8 00`; al vencer, finalizador `00 00`.
- `500ms` constante: payload inicial `F4 01`; al detener, finalizador `00 00`.

Mas detalle: [telemetry-session-protocol.md](telemetry-session-protocol.md).

## Trabajo pendiente en firmware ESP

Si el firmware de la ESP recibe un `stmPacket`, tiene que validar `payload.data` y escribir esos bytes hacia la STM. Como minimo:

- `payload.action = resetEsp` -> `CMD_REBOOT_ESP = 0x16`, payload vacio, ruta `0x21`.
- `payload.action = resetMcu` -> `CMD_RESET_MCU = 0x19`, payload vacio, ruta `0x21`.
- Validar que el frame salga por el transporte UART/UNER hacia la STM.
- Responder o cerrar limpiamente el WebSocket si el reinicio corta el enlace.

## Prompt sugerido

```text
Amplia la capa del firmware ESP que recibe paquetes WebSocket de tipo stmPacket y los reenvia como bytes UNER hacia la STM. La web envia JSON, no binario crudo: para resetEsp llega {"type":"stmPacket","payload":{"action":"resetEsp","cmd":"CMD_REBOOT_ESP","data":[85,78,69,82,0,58,2,33,22,3]}} y para resetMcu llega {"type":"stmPacket","payload":{"action":"resetMcu","cmd":"CMD_RESET_MCU","data":[85,78,69,82,0,58,2,33,25,12]}}. Validar que data contenga un frame UNER v2 con src=0x02, dst=0x01, route=0x21 y checksum XOR antes de escribirlo al enlace STM. Mantene un builder/validador generico para payloads futuros, agrega logs claros, manejo de WebSocket desconectado durante reinicio y pruebas de LEN, ROUTE y CHK.
```

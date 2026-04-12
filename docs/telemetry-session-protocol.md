# Protocolo de telemetria en sesion

## Objetivo

La pantalla Sensores/Visor puede iniciar y detener un stream real de datos del MPU6050 usando frames UNER v2 enviados como `stmPacket` por WebSocket. La web controla la tasa de medicion y, cuando corresponde, envia un finalizador explicito.

## Comandos

| CMD | Nombre | Direccion | Payload |
| --- | --- | --- | --- |
| `0x20` | `TELEMETRY_SET_RATE` | Web -> firmware | `u16 LE periodMs`: `[periodMsLow][periodMsHigh]` |
| `0x21` | `TELEMETRY_ACK` | Firmware -> Web | `[code][periodMsLow][periodMsHigh]` |
| `0x22` | `TELEMETRY_DATA` | Firmware -> Web | 17 bytes de muestra MPU6050 |

## TELEMETRY_SET_RATE (0x20)

El payload siempre tiene 2 bytes little-endian:

```text
[periodMsLow][periodMsHigh]
```

Reglas:

- `periodMs > 0`: inicia el stream o actualiza su tasa si ya estaba activo.
- `periodMs = 0`: finalizador explicito para detener el stream. Payload: `00 00`.

La web usa dos modos:

- Temporizado: envia `TELEMETRY_SET_RATE(periodMs)` al iniciar, muestra los segundos restantes y cuando vence la duracion envia automaticamente `TELEMETRY_SET_RATE(0)` con payload `00 00`.
- Constante: envia `TELEMETRY_SET_RATE(periodMs)` al iniciar y mantiene el stream activo hasta que el usuario presiona `Detener`; en ese momento envia `TELEMETRY_SET_RATE(0)` con payload `00 00`.

Duracion temporizada:

- Minimo recomendado: `1s`.
- Maximo permitido en la web: `240s`.

Si el usuario cambia el periodo de medicion mientras la telemetria esta activa, la web reenvia `TELEMETRY_SET_RATE(periodMs)` con la nueva tasa.

## TELEMETRY_ACK (0x21)

Payload:

```text
[code][periodMsLow][periodMsHigh]
```

- `code = 0` indica OK.
- `periodMs` confirma el periodo aplicado por firmware.
- Si `periodMs = 0`, confirma que el stream quedo detenido.

## TELEMETRY_DATA (0x22)

Payload esperado: 17 bytes.

```text
[schema][seqL][seqH][accXl][accXh][accYl][accYh][accZl][accZh][gyroXl][gyroXh][gyroYl][gyroYh][gyroZl][gyroZh][tempL][tempH]
```

Campos:

- `schema`: version del esquema de datos. Para MPU6050 int16 se usa `0x01`.
- `seq`: contador `u16 LE`.
- `accX`, `accY`, `accZ`: acelerometro crudo `i16 LE`.
- `gyroX`, `gyroY`, `gyroZ`: giroscopio crudo `i16 LE`.
- `tempRaw`: temperatura cruda `i16 LE`.

La web muestra datos de prueba del stream:

- paquetes recibidos
- ultimo `seq`
- temperatura convertida si esta disponible
- segundos restantes en modo temporizado
- estado textual del stream
- ultimo frame enviado por la web

## Ejemplos

### 200ms por 2s

Inicio:

```text
CMD = 0x20
PAYLOAD = C8 00
```

Luego de 2s, la web envia el finalizador:

```text
CMD = 0x20
PAYLOAD = 00 00
```

### 500ms constante

Inicio:

```text
CMD = 0x20
PAYLOAD = F4 01
```

Al presionar `Detener`, la web envia el finalizador:

```text
CMD = 0x20
PAYLOAD = 00 00
```

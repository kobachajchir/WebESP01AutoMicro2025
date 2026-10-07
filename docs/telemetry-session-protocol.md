# Protocolo de telemetria MPU en sesion

## Objetivo

La pantalla `MPU + IR` controla el stream real del MPU que publica la STM por UNER v2. El contrato vigente es el de firmware:

- `GET_MPU_SNAPSHOT (0x60)`: lectura puntual.
- `SET_MPU_STREAM (0x61)`: iniciar o actualizar periodo.
- `STOP_MPU_STREAM (0x62)`: detener stream.
- `EVT_APP_GET_MPU_READINGS (0x90)`: muestra push de 42 bytes.

La web envia los comandos como `stmPacket` por WebSocket, con los bytes UNER v2 dentro de `payload.data`. La ruta usada por frames Web -> STM es `0x31` (`src=WEB_APP=0x3`, `dst=MCU=0x1`).

## Frecuencia

La UI normaliza el periodo de stream al rango `20..1000 ms`. Si el usuario carga un valor menor, la Web envía `20 ms`.

Desde la reforma de interfaz del 2026-10-05, **Gráfica en tiempo real** consume la orientación Euler recibida de muestras MPU reales válidas. El visor 3D conserva su pose relativa, offset y desacople manual; esos cambios no alteran la gráfica. Solo se agrega un punto cuando llega una muestra nueva, al ritmo visual configurado.

El desplegable empieza cerrado y solo puede abrirse con WebSocket conectado, fuera de mock y con sesión STM autenticada. Sin disponibilidad aparece **No conectada** debajo del botón bloqueado. Perder disponibilidad cierra el panel y limpia su historial; reconectar lo mantiene cerrado. Abrirlo o contraerlo no inicia ni detiene streams: se siguen controlando desde Flujo MPU en Control real. La simulación no alimenta esta gráfica y antes de una muestra real no se presentan ceros como lecturas.

## Comandos

| CMD | Nombre | Direccion | Payload |
| --- | --- | --- | --- |
| `0x60` | `GET_MPU_SNAPSHOT` | Web -> STM | vacio |
| `0x61` | `SET_MPU_STREAM` | Web -> STM | `[enable]` o `[enable, period_l, period_h]` |
| `0x62` | `STOP_MPU_STREAM` | Web -> STM | vacio |
| `0x90` | `EVT_APP_GET_MPU_READINGS` | STM -> Web | snapshot MPU de 42 bytes |

### Start / update

```text
CMD 0x61
payload: 01 period_l period_h
```

Ejemplo para `20 ms`:

```text
55 4E 45 52 03 3A 02 31 61 01 14 00 72
```

Respuesta esperada:

| Byte | Campo |
| ---: | --- |
| 0 | status |
| 1 | active |
| 2..3 | period_ms LE |

### Stop

La UI usa `STOP_MPU_STREAM (0x62)` para cortar la transmision.

```text
55 4E 45 52 00 3A 02 31 62 67
```

Respuesta esperada:

| Byte | Campo |
| ---: | --- |
| 0 | status |
| 1 | active |

`active=0` confirma que la STM dejo de transmitir hacia ese requester.

## Snapshot MPU de 42 bytes

`GET_MPU_SNAPSHOT (0x60)` y `EVT_APP_GET_MPU_READINGS (0x90)` comparten layout:

| Offset | Campo | Tipo | Unidad |
| ---: | --- | --- | --- |
| 0 | status | u8 | `0=OK`, `3=sin muestra valida` |
| 1 | flags | u8 | validez, calibración y estado del magnetómetro |
| 2 | sample_seq | u16 LE | contador |
| 4 | sample_dt_us | u16 LE | microsegundos |
| 6 | roll | f32 LE | grados |
| 10 | pitch | f32 LE | grados |
| 14 | yaw | f32 LE | grados, referencia magnética relativa |
| 18 | accel_x | f32 LE | g |
| 22 | accel_y | f32 LE | g |
| 26 | accel_z | f32 LE | g |
| 30 | gyro_x | f32 LE | grados/s |
| 34 | gyro_y | f32 LE | grados/s |
| 38 | gyro_z | f32 LE | grados/s |

El payload no incluye los tres ejes magnéticos crudos. La Web recibe la actitud
fusionada del MPU9250, aplica el cero local con cuaterniones y comparte el
resultado entre valores, gráfico y modelo 3D.


## Estados y flags

Status comunes:

| Status | Significado |
| ---: | --- |
| `0` | OK |
| `1` | BAD_PAYLOAD |
| `2` | SCREEN_MISMATCH |
| `3` | NO_VALID_SAMPLE |
| `4` | NO_PENDING_OR_BUSY |
| `5` | BAD_ARGUMENT |

Flags MPU:

| Bit | Mascara | Significado |
| ---: | ---: | --- |
| 0 | `0x01` | muestra válida |
| 1 | `0x02` | calibrado |
| 2 | `0x04` | magnetómetro AK8963 válido |
| 3 | `0x08` | estacionario |
| 4 | `0x10` | calibrando |
| 5 | `0x20` | error del sensor |

## Modos de captura de la UI

- Temporizado: envia `SET_MPU_STREAM`, muestra segundos restantes y al vencer envia `STOP_MPU_STREAM`.
- Constante: envia `SET_MPU_STREAM` y mantiene activo hasta que el usuario presiona `Detener`.
- Cambio de periodo activo: reenvia `SET_MPU_STREAM` con el nuevo periodo.
- Cambio a modo emulado, IR o desconexion WebSocket: la UI marca el stream como detenido; si todavia hay enlace activo, manda `STOP_MPU_STREAM`.

## No usar el contrato viejo

Queda obsoleto para MPU real:

- `TELEMETRY_SET_RATE = 0x20`
- `TELEMETRY_ACK = 0x21`
- `TELEMETRY_DATA = 0x22`
- payload de 17 bytes con temperatura cruda

Ese formato no coincide con la STM actual y no alimenta el Euler del visor 3D.

## Gráfica local y simulación MPU — 2026-10-05

La gráfica distingue fuente real y simulada. En modo real mantiene WebSocket,
sesión STM, Flujo MPU activo y muestra válida; solo agrega muestras nuevas.
Emulador MPU la habilita incluso sin conexión, la abre con estado Simulada y
muestrea su Euler local al intervalo elegido, incluyendo valores manuales o
fijos. Cambiar de fuente limpia el historial. La pose de cámara y el offset o
desacople del render no sustituyen las lecturas de la fuente seleccionada.

Las casillas Auto/Fijo por eje filtran las actualizaciones del generador local:
un eje desmarcado conserva su valor hasta ajuste manual. No deshabilitan sliders,
rotaciones rápidas ni Restablecer. El interruptor global Movimiento automático
sigue gobernando el generador; los tres ejes empiezan habilitados. Gráfica y
casillas no envían solicitudes ni cambian payloads, permisos o suscripciones.
Se conserva el flujo existente de entrada/salida de emulación. Implementado en
fuente sin tests, compilaciones ni validación por instrucción del usuario.

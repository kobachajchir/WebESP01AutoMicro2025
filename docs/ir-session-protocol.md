# Protocolo de telemetria IR en sesion

## Objetivo

La pantalla `MPU + IR` incorpora un stream IR independiente del stream MPU. El
cliente web demultiplexa por `cmd_id`, por lo que MPU e IR pueden publicar en
paralelo sin compartir estado.

## Comandos vigentes

```c
#define WIFI_BRIDGE_CMD_ID_GET_IR_SNAPSHOT   0x6Au
#define WIFI_BRIDGE_CMD_ID_SET_IR_STREAM     0x6Bu
#define WIFI_BRIDGE_CMD_ID_STOP_IR_STREAM    0x6Cu
#define WIFI_BRIDGE_EVT_ID_IR_STREAM         0x91u
```

Motivo: `0x60..0x69` ya estan usados para MPU, preferencias, telemetria, PID y
build info. `0x90` ya es `MPU_STREAM`, entonces `0x91` queda como evento natural
para `IR_STREAM`.

Estos comandos y el payload de 56 bytes ya estan implementados en `FirmwareF4`.
La Web debe tratarlos como contrato estable de la STM: una futura migracion del
transporte web puede cambiar WebSocket, el bridge ESP o el formato del sobre
externo, pero no debe reinterpretar ni modificar los bytes UNER internos.

## Frontera para cambiar el transporte web

La pantalla y las herramientas de calibracion deben depender de una sesion IR
con cuatro operaciones, no del WebSocket concreto:

```text
start(period_ms)
stop()
getSnapshot()
subscribe(snapshot => ...)
```

El adaptador actual implementa esas operaciones enviando frames UNER como
`stmPacket` por WebSocket. Otro adaptador futuro puede usar WebSerial, USB CDC o
un bridge distinto siempre que preserve:

- los CMD `0x6A`, `0x6B`, `0x6C` y el evento `0x91`;
- el payload IR de 56 bytes, little-endian;
- el orden fisico de `raw[8]` y `norm[8]`;
- la demultiplexacion independiente de MPU e IR;
- parada explicita y limpieza de la suscripcion al cerrar la sesion.

La calibracion, estadisticas, persistencia y localizacion trabajan sobre
`IrSnapshot` ya decodificado. No deben conocer el sobre WebSocket ni duplicar el
parser UNER.

## SET_IR_STREAM 0x6B

Request:

| Campo | Tipo | Nota |
| --- | --- | --- |
| enable | u8 | `0` stop, `1` start |
| period_ms | u16 LE | opcional, clamp UI `20..1000 ms` |

Response:

| Campo | Tipo | Nota |
| --- | --- | --- |
| status | u8 | `0 OK`, `1 payload invalido`, `2 transporte no permitido` |
| active | u8 | `0 detenido`, `1 activo` |
| period_ms | u16 LE | periodo aplicado |

`SET_IR_STREAM` con `enable=1` inicia o actualiza el periodo. Con `enable=0`
detiene. `STOP_IR_STREAM` existe como parada explicita.

## STOP_IR_STREAM 0x6C

Request: vacio.

Response:

| Campo | Tipo | Nota |
| --- | --- | --- |
| status | u8 | `0 OK` |

## GET_IR_SNAPSHOT 0x6A

Request: vacio.

Response: mismo payload que el evento `IR_STREAM 0x91`, pero enviado como
respuesta puntual. Permite pedir una muestra sin activar streaming.

## Evento IR_STREAM 0x91

Payload fijo, little-endian, 56 bytes:

| Offset | Campo | Tipo | Nota |
| ---: | --- | --- | --- |
| 0 | status | u8 | `0 OK` |
| 1 | flags | u8 | bit0 `ir_lights_on`, bit1 `follow_mode` |
| 2 | sample_seq | u16 LE | contador de publicaciones IR |
| 4 | period_ms | u16 LE | periodo configurado |
| 6 | tick_ms | u32 LE | `HAL_GetTick()` al publicar |
| 10 | raw[8] | u16 LE x8 | ADC raw en orden de `sensor_raw_data[]` |
| 26 | norm[8] | u16 LE x8 | valores normalizados para UI |
| 42 | line_pattern | u8 | left=`0x04`, center=`0x02`, right=`0x01` |
| 43 | line_alignment | u8 | `TCRT5000_ROUTE_*` |
| 44 | confidence | u8 | `0..100` |
| 45 | ambiguous | u8 | `0/1` |
| 46 | line_width_mm | u16 LE | ancho estimado de linea |
| 48 | lateral_error_mm | f32 LE | error lateral en mm |
| 52 | lateral_error_norm | f32 LE | error normalizado |

Orden de `raw[8]` y `norm[8]`:

| Index | Pin | Uso |
| ---: | --- | --- |
| 0 | PA1 | linea centro |
| 1 | PA2 | linea derecha |
| 2 | PB1 | objeto centro |
| 3 | PA0 | linea izquierda |
| 4 | PA4 | objeto izquierda-centro |
| 5 | PA5 | objeto derecha-centro |
| 6 | PA6 | objeto izquierda 45 |
| 7 | PA7 | objeto derecha 45 |

`raw[]` sale directo de `sensor_raw_data[]`. `norm[]` usa
`TCRT5000_NormalizeForDisplay()`: invierte los sensores pull-up de linea y deja
directos los pull-down de obstaculos.

## Modelo de runtime

El stream IR debe tener estado propio:

```c
typedef struct {
    uint8_t active;
    uint8_t transport_id;
    uint8_t dst_node;
    uint16_t period_ms;
    uint16_t sample_seq;
    uint32_t next_due_ms;
} UNER_IrStreamState;
```

Convivencia:

- MPU publica eventos `0x90`.
- IR publica eventos `0x91`.
- Cada stream tiene periodo, destino y contador propios.
- El ADC no se enciende ni se apaga con el stream: ya corre por DMA desde
  `APP_Init()`.
- El stream IR solo publica periodicamente la ultima muestra disponible.
- Las luces IR no se controlan desde `SET_IR_STREAM`; el payload solo reporta
  `ir_lights_on` leyendo `Luces_IR_Pin`.

## Visualizacion web

La UI usa escala visual `0..100 mm` para depuracion. La zona fisica util del
TCRT5000 queda marcada como rango cercano:

- optimo aproximado: `2.5 mm`;
- rango util tipico: `0.2..15 mm`;
- el resto hasta `100 mm` es ayuda visual para entender direccion y canal.

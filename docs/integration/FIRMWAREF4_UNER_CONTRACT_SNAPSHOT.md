# Snapshot de contrato FirmwareF4 para Web

- Fecha de corte: `2026-07-12`.
- Origen: repositorio `FirmwareF4`, archivo `Docs/integration_handoff_esp_web/F4_WIRE_CONTRACT.md`.
- Uso: referencia versionada de semántica y golden vectors. En producción la Web consume la API tipada del ESP y no construye libremente frames UART.

# Contrato vigente FirmwareF4 para servidor ESP y Web

Fecha de corte: 2026-07-12. Este documento describe lo que implementa el
firmware STM32F411CEU6 actual. No convierte constantes declaradas en funciones
implementadas.

## 1. Topologia y transporte

La F4 registra dos transportes UNER activos:

| Transporte | ID | Uso |
| --- | ---: | --- |
| `UART1_ESP` | 0 | F4 <-> servidor ESP |
| `USB_CDC` | 2 | F4 <-> aplicacion PC/Qt |

Rutas registradas:

| Nodo | ID | Transporte |
| --- | ---: | --- |
| `MCU` | `0x1` | nodo local F4 |
| `PC_QT` | `0x2` | USB CDC |
| `WEB_APP` | `0x3` | UART1 ESP |
| `REMOTE_NRF` | `0x4` | reservado |
| `WEB_CLIENT_0..7` | `0x5..0xC` | sesiones WebSocket via ESP |
| `BROADCAST` | `0xF` | eventos |

Rutas normales:

- ESP/broker -> F4: `src=0x3`, `dst=0x1`, byte route `0x31`.
- Web individual -> F4: `src=0x5..0xC`, `dst=0x1`.
- F4 -> Web individual: `src=0x1`, `dst` igual al nodo que solicito.
- Evento broadcast F4: `src=0x1`, `dst=0xF`, byte route `0x1F`.

El ESP preserva command/payload/checksum al diagnosticar raw, pero no permite
que el navegador elija libremente `src`: lo valida o sustituye por el nodo
asignado a esa conexion. Nunca permite suplantar otro WebSocket, MCU o Qt.

UART1 trabaja a `115200 8N1`, RX DMA circular de 512 bytes y TX DMA protegido
por un unico flag busy, sin una cola general de respuestas. El ESP debe
serializar globalmente las transacciones dirigidas a MCU; puede mantener una
cola de requests Web, pero solo una debe estar in-flight hacia F4. F4 reserva
una cola corta exclusivamente para responses/NACK de `0x51` y `0x5D`, de modo
que una continuacion o stream no pueda perder el resultado de autenticacion.

## 2. Frame UNER v2

```text
Offset  Bytes  Campo
0       4      ASCII "UNER" = 55 4E 45 52
4       1      payload_len N, 0..255
5       1      token ':' = 0x3A
6       1      version = 0x02
7       1      route = (src << 4) | dst
8       1      command/event ID
9       N      payload
9+N     1      checksum XOR
```

Longitud total: `10 + N`.

El checksum es XOR de todos los bytes desde offset 0 hasta el ultimo byte del
payload. El checksum recibido no se incluye en el calculo.

Requisitos del parser ESP:

- aceptar fragmentacion arbitraria entre lecturas UART;
- aceptar varios frames en una lectura;
- resincronizar buscando `UNER` despues de header/token/version/checksum
  invalido;
- no asumir alineacion de estructuras C;
- usar little-endian para enteros multibyte y `float32` IEEE-754;
- limitar memoria antes de reservar segun `payload_len`;
- conservar contadores de checksum, longitud, version, overflow y descarte.

## 3. ACK, NACK y estados

| ID | Nombre | Payload |
| ---: | --- | --- |
| `0xE0` | ACK | `[original_cmd, status]` normalmente |
| `0xE1` | NACK | `[original_cmd, status]` normalmente |

`status=5` significa transporte no soportado en el control local F4. Otros
status dependen del comando y se documentan por payload. No existe un enum de
status universal que permita interpretar el mismo numero igual para todo.

El ESP no debe fabricar ACK F4. Puede confirmar recepcion WebSocket mediante un
ACK JSON separado, pero la respuesta funcional debe provenir del destino real.
Un comando desconocido o con longitud invalida puede terminar descartado sin
NACK; el timeout del servidor es parte obligatoria del contrato.

## 4. Propiedad real de comandos

### 4.1 Handlers locales F4 confirmados

| ID | Nombre | Estado |
| ---: | --- | --- |
| `0x31` | `PING/ALIVE` | eco local por mismo transporte |
| `0x40` | `GET_PREFERENCES` | implementado |
| `0x41` | `REQUEST_FIRMWARE` | alias local solo por USB; por UART es respuesta ESP |
| `0x42` | `ECHO` | notificacion OLED; no devuelve eco de payload |
| `0x51` | `AUTH_VALIDATE_PIN` | valida PIN persistido, abre sesion o concede permiso local |
| `0x52` | `GET_CURRENT_SCREEN` | implementado |
| `0x53..0x58` | inputs UI remotos | implementados con validacion de screen code |
| `0x59` | `AUTH_PIN_GRANTED` | alias antiguo registrado solo para NACK deprecated |
| `0x5B` | `GET_CAR_MODE` | implementado |
| `0x5D` | `AUTH_REMOTE_RESULT` | logout/query de sesion remota |
| `0x5E..0x6C` | I2C, sensores, preferencias, PID, snapshots e info | implementados, excepto IDs explicitamente marcados abajo |

### 4.2 Servicios que el F4 espera del ESP

El F4 puede enviar por UART comandos WiFi/servidor como `0x10`, `0x11`, `0x12`,
`0x14`, `0x15`, `0x16`, `0x18`, `0x1A`, `0x30`, `0x41`, `0x48`, `0x49`, `0x4B`,
`0x4C` y `0x5A`, y recibir respuestas/eventos asociados. El dispatcher
ESP debe responder en la misma ruta invertida y conservar el command ID cuando
el contrato define response por el mismo ID.

La autenticacion remota es local de F4. ESP ya no debe responder `0x51` usando
su propio PIN: debe reenviar el PIN al STM y correlacionar la response.

### 4.3 Declarado pero no operativo en F4 actual

Estos IDs existen en headers, pero no tienen un flujo local completo registrado
y manejado en `uner_app.c`:

```text
0x13 CLEAR_CREDENTIALS
0x17 FACTORY_RESET
0x19 RESET_MCU
0x43 SET_ENCODER_FAST
0x44 GET_CONNECTED_USERS
0x45 GET_USER_INFO
0x46 GET_INTERFACES_CONNECTED
0x47 GET_CREDENTIALS
0x4A SET_AP_CONFIG
0x4D GET_CONNECTED_USERS_MODE
0x4E SET_AUTO_RECONNECT
```

El ESP y la Web deben publicar estas capacidades como no disponibles hasta que
exista implementacion y prueba extremo a extremo. `0x59` ya no aparece en esta
lista porque esta registrado, pero siempre responde NACK deprecated y nunca
concede un permiso.

### 4.4 Autenticacion y sesiones remotas

El contrato completo vive en
[remote_authentication.md](../remote_authentication.md). Resumen:

- PIN default/migracion `1234`, persistido en preferencias V5 y nunca expuesto
  por `0x40/0x63`;
- `0x51` usa scope 0 login (6 bytes), scope 1 permiso/pantalla (10 bytes) y
  scope 2 cambio de PIN (10 bytes);
- response `0x51` de 9 bytes:
  `[status,request_id,scope,granted,ttl_ms:u32,attempts_left]`;
- 3 intentos por nodo, bloqueo 60 s y sesion deslizante de 60 s;
- `0x5D [0]` hace logout y `0x5D [1]` consulta estado;
- `0x59` se rechaza porque F4 debe ver siempre el PIN;
- NACK status 7 indica sesion requerida y status 8 bloquea input remoto durante
  ingreso fisico de PIN; status 9 rechaza eventos ESP con origen distinto de
  `0x3`.

## 5. Contratos locales F4

### 5.1 `0x40 GET_PREFERENCES`

Request vacio: devuelve snapshot actual de 34 bytes.

| Offset | Tipo | Campo |
| ---: | --- | --- |
| 0 | u8 | status `0` |
| 1 | u8 | mode `0=snapshot` |
| 2 | u8 | descriptor_count |
| 3 | u32 | `APP_PREFS_FIELD_ALL` |
| 7 | u8 | encoder inverted |
| 8 | u8 | screen lock enabled |
| 9 | u16 | screen lock timeout seconds |
| 11 | u16 | left minimum PWM |
| 13 | u16 | right minimum PWM |
| 15 | u16 | system action timeout seconds |
| 17 | u16 | USB alive period ms |
| 19 | u16 | OLED rotation degrees |
| 21 | u8 | OLED auto rotation enabled |
| 22 | u8 | UNER router forwarding enabled |
| 23 | u16 | black line width mm |
| 25 | u8 | MPU calibration valid |
| 26 | u32 | preference record size bytes |
| 30 | u32 | preference record capacity |

Request `[index:u8]`: devuelve descriptor variable:

```text
status:u8, mode=1:u8, index:u8, descriptor_count:u8,
field_mask:u32, type:u8, min:u16, max:u16, step:u16, default:u16,
key_len:u8, key[key_len]
```

Tipos: `0=bool`, `1=u16`, `2=MPU calibration`.

### 5.2 `0x63 SET_PREFERENCES`

Request:

```text
field_mask:u32
values concatenados en orden de descriptor/bit ascendente
```

Bool ocupa 1 byte; u16 ocupa 2 bytes. La calibracion MPU (bit 6) no se acepta
por este comando.

Response de 5 bytes:

```text
status:u8, changed_mask:u32
```

Status: `0=OK`, `1=payload invalido`, `2=mask vacia`, `3=valor/aplicacion
invalida`, `4=calibracion MPU no permitida`.

### 5.3 Pantalla y UI remota

`0x52 GET_CURRENT_SCREEN`, response 5 bytes:

```text
screen_code:u32, source:u8
```

`0x53..0x56` request: `screen_code:u32` y opcional byte adicional.
`0x57..0x58` request: `screen_code:u32` exacto.

Response: ACK `0xE0 [original_cmd,status]`, donde `0=aceptado` y
`2=screen mismatch/payload insuficiente`.

Los comandos solo se ejecutan si `screen_code` coincide con la pantalla local
actual. El servidor debe serializar inputs por cliente para no mezclar acciones
contra pantallas distintas.

Eventos:

| ID | Payload |
| ---: | --- |
| `0x95 SCREEN_CHANGED` | `screen_code:u32, source:u8` |
| `0x96 MENU_SELECTION_CHANGED` | `screen_code:u32, selected:u8, count:u8, source:u8` |
| `0x97 CAR_MODE_CHANGED` | `mode:u8` |

Fuentes de pantalla: `0 unknown`, `1 menu`, `2 render`, `3 notification`,
`4 permission`, `5 system`.

### 5.4 `0x5B GET_CAR_MODE`

Response de 1 byte: `0=IDLE`, `1=FOLLOW`, `2=TEST`.

### 5.5 I2C policy

- `0x5E SET_I2C_POLICY`: request `[policy:u8]`, response
  `[status:u8,current_policy:u8]`.
- `0x5F GET_I2C_POLICY`: response `[status:u8,current_policy:u8]`.
- Policy esperada: `1 balanced`, `2 prioritize MPU`, `3 prioritize OLED`
  segun el enum compilado. El cliente debe mostrar el valor desconocido sin
  remapearlo si recibe otro.

### 5.6 Snapshot MPU `0x60` y evento `0x90`

Contrato vigente: 42 bytes, little-endian.

| Offset | Tipo | Unidad | Campo |
| ---: | --- | --- | --- |
| 0 | u8 | - | status: `0 OK`, `3 sin snapshot valido` |
| 1 | u8 | bits | bit0 muestra válida, bit1 calibrado, bit2 magnetómetro válido, bit3 estacionario, bit4 calibrando, bit5 error |
| 2 | u16 | - | sample sequence |
| 4 | u16 | us | sample dt |
| 6 | f32 | grados | roll |
| 10 | f32 | grados | pitch |
| 14 | f32 | grados | yaw magnético relativo |
| 18 | f32 | g | accel X |
| 22 | f32 | g | accel Y |
| 26 | f32 | g | accel Z |
| 30 | f32 | deg/s | gyro X |
| 34 | f32 | deg/s | gyro Y |
| 38 | f32 | deg/s | gyro Z |

No contiene `linear_accel` ni los ejes magnéticos crudos. Roll y pitch fusionan
acelerómetro y giroscopio; el yaw usa el AK8963 cuando el bit 2 indica una
referencia magnética válida.

`0x61 SET_MPU_STREAM`:

- request `[enable:u8]` o `[enable:u8, period_ms:u16]`;
- periodo F4 clamp `20..1000 ms`, default `100 ms`;
- response de 4 bytes `[status:u8,active:u8,period_ms:u16]`;
- evento `0x90` usa el snapshot de 42 bytes;
- no repite una muestra si `sample_seq` no cambio.

`0x62 STOP_MPU_STREAM`: request vacio, response de 1 byte `[status:u8]`.

### 5.7 `0x64 GET_TELEMETRY_SNAPSHOT`

Longitud efectiva actual: 92 bytes. El buffer C es mayor, pero solo se envian
los bytes escritos.

| Offset | Tipo | Campo |
| ---: | --- | --- |
| 0 | u8 | status |
| 1 | u8 | backend (`0 detecting,1 AT,2 WEB`) |
| 2 | u8 | WiFi mode |
| 3 | u8 | bridge connected |
| 4 | u32 | capability mask |
| 8 | u8 | I2C policy |
| 9 | u8 | motion armed |
| 10 | u8 | balance active |
| 11 | u8 | command active |
| 12 | u8 | safety stop |
| 13 | f32 | pitch measured deg |
| 17 | f32 | pitch setpoint deg |
| 21 | f32 | balance output percent |
| 25 | f32 | left output percent |
| 29 | f32 | right output percent |
| 33 | f32 | Kp |
| 37 | f32 | Ki |
| 41 | f32 | Kd |
| 45 | f32 | roll deg |
| 49 | f32 | pitch deg |
| 53 | f32 | yaw magnetic relative deg |
| 57 | u8 | MPU stream active |
| 58 | u16 | MPU stream period ms |
| 60 | u16 | left min PWM |
| 62 | u16 | right min PWM |
| 64 | u16[8] | raw ADC in physical scan order |
| 80 | f32 | PID error deg |
| 84 | f32 | PID integral deg*s |
| 88 | f32 | PID derivative deg/s |

Los consumidores deben validar `status`, valores finitos y, para confiar en la
referencia de yaw, el flag `magnetómetro válido`.

### 5.8 Balance PID `0x65/0x66`

`0x65` response 13 bytes: `status:u8, kp:f32, ki:f32, kd:f32`.

`0x66` request: `mask:u8` y floats presentes en orden Kp, Ki, Kd. Bits
`0x01/0x02/0x04`. Cada valor debe ser finito y `0..1000`.

Response 14 bytes:

```text
status:u8, changed_mask:u8, kp:f32, ki:f32, kd:f32
```

Status: `0 OK`, `1 payload invalido`, `2 mask invalida`, `3 valor fuera de
rango`. Los PID cambian en runtime y actualmente no persisten tras reset.

### 5.9 `0x67 GET_CONTROL_SNAPSHOT`

Longitud fija actual: 64 bytes.

| Offset | Tipo | Campo |
| ---: | --- | --- |
| 0 | u8 | status |
| 1 | u8 | car mode |
| 2 | u8 | line-follow FSM |
| 3 | u8 | stable line pattern |
| 4 | u8 | line confidence percent |
| 5 | u8 | line ambiguous |
| 6 | u8 | line reject reason |
| 7 | u16 | line width mm |
| 9 | f32 | lateral error mm |
| 13 | f32 | normalized lateral error |
| 17 | f32 | linear acceleration m/s2 |
| 21 | f32 | estimated velocity m/s |
| 25 | f32 | yaw rate deg/s |
| 29 | u8 | estimator confidence percent |
| 30 | u8 | estimator flags |
| 31 | f32 | common motion output percent |
| 35 | f32 | differential motion output percent |
| 39 | f32 | turn limit percent |
| 43 | u8 | saturation limited |
| 44 | u8 | USB active |
| 45 | u16 | USB alive period ms |
| 47 | u32 | USB alive accepted count |
| 51 | u32 | USB RX overflow count |
| 55 | u32 | USB TX queue-full count |
| 59 | u8 | USB queued TX count |
| 60 | u32 | USB TX drop count |

FSM linea: `0 SEARCH`, `1 TRACK`, `2 INTERSECTION`, `3 CROSS_COMMIT`,
`4 RECOVER`, `5 FAULT`.

Reject linea: `0 none`, `1 disabled`, `2 not ready`, `3 disarmed`, `4 unsafe
pitch`, `5 bad width`.

Flags estimador: bit0 stale, bit1 high pitch, bit2 vibration, bit3 saturated,
bit4 no external reference, bit5 MPU not ready.

### 5.10 Firmware/build `0x68/0x69`

`0x68 GET_FIRMWARE_INFO`:

```text
status:u8,
name_len:u8,name,
version_len:u8,version,
target_len:u8,target
```

`0x69 GET_BUILD_INFO`:

```text
status:u8,
date_len:u8,date,
time_len:u8,time,
profile_len:u8,profile,
compiler_len:u8,compiler
```

### 5.11 IR `0x6A/0x6B/0x6C` y evento `0x91`

`0x6A GET_IR_SNAPSHOT` y `0x91 IR_STREAM` comparten 56 bytes:

| Offset | Tipo | Campo |
| ---: | --- | --- |
| 0 | u8 | status |
| 1 | u8 | flags: bit0 lights on, bit1 follow mode |
| 2 | u16 | sample sequence |
| 4 | u16 | stream period ms |
| 6 | u32 | HAL tick ms |
| 10 | u16[8] | raw ADC physical order |
| 26 | u16[8] | normalized values |
| 42 | u8 | line pattern: L `0x04`, C `0x02`, R `0x01` |
| 43 | u8 | route alignment enum |
| 44 | u8 | confidence 0..100 |
| 45 | u8 | ambiguous |
| 46 | u16 | line width mm |
| 48 | f32 | lateral error mm |
| 52 | f32 | normalized lateral error |

Orden fisico `raw/norm`:

```text
0 PA1 line center
1 PA2 line right
2 PB1 object center
3 PA0 line left
4 PA4 object left-center
5 PA5 object right-center
6 PA6 object left 45
7 PA7 object right 45
```

`0x6B SET_IR_STREAM`: request `[enable]` o `[enable,period:u16]`, clamp
`20..1000 ms`, default `100 ms`; response
`[status,active,period_l,period_h]`.

`0x6C STOP_IR_STREAM`: response `[status]`.

MPU e IR mantienen estados independientes y pueden coexistir.

### 5.12 Estado real de sensado, estimacion y navegacion

La cadena implementada en F4 es:

```text
ADC1 DMA, 8 canales
  -> TCRT5000 raw y normalizados
  -> clasificacion de linea
  -> FSM de seguimiento
  -> intencion de MotionControl
  -> salida de motores

MPU9250 + AK8963
  -> actitud y aceleracion lineal
  -> estimador de velocidad relativa de corto plazo
  -> seguridad y snapshot de control
```

Cadencias internas actuales:

- ADC1 funciona continuamente por DMA; los comandos Web no lo arrancan ni lo
  detienen.
- `MotionControl` se atiende cada `5 ms`.
- la FSM de seguimiento de linea se atiende cada `10 ms`.
- al entrar en modo `FOLLOW`, F4 enciende las luces IR, resetea/habilita la FSM
  y esta entrega intenciones a `MotionControl`; no escribe PWM directamente;
- fuera de `FOLLOW`, apaga las luces IR, deshabilita el seguimiento y detiene
  la intencion de movimiento;
- `TEST` usa el drive de prueba directo.

La velocidad de `0x67` integra la aceleracion lineal Y, con filtro y fuga. Es
una estimacion relativa de corto plazo: no es odometria, no integra encoders y
no debe presentarse como posicion absoluta.

No existe hoy un comando UNER para armar/desarmar `MotionControl`, seleccionar
`FOLLOW` directamente, fijar avance/giro, resetear la FSM o cambiar sus
ganancias. La Web puede observar `0x67` y puede emular botones mediante
`0x53..0x58` solo si primero conoce y conserva el `screen_code` vigente. El ESP
no debe inventar IDs para cubrir estas operaciones sin cambiar antes F4.

## 6. Lifecycle de streams y desconexion

- El stream pertenece al `transport_id` y `dst_node` que lo inicio.
- Cerrar USB DTR detiene streams iniciados por USB.
- Para UART/ESP, el servidor debe enviar STOP cuando el ultimo consumidor Web
  libera el stream o cuando reinicia la sesion.
- El servidor debe arbitrar varios clientes: usar una suscripcion compartida por
  tipo y aplicar el periodo mas rapido solicitado, o designar un unico owner.
- Nunca iniciar/detener ADC desde los comandos de stream. ADC1 ya corre por DMA.
- Mientras la F4 espera una validacion/comando ESP, los servicios MPU/IR se
  pausan. El ESP debe responder dentro de los timeouts declarados para evitar
  huecos largos de telemetria.

## 7. Capabilities F4

Bits publicados por `WifiBridge_GetCapabilities()`:

```text
0 ALIVE
1 STATUS
2 FIRMWARE
3 WIFI_STA
4 WIFI_AP
5 WIFI_SCAN
6 REMOTE_UI
7 PREFERENCES
8 I2C_POLICY
9 MPU_SNAPSHOT
10 MPU_STREAM
11 BINARY_ASSETS
12 MOTION_CONTROL
13 SENSOR_TELEMETRY
14 REMOTE_AUTH
15 IR_STREAM
```

El backend AT solo expone las capacidades basicas. El backend WEB publica el
conjunto extendido. La F4 intenta alive cada `50 ms`, usa timeout de probe de
`150 ms` y vuelve a deteccion despues de tres fallos. El ESP servidor debe
responder `PING (0x31)` con baja latencia para que F4 seleccione y conserve
`WEB`.

Una capability expresa soporte de la familia, pero no prueba que cada ID
declarado de esa familia tenga handler. En este corte `REMOTE_AUTH` si dispone
de validacion, sesion, logout/query y cambio de PIN; `0x59` sigue siendo solo un
alias de migracion rechazado. Aplicar tambien la lista de IDs no operativos de
este documento.

## 8. Eventos ESP -> F4

La F4 reconoce eventos de estado del ESP `0x80..0x8F` y `0x92..0x94`, incluidos
boot, mode, STA connect/disconnect, clientes AP/WebSocket, webserver up,
controller y red/IP. `0x93 NETWORK_IP` y `0x94 BOOT_COMPLETE` esperan 5 bytes.

Para los eventos con payload libre `0..255`, el servidor debe conservar el
formato ya usado por el firmware ESP existente hasta definir un schema cerrado.
No deben convertirse todavía en una API publica estable sin pruebas doradas.

### 8.1 Respuestas ESP -> F4 que deben conservarse

Estos layouts son consumidos por handlers F4 actuales y forman parte del
contrato de compatibilidad:

| ID | Payload de respuesta/evento ESP |
| ---: | --- |
| `0x41` | `[status, firmware_ascii_sin_NUL]`; F4 conserva hasta 32 caracteres |
| `0x1A` | `[ssid_len, ssid, rssi_i8, encryption_u8, channel_u8]` |
| `0x14/0x15` | `[1,count]` mientras sigue el scan; `[0,count,{ssid_len,ssid}...]` al terminar |
| `0x48` | `[0|0xFE, sta_ipv4[4]]` |
| `0x49` | `[0|0xFE]` |
| `0x4B` | `[0|0xFE, ap_ipv4[4]]` |
| `0x4C` | `[0|0xFE]` |
| `0x5C` | `[result,ssid_len,ssid]`; si resulta OK agrega IPv4 |

`0x5A` entrega assets binarios en chunks:

```text
status:u8, asset_id:u8, width:u8, height:u8,
total_len:u16, offset:u16, data_len:u8, data[data_len]
```

El total admitido por F4 es 1024 bytes. Los chunks deben ser contiguos,
ordenados y coherentes con `total_len`.

`0x30 GET_STATUS` mantiene un layout heredado que no conviene reinterpretar en
esta migracion: longitud minima 18, `status` en byte 0, AP/STA activos en 1/2,
modo en 3, `ssid_len` en 9, SSID desde 10 y las dos IPv4 en los ultimos 8 bytes.
Los bytes 4..8 se consideran opacos.

El flujo de credenciales Web iniciado desde F4 requiere dos momentos: `0x12`
recibe primero una confirmacion rapida y `0x5C` informa el resultado asincrono.
Enviar solo `0x5C` no satisface la espera asociada al comando `0x12`.

## 9. Limitaciones que los otros repositorios deben respetar

- `0x59 AUTH_PIN_GRANTED` esta registrado unicamente para devolver NACK
  deprecated. La autenticacion valida usa `0x51` y siempre coteja en F4.
- `Permission_Request()` implementa ingreso local, timeout 60 s, tres intentos,
  bloqueo 60 s, autorizacion temporal y continuacion no bloqueante.
- F4 mantiene sesiones por nodo, pero ESP debe seguir aplicando auth por
  WebSocket; el PIN viaja en claro si el servidor usa `ws://`.
- Solo `src=0x3` puede emitir eventos ESP; `0x5..0xC` son clientes y el servidor
  debe impedir que raw/Protocol Studio elija el origen.
- `0x19 RESET_MCU` esta declarado, pero no tiene handler local F4.
- El snapshot MPU Web anterior con enteros escalados es incompatible con este
  contrato float32.
- La localizacion de objetos IR vive actualmente en la Web/simulador; F4 solo
  entrega raw/norm y semantica de linea.
- El PID remoto no persiste.
- No existe request ID dentro de UNER v2. La correlacion JSON pertenece al ESP
  y solo puede tener una solicitud pendiente por clave de correlacion segura
  para comandos sin identificador de respuesta.

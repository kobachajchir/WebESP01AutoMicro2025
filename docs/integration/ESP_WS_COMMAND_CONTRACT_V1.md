# Contrato WebSocket ESP API v1

Estado: contrato normativo para la migracion ESP -> Web. Fecha de corte del
contrato F4 conocido: `2026-07-12`.

Este documento define la API JSON que debe exponer el ESP01 en `/ws`. El
STM32F411 sigue siendo la fuente de verdad del protocolo UNER v2 y de la
coincidencia del PIN. La API Web no expone rutas, nodos ni detalles de
correlacion UNER como parte de su camino normal.

El envio del documento vivo desde OLED Studio esta normado en
[`OLED_CANVAS_TRANSFER.md`](OLED_CANVAS_TRANSFER.md). Antes de iniciarlo, la
Web debe consultar nuevamente `getCarMode` y `getCurrentScreen`, comprobar
sesion PIN F4, modo `TEST`, pantalla `0x030503` y
`hello.features.oledCanvas=true`.

> Estado del checkout al redactar este documento: el connect emite `hello` con
> `api:1`; el parser acepta el request v1, rechaza campos de envelope
> desconocidos y lo adapta internamente al dispatcher `device.command`. Para
> una sesion que usa v1, las respuestas, errores y eventos salen en envelope
> v1. Los productores asincronos que aun construyen `device.event` se adaptan al
> enviar segun la preferencia de cada cliente; conservan nombres historicos como
> `screen.changed`, `stm.event` o `wifi.*`. Registry, decoders, cola, sesiones,
> waiters de streams y broker estan conectados, pero no fueron validados por
> PlatformIO, fake F4 ejecutado ni hardware en esta pasada.

## Transporte y limites

- HTTP permanece en puerto `80` y WebSocket en `/ws`.
- Cada mensaje de API v1 es un frame WebSocket de texto con un unico objeto
  JSON UTF-8.
- El limite actual de entrada es `1024` bytes por mensaje. Un mensaje mayor se
  descarta sin ejecutar ninguna accion y se informa en el formato preferido por
  la conexion. Una sesion nueva empieza en v1; al recibir un envelope legacy
  pasa a preferir salida legacy.
- Los mensajes WebSocket de texto pueden llegar fragmentados. El bridge solo
  reinicia el acumulador en `num==0 && index==0`, concatena fragmentos hasta
  `final` y recien entonces parsea el JSON. Frames binarios se rechazan. Este
  callback no fue validado end-to-end con AsyncWebSocket en esta pasada.
- `requestId` y `command` son strings no vacios de hasta `64` caracteres.
- El servidor concede una sola sesión Web activa aunque el SoftAP mantenga
  varias estaciones asociadas. Esto evita que varios navegadores agoten PCBs y
  heap descargando el SPA, Draco y el GLB a la vez.
- El enlace HTTP/WebSocket no usa TLS en el build actual. La red no debe
  considerarse confidencial; el PIN y las credenciales no deben registrarse.
- El heartbeat WebSocket y el alive UART `0x31` son mecanismos separados.

### Limites de OLED Canvas

- El framebuffer SSD1306 es siempre de `128x64`, page-major vertical LSB y
  mide exactamente `1024` bytes.
- Web -> ESP usa dos requests `oledCanvas.chunk` Base64 de `512` bytes con
  offsets `0` y `512`; cada envelope JSON debe permanecer por debajo de
  `1024` bytes.
- El CRC es CRC-32/ISO-HDLC: `0xEDB88320` reflejado, init/xorout
  `0xFFFFFFFF`; `123456789` produce `CBF43926`.

## Envelopes canonicos

### Request

```json
{
  "api": 1,
  "type": "request",
  "requestId": "web-123",
  "command": "getMpuSnapshot",
  "args": {}
}
```

Reglas de validacion:

- `api` debe ser el entero `1`.
- `type` debe ser exactamente `request`.
- `requestId` debe estar presente y ser no vacio. El cliente no debe reutilizarlo
  mientras conserve una operacion pendiente. El checkout actual no mantiene un
  indice de unicidad y todavia no rechaza duplicados de forma explicita.
- `command` debe ser un nombre del catalogo de este documento.
- `args` debe ser un objeto, incluso cuando el comando no tenga argumentos.
- Los campos desconocidos del envelope se rechazan con `invalid_request`.
- La validacion estricta de campos desconocidos dentro de `args` no es uniforme
  todavia: cada comando valida sus campos conocidos y sus limites, pero no todos
  rechazan propiedades adicionales.
- Los argumentos numericos conocidos se validan contra su ancho antes de
  serializarlos; esto no sustituye la brecha de campos extra indicada arriba.
- El navegador nunca puede elegir `src`, `dst`, `route` o nodo UNER.

### Aceptacion de cola

Aceptar un request no equivale a haber recibido la respuesta F4. Si la
operacion MCU-bound fue validada y encolada, el ESP envia primero:

```json
{
  "api": 1,
  "type": "event",
  "event": "requestAccepted",
  "data": {
    "requestId": "web-123",
    "command": "getMpuSnapshot",
    "state": "queued",
    "queueDepth": 1
  }
}
```

`state` puede ser `accepted` si comienza inmediatamente o `queued` si queda
detras de otra transaccion. Este evento no cierra el request. Cada request
tiene luego exactamente un `response` final o un `error` final.

### Response final

```json
{
  "api": 1,
  "type": "response",
  "requestId": "web-123",
  "ok": true,
  "command": "getMpuSnapshot",
  "data": {}
}
```

`requestId` y `command` deben ser los originales. `requestId` nunca se inserta
en el payload UNER: la correlacion se conserva en la cola del ESP.

### Event

```json
{
  "api": 1,
  "type": "event",
  "event": "mpuSample",
  "data": {}
}
```

Los eventos espontaneos no consumen una transaccion pendiente. `mpuSample` e
`irSample` se envian solo a sesiones autenticadas y suscritas al stream
correspondiente.

`mpuSample.data` conserva `roll`, `pitch` y `yaw` en grados y agrega
`sampleValid`, `calibrated`, `magValid`, `stationary`, `calibrating` y
`sensorError`. `yaw` es la referencia magnética relativa del MPU9250.

### Secuencia OLED Canvas

Los comandos son `oledCanvas.begin`, `oledCanvas.chunk`,
`oledCanvas.commit` y `oledCanvas.cancel`. `begin` y cada `chunk`
responden localmente desde el ESP con el mismo `transferId` y el
`nextOffset` esperado. El ESP reconstruye los 1024 bytes y recalcula el CRC
antes de iniciar la secuencia UNER F4.

`oledCanvas.commit` conserva abierto el request original. Solo puede responder
`ok:true` con `state:"rendered"`, `bytes:1024`, el CRC original y
`screenCode:197891` despues de que la F4 confirme la finalizacion I2C/DMA de
las ocho paginas. Aceptacion de cola, carga completa en ESP o envio UART no son
exito de render.

### Error final

```json
{
  "api": 1,
  "type": "error",
  "requestId": "web-123",
  "code": "timeout",
  "message": "F4 did not answer before the command deadline",
  "details": {
    "target": "stm"
  }
}
```

Si el JSON no permite extraer un `requestId` valido, el campo puede quedar vacio.
El serializador general actual solo agrega `target` a `details`; aun no publica
de forma uniforme el ID ni el byte de estado F4. `details` no debe contener PIN,
password, credenciales WiFi ni payloads de `0x51`.

## Errores estables

| Codigo | Significado | Se toca UART |
|---|---|---:|
| `invalid_request` | Envelope, tipo, longitud o argumentos invalidos | No |
| `unauthorized` | Credenciales ESP invalidas, falta auth ESP o sesion STM requerida | No |
| `forbidden` | El rol existe pero no autoriza la operacion | No |
| `unsupported_by_f4` | ID reservado, deprecated o sin handler F4 real | No |
| `busy` | Cola/cuota/waiters agotados o rate limit de autenticacion | No para el request rechazado |
| `timeout` | Vencio el deadline de la transaccion enviada o encolada | Posiblemente |
| `uart_error` | No pudo enviarse o fallo el transporte UART | Si se intento enviar |
| `f4_nack` | F4 envio `0xE1` o una respuesta tipada con status de rechazo | Si |

Los codigos legacy `ERR_*` se mapean a estos codigos en la frontera API v1;
errores de contrato faltante o comando no soportado se convierten en
`unsupported_by_f4`. Casos internos sin mapeo especifico conservan el fallback
`uart_error`. El byte de estado o motivo F4 no se publica de forma uniforme en
todos los NACK y nunca reemplaza el codigo estable.

Para las acciones remotas `0x53..0x58`, una respuesta ACK con rechazo conserva
`code="f4_nack"` e incluye `details.status` y `details.stmCode`. La Web traduce:

| Status | Feedback y recuperacion Web |
| ---: | --- |
| `2` | La pantalla cambio; informa el conflicto y vuelve a pedir la pantalla real. |
| `3` | La accion no es valida para el argumento o estado actual; resincroniza. |
| `4` | Ningun manejador F4 consumio el evento; informa el problema y resincroniza. |
| `7` | La sesion PIN F4 vencio; solicita nueva autenticacion. |
| `8` | Hay una validacion PIN local activa; los controles remotos quedan bloqueados temporalmente. |

Un `status=0` confirma que F4 valido la accion y que la operacion directa se
aplico o el router de UI encontro un consumidor. Los eventos `0x95/0x96` siguen
siendo la fuente del estado visual resultante.

## Handshake

Al abrir una sesion, el ESP reserva un nodo libre y envia un evento `hello`:

```json
{
  "api": 1,
  "type": "event",
  "event": "hello",
  "data": {
    "apiVersion": 1,
    "espVersion": "esp01-2026.07.13",
    "f4ContractCutoff": "2026-07-12",
    "clientId": 7,
    "clientIp": "192.168.4.2",
    "sessionGeneration": 19,
    "assignedNode": "0x05",
    "maxClients": 1,
    "features": {
      "typedF4Commands": true,
      "sharedMpuStream": true,
      "sharedIrStream": true,
      "oledCanvas": true,
      "diagnosticRaw": true,
      "tls": false
    },
    "backend": {
      "uart": "ready",
      "f4Alive": false,
      "wifi": "ready",
      "wifiState": 0,
      "filesystem": "ready",
      "spaAssets": true,
      "modelAssets": true
    }
  }
}
```

La semantica actual de `backend` es limitada y no debe interpretarse como un
health check extremo a extremo:

- `uart:"ready"` solo indica que el bridge tiene un `UnerApp` asociado; no
  confirma que F4 responda.
- `f4Alive` es `true` si el ESP observo un `0x31` de F4 en los ultimos 150 ms.
- `wifi:"ready"` indica disponibilidad del servicio WiFi, no conexion STA.
- `wifiState` expone el estado numerico de la FSM `WifiUtils`.
- `filesystem:"ready"` solo confirma que LittleFS esta montado mediante
  `NVS_StorageReady()`.
- `spaAssets` comprueba `/dist/index.html.gz` y `modelAssets` comprueba el modelo
  `/dist/models/AutoCompressedNORemesh.glb`. No verifican todos los archivos
  Draco ni demuestran que el `buildfs` de esta pasada haya producido una imagen.

`typedF4Commands` y los dos flags de stream se emiten fijos; describen caminos
presentes en el codigo, no una validacion de build ni hardware.
`diagnosticRaw` solo es `true` cuando LittleFS esta montado y existe
`/auth.json`; usar raw ademas exige los roles y auth indicados mas abajo. No se
anuncian motion control, `0x19` ni IDs sin handler. `assignedNode` es informativo
y nunca autoriza al cliente a enviarlo de vuelta como ruta.

## Autenticacion y autorizacion

Cada conexion mantiene dos capas de autorizacion independientes:

- `espAuthenticated` y `roles`: autorizacion del servidor ESP. Los roles
  previstos son `user`, `admin` y `diagnostic`.
- `stmAuthenticated`: sesion que F4 concedio para el nodo de esa conexion.

Un grant valido de `0x51` solo cambia `stmAuthenticated`: no autentica la capa
ESP ni concede `user`, `admin` o `diagnostic`. Los roles ESP dependen del login
propio del servidor y la telemetria requiere ambas capas.

La capa ESP actual usa un registro local `/auth.json`; su hash MD5 con salt es
compatibilidad heredada, no una proteccion moderna de password. Debe migrarse
en una revision posterior y no compensa la ausencia de TLS.
El repositorio no incluye ese archivo ni credenciales default: debe
provisionarse por dispositivo fuera de Git. Si falta o es invalido,
`esp.auth.login` responde `unauthorized` y `diagnosticRaw` se anuncia `false`.

### Login de roles ESP

El comando canonico `esp.auth.login` se permite antes de autenticar la capa ESP:

```json
{
  "api": 1,
  "type": "request",
  "requestId": "esp-login-1",
  "command": "esp.auth.login",
  "args": {
    "username": "operator",
    "password": "secret"
  }
}
```

El validator solo acepta `username` y `password`; exige longitudes `1..32` y
`1..128`. El handler aplica rate limiting, coteja `/auth.json` y, si coincide,
responde con `espAuthenticated:true`, `username` y los roles actuales `user`,
`admin`, `diagnostic`. Este login no modifica `stmAuthenticated` ni conoce el
PIN F4.

El dispatcher permite sin auth ESP previa `esp.auth.login`, los tres comandos
`esp.auth.pin.*` y `esp.auth.session.get`. `esp.auth.session.logout` y el resto
del catalogo requieren la capa ESP. Conocer el PIN puede crear/consultar la
sesion STM, pero no habilita por si solo comandos, roles ni telemetria Web.

`esp.auth.logout` es el cierre canonico de ambas capas: primero retira la
demanda MPU/IR, encola `0x5D action=0` con el nodo de la conexion y revoca de
inmediato `espAuthenticated`/roles. La respuesta final F4 conserva el
`requestId` aunque la capa ESP ya este cerrada. En cambio,
`esp.auth.session.logout` solo revoca la sesion STM y deja vigentes los roles
ESP; cerrar el WebSocket inicia el cleanup STM y libera tambien la capa ESP.

### Login PIN F4

```json
{
  "api": 1,
  "type": "request",
  "requestId": "auth-1",
  "command": "esp.auth.pin.login",
  "args": { "pin": "1234" }
}
```

El ESP convierte el string a cuatro digitos binarios `0..9` solo en memoria y
envia `0x51` scope `0` con su request auth interno y el nodo asignado. No compara
el PIN localmente, no consulta `testModePin` y no envia `0x59`.

La respuesta exitosa incluye como minimo:

```json
{
  "api": 1,
  "type": "response",
  "requestId": "auth-1",
  "ok": true,
  "command": "esp.auth.pin.login",
  "data": {
    "granted": true,
    "authSource": "stm32",
    "ttlMs": 60000,
    "attemptsLeft": 3
  }
}
```

El ESP marca `stmAuthenticated` solo si coinciden nodo, `authRequestId`, scope y
`sessionGeneration`, y `granted` es `1`. El filtro previo y la finalizacion de
UTM comprueban request auth y scope para impedir que una respuesta de otro scope
complete la operacion. Un NACK de sesion, TTL vencido, logout o disconnect
revoca el estado local.

Si dejan de llegar probes `0x31` durante mas de 150 ms, el ESP refleja la
misma perdida de backend que aplica F4: revoca `stmAuthenticated`, elimina las
suscripciones y marca el estado fisico de streams para reconciliacion. Los
roles ESP de la conexion permanecen separados y no se convierten en una sesion
STM nueva.

### Scopes y lifecycle

| Comando Web | UNER | Scope/accion | `args` |
|---|---:|---:|---|
| `esp.auth.pin.login` | `0x51` | scope `0` | `pin` de cuatro digitos |
| `esp.auth.pin.validateScreen` | `0x51` | scope `1` | `pin`, `screenCode:u32` |
| `esp.auth.pin.change` | `0x51` | scope `2` | `currentPin`, `newPin` |
| `esp.auth.logout` | `0x5D` + local | action `0` | ninguno; cierra auth ESP y STM |
| `esp.auth.session.logout` | `0x5D` | action `0` | ninguno |
| `esp.auth.session.get` | `0x5D` | action `1` | ninguno |

Scope `1` concede la pantalla solicitada sin un segundo paso `0x59`. Scope `2`
cambia el PIN en F4 y debe invalidar las sesiones afectadas segun la respuesta
F4. Antes de logout o disconnect, el broker elimina las suscripciones del
cliente. En disconnect, el slot entra en cleanup, reintenta `0x5D` action `0`
cada segundo y libera el nodo al confirmar logout; si F4 no confirma, mantiene
una cuarentena de 61 s antes de reutilizarlo. Generation impide que una
respuesta tardia autentique al siguiente ocupante.

El ESP aplica rate limiting por IP y por cliente ademas de los tres intentos y
el bloqueo por nodo que aplica F4. Nunca se devuelve ni registra el PIN.

## Comandos tipados

Los nombres de esta tabla son la interfaz Web canonica. La columna UNER solo
documenta la traduccion interna; no habilita un envio raw.

Comandos propios del ESP:

| Comando Web | Owner | Argumentos principales | Resultado |
|---|---|---|---|
| `esp.auth.login` | ESP | `username`, `password` | roles ESP por conexion |
| `esp.auth.logout` | ESP+F4 | ninguno | revoca roles y confirma `0x5D` |
| `esp.wifi.getMode` | ESP | ninguno | modo/FSM e interfaces |
| `esp.device.getStatus` | ESP | ninguno | estado, cola y metricas |
| `wifi.scan.start` / `esp.wifi.getScan` | ESP | ninguno | inicio y evento final correlacionado |
| `wifi.detail.get` / `esp.wifi.getDetail` | ESP | `ssid` | detalle del cache de scan |
| `wifi.ap.credentials.set` / `esp.wifi.setAp` | ESP | SSID/password/config AP | configuracion persistida |
| `esp.wifi.setSta` | ESP | SSID/password/config STA | configuracion persistida |
| `esp.wifi.connect` / `esp.wifi.disconnect` | ESP | ninguno | mutacion de la FSM WiFi |
| `wifi.credentials.submit/cancel` y aliases `esp.*` | ESP | SSID/password o SSID | prueba/cancelacion de credenciales |
| `esp.ap.start` / `esp.ap.stop` | ESP | ninguno | estado AP |
| `esp.wifi.setAutoReconnect` | ESP | `enabled` | politica de reconnect |

En comandos F4, los nombres cortos de la tabla siguiente son los canonicos para
la Web nueva. Las variantes `stm.*` del registry JSON se mantienen como aliases
de transicion y no cambian el owner ni el layout UNER.

| Comando Web | UNER | Owner | Argumentos principales | Respuesta tipada |
|---|---:|---|---|---|
| `getPreferences` | `0x40` | F4 | `index?:u8` | Sin `index`: snapshot global; con `index`: descriptor solicitado |
| `getCurrentScreen` | `0x52` | F4 | ninguno | `screenCode`, estado y fuente |
| `menuItemClick` | `0x53` | F4 | `screenCode`, `item` | ACK/NACK final |
| `triggerEncoderButton` | `0x54` | F4 | `screenCode`, `pressKind` | ACK/NACK final |
| `triggerUserButton` | `0x55` | F4 | `screenCode`, `pressKind` | ACK/NACK final |
| `requestScreenPage` | `0x56` | F4 | `screenCode`, `direction` | ACK/NACK final |
| `rotateEncoderLeft` | `0x57` | F4 | `screenCode` | ACK/NACK final |
| `rotateEncoderRight` | `0x58` | F4 | `screenCode` | ACK/NACK final |
| — | `0x59` | F4/deprecated | no expuesto | `unsupported_by_f4` sin UART |
| — | `0x5A` | ESP/no implementado | no expuesto | Sin handler ni asset source UNER; los assets Web se sirven por HTTP/LittleFS |
| `getCarMode` | `0x5B` | F4 | ninguno | `mode:u8` |
| — | `0x5C` | ESP | interno | resultado WiFi ESP -> F4, no Web raw |
| `esp.auth.session.logout` | `0x5D` | F4 | ninguno | estado de sesion de 6 bytes decodificado |
| `esp.auth.session.get` | `0x5D` | F4 | ninguno | estado de sesion de 6 bytes decodificado |
| `setI2cPolicy` | `0x5E` | F4 | `mode:1..3` | `status`, `currentMode` |
| `getI2cPolicy` | `0x5F` | F4 | ninguno | `status`, `currentMode` |
| `getMpuSnapshot` | `0x60` | F4 | ninguno | snapshot float32 de 42 bytes |
| `subscribeMpu` | `0x61/0x62` | F4 via broker | `periodMs:20..1000` | Final al converger F4: demanda y estado/periodo fisicos |
| `unsubscribeMpu` | `0x61/0x62` | F4 via broker | ninguno | Final al converger; puede quedar fisicamente activo para otros clientes |
| `setPreferences` | `0x63` | F4 | `fieldMask:u32`, `values:u8[]` max. 60 | `status`, `changedMask` en respuesta de 5 bytes |
| `getTelemetrySnapshot` | `0x64` | F4 | ninguno | snapshot de 92 bytes |
| `getBalancePid` | `0x65` | F4 | ninguno | estado y tres float32, 13 bytes |
| `setBalancePid` | `0x66` | F4 | uno o mas de `kp`, `ki`, `kd` | `status`, `changedMask` y tres float32, 14 bytes |
| `getControlSnapshot` | `0x67` | F4 | ninguno | snapshot de 64 bytes |
| `getFirmwareInfo` | `0x68` | F4 | ninguno | strings con longitud prefijada, hasta 196 bytes |
| `getBuildInfo` | `0x69` | F4 | ninguno | strings con longitud prefijada, hasta 149 bytes |
| `getBootReport` | `0x6F` | F4 | ninguno | reporte fijo del mailbox y perfil de arranque, 22 bytes |
| `getIrSnapshot` | `0x6A` | F4 | ninguno | snapshot IR de 56 bytes |
| `subscribeIr` | `0x6B/0x6C` | F4 via broker | `periodMs:20..1000` | Final al converger F4: demanda y estado/periodo fisicos |
| `unsubscribeIr` | `0x6B/0x6C` | F4 via broker | ninguno | Final al converger; puede quedar fisicamente activo para otros clientes |

Las longitudes y offsets exactos estan en
`FIRMWAREF4_UNER_CONTRACT_SNAPSHOT.md`. El ESP valida la longitud antes de
decodificar y usa little-endian. En particular:

- `0x60` y `0x90` son exactamente 42 bytes con `float32`, no enteros
  escalados. Mantienen los offsets existentes; el yaw en offset 14 es
  magnético relativo y el bit 2 de `flags` indica si el AK8963 fue válido.
- `0x61` responde `[status, active, period:u16]`, exactamente 4 bytes.
- `0x62` responde `[status]`, exactamente 1 byte.
- `0x64` mide 92 bytes y `0x67`, 64 bytes.
- `0x6A` y `0x91` miden 56 bytes.
- `0x6F` y `0x9F` comparten un payload fijo de 22 bytes: esquema, estado del mailbox, handoff, flags de reset/validacion, perfil de arranque, versiones, tamano y CRC32.
- `0x6B` responde 4 bytes y `0x6C`, 1 byte.

Para `setPreferences`, `values` ya debe estar serializado en el orden ascendente
de bits/descriptores del contrato F4 (`bool` un byte, `u16` dos bytes
little-endian). El ESP actual valida que sea un array de bytes y el largo total,
pero no verifica semanticamente que cantidad y tipos correspondan al
`fieldMask`; el bit 6 de calibracion MPU no debe enviarse.

Las lecturas de snapshots no inventan posicion de objetos IR. La Web puede
derivarla de valores raw/normalizados y de la semantica de linea.

## Eventos

| Evento/formato | Origen | Estado real del checkout |
|---|---|---|
| `hello` v1 | ESP | Implementado; se envia al conectar |
| `requestAccepted` v1 | ESP | Implementado; solo al cliente que encolo un request MCU-bound |
| `mpuSample` v1 | `0x90` F4 | Implementado; solo ESP+STM autenticados y suscritos a MPU |
| `irSample` v1 | `0x91` F4 | Implementado; solo ESP+STM autenticados y suscritos a IR |
| `bootReport` v1 | `0x9F` F4 | Implementado; mismo objeto que `getBootReport`, distribuido a las sesiones STM autenticadas |
| `screen.changed` | `0x95/0x96` F4 | v1 para clientes v1 y `device.event` para legacy; ambos IDs comparten nombre |
| `stm.event` | `0x97` F4 | v1 para clientes v1, con payload generico; legacy conserva `device.event` |
| `wifi.scan.results` | ESP scan | Solo cliente+generation ESP autenticado que inicio el scan; conserva `requestId` |
| `wifi.mode.changed`, `wifi.sta.*`, `wifi.ap.*` | ESP | Fan-out ESP autenticado; v1 o legacy segun preferencia del cliente |
| `screenChanged`, `menuSelectionChanged`, `carModeChanged` | F4 | Nombres semanticos objetivo aun no emitidos; hoy se usan los nombres anteriores |
| `subscriptionChanged`, `authChanged`, `backendStatus` v1 | ESP/F4 | No emitidos actualmente; subscribe/auth responden por otros caminos |
| `legacyUsage` v1 | ESP | No emitido; solo hay contadores en `esp.device.getStatus` |

`0x80..0x8F` y `0x92..0x94` son eventos/control plane propios del ESP hacia
F4. No se aceptan desde el navegador como raw. `0xA4..0xAA` estan reservados y
nunca se envian al F4 actual.

La adaptacion de eventos se hace al enviar a cada cliente: un productor puede
construir internamente `device.event`, pero una sesion con preferencia v1 recibe
`{api:1,type:"event",event,data}`. `origin` y `requestId`, cuando existen, se
incorporan a `data`. Los eventos espontaneos usan la preferencia actual de la
conexion; requests UART y waiters de streams congelan el formato que tenia el
request al encolarse.

El scan WiFi conserva `clientId`, generation y `requestId`. Antes de publicar
verifica que la misma generation siga activa y ESP-autenticada; disconnect del
originador cancela la espera Web y descarta su resultado/metadata, evitando
entregarlo a una sesion que reutilice el ID. Esto no afirma que el driver pueda
interrumpir fisicamente un scan asincrono ya iniciado.

## Suscripciones compartidas

`subscribeMpu` y `subscribeIr` modifican demanda logica por conexion; no
transfieren directamente cada SET/STOP del navegador a F4.

- `periodMs` se limita a `20..1000` ms.
- El periodo fisico es el minimo pedido por los clientes activos.
- El primer suscriptor genera SET.
- Un cambio del minimo genera SET solo si cambia el periodo aplicado.
- Un unsubscribe o disconnect no genera STOP mientras queden consumidores.
- El ultimo consumidor genera STOP.
- Si sale el owner F4, el broker transfiere ownership con SET o detiene el
  stream, segun la demanda restante.
- Si reaparece un PING F4 despues de mas de 150 ms sin alive, o aparece por
  primera vez mientras el broker conserva estado, el bridge llama
  `sb_backend_reconnected()`: lleva cada stream a STOP conocido. Como la perdida
  de alive invalida las sesiones F4 y el ESP no conserva el PIN, los clientes
  deben reautenticar y resuscribirse antes del SET de una demanda nueva. Un
  reboot ESP tambien pierde sesiones/demanda. El wiring existe, pero sigue
  pendiente validarlo en runtime y hardware.
- La respuesta F4 del SET/STOP completa la accion interna del broker; no se
  puede confundir con el request de otro cliente.
- Cada subscribe/unsubscribe crea un waiter con cliente, generation, formato,
  stream, `requestId`, comando y deadline de 5 s. Solo se permite uno pendiente
  por cliente/generation/stream y la capacidad global es 16.
- Si el broker ya esta convergido, la respuesta final es inmediata. Si requiere
  SET/STOP, primero se emite `requestAccepted` y la respuesta final llega solo
  cuando F4 confirma longitud exacta, `status=0` y el estado/periodo esperado.
  Incluye `subscribed`, `periodMs`, `physicalActive` y `physicalPeriodMs`.
- Timeout, NACK F4, cola ocupada o error UART producen un error final estable;
  disconnect cancela solo los waiters de ese cliente/generation.
- La configuracion fisica es compartida: convergencia o fallo de una accion
  completa todos los waiters actuales de ese stream, cada uno con su propio
  cliente, formato y `requestId`.
- Un fallo terminal no revierte automaticamente la demanda logica que ya se
  aplico al broker. El stream queda con su accion bloqueada hasta que una nueva
  demanda explicita vuelva a recalcularla; la Web no debe interpretar el error
  como rollback de la suscripcion.
- Un cliente con cola WS llena no bloquea UART: el mensaje se descarta. El
  checkout acumula `wsBackpressureDrops` global y
  `clientBackpressureDrops` para la conexion que consulta estado.

## Raw diagnostico

El camino raw es una herramienta de diagnostico, no la API normal:

```json
{
  "api": 1,
  "type": "request",
  "requestId": "diag-4",
  "command": "rawUner",
  "args": {
    "commandId": "0x60",
    "payload": []
  }
}
```

Requisitos:

- sesion ESP autenticada con rol `diagnostic` y sesion STM vigente;
- el ESP sustituye siempre `src` por el nodo `0x5..0xC` de la conexion y
  fuerza `dst=0x1` para requests F4;
- el ID debe existir, ser owner `F4` o `DUAL`, estar implementado y admitir la
  longitud recibida;
- se rechazan explicitamente los controles de stream `0x61`, `0x62`, `0x6B` y
  `0x6C`; deben pasar por el broker;
- se rechazan `RESERVED`, owners `ESP`, eventos, `0x59`, `0xA4..0xAA` y
  comandos sensibles como `0x51` fuera de sus operaciones tipadas;
- el payload se limita a 255 bytes y el frame total a la capacidad UNER;
- la respuesta conserva `requestId`, pero no devuelve secretos ni frames auth
  completos.

## Compatibilidad legacy

Durante una ventana de migracion, `/ws` puede aceptar los envelopes existentes
`login`, `verifySession`, `logout` y `device.command`. Un cliente que usa ese
camino recibe `device.response` y `device.event`; un cliente v1 recibe la
adaptacion v1 aunque el productor interno del evento sea legacy.

La compatibilidad debe cumplir las mismas reglas de seguridad que v1:

- nodo asignado por servidor;
- registry y longitudes antes de UART;
- una unica transaccion MCU-bound global;
- no `0x59`, no `0xA4..0xAA` y no falsificacion de eventos ESP;
- telemetria filtrada por autenticacion y suscripcion;
- contadores actuales `apiV1Requests`, `legacyEnvelopes` y `legacyRawRequests`
  consultables en `esp.device.getStatus`. No existe un evento `legacyUsage` ni
  desglose por comando todavia.

El orden de retiro es: desplegar ESP dual, desplegar la Web con API v1, observar
uso legacy, retirar primero raw no autorizado y finalmente los envelopes
legacy. No se retira compatibilidad en el mismo despliegue que introduce v1.

# Cambios requeridos en WebESP01AutoMicro2025

Repositorio objetivo:

`C:\Users\kobac\OneDrive\Escritorio\Facultad\Microcontroladores\Auto Proyecto\Web ESP01\WebESP01AutoMicro2025`

Este archivo debe copiarse tambien al repo Web como
`docs/integration/WEB_CLIENT_REQUIRED_CHANGES.md` y mantenerse como checklist
durante la migracion.

## 1. Informacion F4 no negociable

- UNER v2: header `UNER`, token `0x3A`, version `0x02`, total `10+LEN`, XOR.
- La Web no elige route: ESP asigna un nodo UNER `0x5..0xC` por WebSocket;
  `0x3` queda como broker/compatibilidad.
- MPU `0x60/0x90`: 42 bytes float32; `sample_dt_us` en offset 4 y Euler en
  offsets 6/10/14.
- MPU stream: clamp F4 `20..1000 ms`, no 8 ms.
- IR `0x6A/0x91`: 56 bytes, clamp `20..1000 ms`.
- `0x64`: 92 bytes; `0x67`: 64 bytes.
- `0x95`: 5 bytes; `0x96`: 7 bytes; `0x97`: 1 byte.
- `0x51` autentica contra el PIN persistido F4; `0x5D` consulta/cierra sesion;
  `0x59` existe solo para NACK deprecated. `0x19` sigue sin handler.
- La localizacion IR es Web; F4 entrega raw/norm y semantica de linea.

Leer el detalle completo en `F4_WIRE_CONTRACT.md` antes de tocar decoders.

## 2. Incompatibilidades actuales a corregir

### MPU

`src/pages/EstadoSection.tsx` mantiene un decoder local de enteros escalados que
no coincide con el F4. Reemplazarlo por un decoder compartido float32.

Layout correcto:

```text
status:u8, flags:u8, seq:u16, dt_us:u16,
roll:f32, pitch:f32, yaw:f32,
ax_g:f32, ay_g:f32, az_g:f32,
gx_dps:f32, gy_dps:f32, gz_dps:f32
```

Eliminar campos `linearAccelMg` del snapshot `0x60/0x90`; si la UI necesita
aceleracion lineal debe leer el snapshot de control correspondiente o mostrar
que no esta disponible en este mensaje.

### Periodo

Cambiar minimo MPU de 8 a 20 ms en constantes, inputs, builders, textos,
ejemplos y tests. IR ya usa 20 ms.

Separar ACKs: `SET_MPU_STREAM` responde 4 bytes y `STOP_MPU_STREAM` responde un
solo byte. El handler actual compartido marca el STOP valido como incompleto.

### Auth y reset

- Conservar Login, modal de PIN, validacion de pantalla y cambio de PIN.
- No enviar `stm.auth.pin.grant`/`0x59`: el PIN completo viaja en el request
  semantico al ESP y F4 decide `granted` mediante `0x51`.
- Usar la sesion PIN de F4 como unica autenticacion de usuario. No pedir
  username/password ni depender de `/auth.json` para telemetria normal.
- Mostrar `authSource:"stm32"`, `ttlMs`, `attemptsLeft`, bloqueo y expiracion.
- Scope 0 login; scope 1 validacion con screen code; scope 2 cambio de PIN.
- No usar ningun fallback de PIN que reutilice `0x60`, porque `0x60` es
  `GET_MPU_SNAPSHOT`.
- No presentar `RESET_MCU 0x19` como operativo. El reset STM solo puede
  habilitarse cuando exista handler F4 o hardware/reset controlado documentado.

### Stack legacy

Retirar progresivamente el protocolo anterior que convive con v2:

```text
src/api/UnerProtocol.ts
src/contexts/UNERProtocolContext.tsx
src/hooks/useUnerProtocol.tsx
src/types/UnerProtocolCMDTypes.ts
src/api/UnerProtocolUtils.ts
```

Ese stack no entiende version/route, limita payload a 30 bytes y puede intentar
parsear frames v2 como legacy. Migrar primero sus consumidores (`Home`,
`UserContext`, mocks) al gateway nuevo.

### Heartbeat y PIN legacy

- `Home.tsx` usa heartbeat `0xA2`; F4 usa `PING/ALIVE 0x31`. Separar heartbeat
  WebSocket ESP del ping F4.
- `APP_PIN_CONFIG=0x60` colisiona con `GET_MPU_SNAPSHOT`. Eliminar ese fallback.
- Migrar cambio de PIN a `esp.auth.pin.change`; F4 lo persiste mediante scope 2
  de `0x51` y revoca sesiones anteriores.

### Seguridad y reconexion

- Desactivar el bypass de login de desarrollo por defecto.
- Eliminar logs de PIN/password.
- El boton Reintentar debe recrear realmente el socket.
- Agregar backoff exponencial con jitter y estados connecting/reconnecting.
- No hacer eco local de comandos cuando un socket real esta cerrado; el eco
  solo pertenece al mock explicito.
- Elegir `wss://` cuando la pagina se sirve por HTTPS.

## 3. Arquitectura Web objetivo

Evitar decoders y builders dentro de paginas. Crear o consolidar:

```text
src/protocol/uner/frame.ts
src/protocol/uner/parser.ts
src/protocol/f4/commands.ts
src/protocol/f4/mpu.ts
src/protocol/f4/ir.ts
src/protocol/f4/telemetry.ts
src/protocol/f4/control.ts
src/protocol/f4/screen.ts
src/services/deviceGateway/types.ts
src/services/deviceGateway/DeviceGateway.ts
src/services/deviceGateway/WebSocketDeviceGateway.ts
src/hooks/useF4Stream.ts
```

Los nombres pueden adaptarse a la arquitectura existente, pero deben quedar
estas responsabilidades:

- parser incremental unico;
- codecs puros sin React;
- gateway WebSocket con requestId/timeout/reconnect;
- hooks de lifecycle para streams;
- paginas consumen objetos tipados, no offsets.

`src/api/UnerFrameV2.ts` puede ser el punto de migracion inicial, pero no debe
seguir creciendo como archivo monolitico.

`WebSocketContext` debe conservar metadata de `requestId`, direccion y error al
entregar frames raw; hoy los listeners raw reciben solo bytes y pierden la
correlacion.

## 4. API WebSocket canonica

Mantener compatibilidad de entrada con `stmPacket`, pero migrar las features a
`device.command` tipado.

Request:

```json
{
  "type": "device.command",
  "payload": {
    "apiVersion": 1,
    "requestId": "uuid",
    "target": "stm",
    "command": "f4.mpu.stream.set",
    "params": { "periodMs": 20 }
  }
}
```

Response:

```json
{
  "type": "device.response",
  "payload": {
    "apiVersion": 1,
    "requestId": "uuid",
    "target": "stm",
    "command": "f4.mpu.stream.set",
    "ok": true,
    "code": "OK",
    "data": { "active": true, "periodMs": 20 },
    "rawFrame": [85, 78, 69, 82]
  }
}
```

Evento:

```json
{
  "type": "device.event",
  "payload": {
    "apiVersion": 1,
    "origin": "stm",
    "event": "f4.mpu.sample",
    "data": {},
    "rawFrame": []
  }
}
```

El `rawFrame` completo permite diagnostico y compatibilidad. No loguear payloads
que contengan PIN/password.

## 5. Tabla minima de nombres tipados

```text
f4.preferences.get       -> 0x40
f4.preferences.set       -> 0x63
f4.screen.get            -> 0x52
f4.input.menuClick       -> 0x53
f4.input.encoderButton   -> 0x54
f4.input.userButton      -> 0x55
f4.input.requestPage     -> 0x56
f4.input.rotateLeft      -> 0x57
f4.input.rotateRight     -> 0x58
f4.carMode.get           -> 0x5B
f4.i2c.set               -> 0x5E
f4.i2c.get               -> 0x5F
f4.mpu.get               -> 0x60
f4.mpu.stream.set        -> 0x61
f4.mpu.stream.stop       -> 0x62
f4.telemetry.get         -> 0x64
f4.balancePid.get        -> 0x65
f4.balancePid.set        -> 0x66
f4.control.get           -> 0x67
f4.firmware.get          -> 0x68
f4.build.get             -> 0x69
f4.ir.get                -> 0x6A
f4.ir.stream.set         -> 0x6B
f4.ir.stream.stop        -> 0x6C
```

Auth se consume como API JSON del ESP, no como builder raw de la pagina:

```text
esp.auth.pin.login            -> ESP -> F4 0x51 scope 0
esp.auth.pin.validateScreen   -> ESP -> F4 0x51 scope 1
esp.auth.pin.change           -> ESP -> F4 0x51 scope 2
esp.auth.session.logout       -> ESP -> F4 0x5D action 0
esp.auth.session.get          -> ESP -> F4 0x5D action 1
```

Eventos:

```text
f4.mpu.sample            <- 0x90
f4.ir.sample             <- 0x91
f4.screen.changed        <- 0x95
f4.menu.selectionChanged <- 0x96
f4.carMode.changed       <- 0x97
```

## 6. Lifecycle y estado

- Un componente no debe asumir stream activo hasta response F4 exitosa.
- Al cambiar a emulacion, cambiar de sensor, desmontar pagina o perder sesion,
  liberar la suscripcion.
- El ESP decide cuando emitir STOP fisico segun consumidores globales; la Web
  envia subscribe/unsubscribe semantico.
- Tras reconnect, no restaurar comandos peligrosos. Restaurar solo streams de
  lectura solicitados por vistas montadas.
- Deduplicar por `sampleSeq` y, para IR, tambien `tickMs`.
- Distinguir: socket connected, ESP ready, F4 backend ready, stream requested y
  stream active.
- Distinguir socket conectado, sesion PIN F4, TTL y lockout.
- Al expirar o recibir NACK status 7, volver a Login sin simular exito.
- Mostrar timeout/degraded; no convertir timeout en ACK exitoso.

Agregar handshake inicial de servidor con version API, capabilities ESP,
version F4 observada, limite de mensaje y estado del backend STM.

## 7. Archivos existentes a revisar

Como minimo:

```text
src/contexts/WebSocketContext.tsx
src/hooks/useWebSocket.tsx
src/api/UnerFrameV2.ts
src/pages/EstadoSection.tsx
src/pages/TrackFollowerSection.tsx
src/pages/WifiSection.tsx
src/pages/Login.tsx
src/contexts/UserContext.tsx
src/contexts/ScreenContext.tsx
src/components/ScreenStreamWorkspace.tsx
src/components/SystemResetActions.tsx
src/features/ir/*
src/features/protocolStudio/*
docs/telemetry-session-protocol.md
docs/ir-session-protocol.md
docs/uner-websocket-events.md
docs/remote-auth-web-flow.md
docs/WIFI_WEB_ESP_STM_FLOW.md
```

No reemplazar trabajo visual o calibracion IR existente. Cambiar solo la
fuente de datos y el contrato cuando corresponda.

`TrackFollowerSection` integra hoy un paso fijo por paquete y no consume
velocidad/FSM `0x67`; documentarlo como reconstruccion heuristica. No llamarlo
navegacion real ni hacer que distancia dependa implicitamente del periodo IR.

`ControlSection` debe seguir con ejecucion fisica bloqueada hasta que F4 tenga
un contrato remoto de movimiento y seguridad expresamente implementado.

Actualizar Protocol Studio: MCU `dst=1`, nodo `0x2=PC_QT`; para Web el ESP
inyecta/valida el `src=0x5..0xC` asignado. Mostrar comandos F4 actuales y marcar
telemetria legacy obsoleta.

## 8. Tests requeridos

- tests puros para cada codec;
- fixtures compartidos con ESP;
- MPU float32 42 bytes y rechazo del layout viejo;
- clamp 20/1000;
- IR mapping `[6,4,2,5,7]` para objetos;
- parser fragmentado/concatenado/checksum invalido;
- requestId, timeout y response tardia;
- reconnect sin listeners duplicados;
- dos vistas consumiendo IR sin STOP prematuro;
- login correcto/incorrecto/bloqueado y expiracion de sesion F4;
- validacion de pantalla envia PIN+screen code y no usa `0x59`;
- cambio de PIN exige actual/nuevo y fuerza reauth de otras sesiones;
- logout/reconnect no hereda la sesion de otro WebSocket;
- Protocol Studio no puede seleccionar ni falsificar `src=0x3`;
- expiry/logout limpia estado y suscripciones sin mostrar telemetria huerfana;
- heartbeat `0x31` y ausencia de `0xA2` productivo;
- socket cerrado no produce echo de exito;
- PIN nunca aparece en logs;
- ACK STOP MPU de un byte.

## 9. Definicion de terminado

- no queda decoder MPU viejo;
- no queda minimo 8 ms;
- docs y codigo usan el mismo contrato;
- todos los frames entran por codecs compartidos;
- gateway tiene API tipada y compatibilidad raw;
- el login usa solamente F4 como autoridad y no solicita usuario/password;
- no quedan `stm.auth.pin.grant`, PIN local ESP ni logs de secretos;
- los tests y build del repo pasan;
- smoke con F4 real cumple `COMPATIBILITY_ACCEPTANCE_PLAN.md`.

## 10. Hosting y comandos de validacion

El ESP debe servir fallback SPA y tambien:

```text
/models/auto_micro.glb
/models/AutoCompressedNORemesh.glb
/draco/draco_decoder.js
/draco/draco_decoder.wasm
/draco/draco_wasm_wrapper.js
```

Validacion actual:

```powershell
npm.cmd run lint
npm.cmd run test:ir
npm.cmd run build
```

Desarrollo contra ESP real:

```powershell
$env:VITE_WS_URL="ws://<IP-ESP>/ws"
npm.cmd run dev -- --host 0.0.0.0
```

# Migración Web al contrato ESP WebSocket API v1

Fecha: 2026-07-13. Contrato F4 de referencia: 2026-07-12.

## Resultado

La entrada productiva usa un único `WebSocketProvider` y el envelope v1 del ESP. La pila UNER legacy (`UnerProtocol.ts`, `UNERProtocolContext.tsx`, `useUnerProtocol.tsx`, `UnerProtocolCMDTypes.ts` y `UnerProtocolUtils.ts`) queda fuera del árbol de providers y, por lo tanto, fuera del bundle productivo. Se conserva temporalmente en fuente como referencia de compatibilidad y debe borrarse cuando el ESP retire definitivamente envelopes legacy.

## Archivos canónicos

- `src/protocol/wsApi.ts`: envelopes, nombres semánticos, guards, `requestId` y resolución `ws`/`wss`.
- `src/protocol/espClient.ts`: pending map, correlación, timeout, errores y cleanup al desconectar.
- `src/protocol/f4Payloads.ts`: decoders puros F4 y adaptación del JSON semántico emitido por ESP.
- `src/contexts/WebSocketContext.tsx`: socket único, handshake `hello`, FSM, backoff, dispatch y compatibilidad de eventos durante la transición.
- `src/hooks/useEspCommand.ts`: operación tipada para UI.
- `src/hooks/useSensorSubscription.ts`: referencia local compartida para que dos vistas no emitan un unsubscribe prematuro.
- `src/protocol/__fixtures__/f4-uner-golden-vectors.json`: bytes dorados del contrato F4.

## Lifecycle de conexión

```text
idle -> connecting -> authenticating -> ready
                     -> retry_wait -> connecting
                     -> failed
```

`ready` sólo se publica después de `hello` con `apiVersion:1`. Una conexión muerta rechaza todas las promises pendientes, limpia el sender y reintenta con backoff exponencial más jitter. Cada conexión nueva vuelve a declarar las suscripciones que siguen montadas; la Web no conserva una sesión STM anterior ni guarda el PIN.

`VITE_WS_URL` tiene prioridad. Sin override se usa `wss://host/ws` para páginas HTTPS y `ws://host/ws` para HTTP. El mock sólo se activa con `VITE_WS_MOCK=true`; no emite éxitos F4 sintéticos.

## Auth

- Login: `esp.auth.pin.login`, con `authSource:"stm32"`, TTL, intentos y bloqueo.
- Un `granted:true` de `0x51` no abre todavia las rutas: la Web consulta
  `esp.auth.session.get` (`0x5D`, accion query) y crea `user` solo si F4 confirma
  `authenticated:true`, `authSource:"stm32"` y TTL restante mayor que cero.
- Pantalla: `esp.auth.pin.validateScreen` recibe PIN y `screenCode` y termina con una sola response F4.
- Cambio: `esp.auth.pin.change` recibe PIN actual y nuevo.
- Logout: `esp.auth.session.logout`; al reconectar se limpia el estado STM.
- No se envía `0x59`, no existe un segundo grant y no se registra el PIN.
- El modo desarrollador sólo controla presentación; ya no salta la autenticación.

El router se crea una sola vez por montaje de la aplicacion. Un cambio de
`user` durante `login -> home` no reconstruye `RouterProvider` ni desmonta la
navegacion. Si la sesion se invalida, la Web vuelve al PIN con una causa
explicita: `ttl_expired`, `f4_offline`, `stm_reset`, `stm_auth_rejected` o
`pin_changed`. Una caida del WebSocket tambien cierra la sesion asociada a esa
conexion y muestra un aviso distinto.

La politica de producto usa solamente el PIN cuya autoridad es F4. La Web no solicita usuario/password ni expone `esp.auth.login`; el logout revoca la sesion STM. El snapshot del contrato ESP copiado en este repositorio todavia describe una capa heredada de roles y `/auth.json`: el firmware ESP debe retirar ese requisito para telemetria y comandos antes de declarar terminada la aceptacion con hardware.

## Sensores y navegación

MPU usa 42 bytes: status, flags, secuencia, `sampleDtUs` y nueve `float32` LE. No contiene aceleración lineal. IR usa 56 bytes y conserva el orden físico de ocho canales. SET y STOP se decodifican por contratos separados de 4 y 1 byte. Los períodos se limitan a 20..1000 ms.

`TrackFollower` sigue siendo una reconstrucción visual. Los puntos y obstáculos calculados en Web no son posición medida. El `estimatedVelocityMps` de `0x67` es una estimación relativa de corto plazo, no odometría.

## Estado F4 implementado/no implementado

| Familia | Estado en Web |
| --- | --- |
| MPU `0x60/0x90`, `0x61`, `0x62` | Decoder y stream tipado implementados |
| IR `0x6A/0x91`, `0x6B`, `0x6C` | Decoder y stream compartido implementados |
| Telemetría `0x64` | Decoder puro implementado |
| Control/FSM `0x67` | Decoder puro implementado; integración visual completa pendiente |
| Auth F4 `0x51/0x5D` | PIN, pantalla, cambio y logout por JSON implementados |
| Auth/roles ESP | Eliminado del diseño Web; pendiente retirar el requisito heredado en firmware ESP |
| Reset MCU `0x19` | Deshabilitado; no hay handler F4 |
| Motion control remoto | Deshabilitado; no existe contrato F4 |
| Eventos semánticos `carModeChanged` | Consumidos; se acepta `stm.event` como alias transitorio del ESP actual |

## Protocol Studio

El constructor representa UNER v2. MCU es `dst=1`, PC/Qt es `0x2`, ESP broker es `0x3` y los clientes Web son `0x5..0xC`. El origen mostrado es diagnóstico: en un envío raw real el ESP siempre sustituye el `src` por el nodo asignado a la sesión. `0x19` aparece como no operativo.

## Pruebas

`tests/protocolContracts.test.ts` cubre MPU, IR, telemetría, control, ACK SET/STOP, floats LE/negativos/NaN/truncados, clamp, `requestId` fuera de orden, disconnect de pending y URL `ws`/`wss`. Los tests IR existentes cubren calibración, orden espacial y geometría.

## Build y LittleFS

```powershell
npm.cmd run lint
npm.cmd run test
npm.cmd run build
```

El build produce `dist/index.html` y copia `dist/models` y `dist/draco`. El firmware ESP debe copiar el contenido de `dist/` bajo `/dist/` en LittleFS y mantener fallback de rutas SPA hacia `/dist/index.html` o su variante gzip. Para probar contra hardware:

```powershell
$env:VITE_WS_URL="ws://<IP_DEL_ESP>/ws"
npm.cmd run dev -- --host 0.0.0.0
```

`<IP_DEL_ESP>` es sólo un parámetro de ejecución y no debe quedar en el código.

# Contrato tecnico WebSocket app <-> firmware

## Alcance

Este documento describe la comunicacion real que hoy implementa la app web con
el firmware sobre WebSocket, tomando como referencia directa el codigo de:

- `src/contexts/WebSocketContext.tsx`
- `src/contexts/UNERProtocolContext.tsx`
- `src/api/UnerProtocol.ts`
- `src/pages/Home.tsx`
- `src/pages/WifiSection.tsx`
- `src/pages/EstadoSection.tsx`
- `src/contexts/UserContext.tsx`
- `src/pages/Login.tsx`

La idea es que el desarrollador del firmware pueda construir una libreria
compatible con el frontend actual, incluyendo transporte, parseo, comandos,
payloads, respuestas y diferencias entre el canal operativo y el `UNER Studio`.

## Endpoint WebSocket

La app monta hoy el proveedor así:

```tsx
<WebSocketProvider url={`ws://${window.location.hostname}/ws/mock`}>
```

Eso significa:

- en desarrollo, la UI arranca en `mock` local del frontend
- para hardware real, debe usarse `ws://<host>/ws`
- el frontend espera un unico WebSocket duplex

## Dos canales logicos sobre el mismo WebSocket

El frontend usa dos tipos de mensaje en el mismo socket:

1. Mensajes `string` JSON
2. Mensajes binarios `ArrayBuffer` / `Uint8Array`

La separacion la hace `WebSocketContext.tsx`:

- si llega `string`, hace `JSON.parse()` y distribuye por `type`
- si llega binario, lo pasa al parser UNER

### Canal JSON

Se usa para login / sesion. No es parte del control del dispositivo.

Formato:

```json
{
  "type": "nombreDelMensaje",
  "payload": { "campo": "valor" }
}
```

Mensajes emitidos hoy por la app:

- `login_attempt` con payload `{ username, password }` desde `Login.tsx`
- `login` con payload `{ username, password }` desde `UserContext.tsx`
- `verifySession` sin payload desde `UserContext.tsx`
- `logout` sin payload desde `UserContext.tsx`

Mensajes esperados por la app:

- `loginResponse` con payload `{ success, user }`
- `sessionVerifyResponse` con payload `{ success, user }`

### Canal binario operativo

Se usa para Home, Wi-Fi y Sensores/Visor.

El runtime binario real del frontend no usa JSON para control del dispositivo.
Usa frames UNER armados por `UNERProtocol.ts`.

## Protocolo binario operativo real

### Formato del frame

El formato que **realmente envian** `Home`, `WifiSection` y `EstadoSection`
es este:

```text
[55][4E][45][52][LEN][3A][CMD][PAYLOAD...][CHK]
```

Campos:

- `55 4E 45 52`: header ASCII `"UNER"`
- `LEN`: longitud logica de `CMD + PAYLOAD + CHK`
- `3A`: token fijo `':'`
- `CMD`: comando de 1 byte
- `PAYLOAD`: 0..30 bytes
- `CHK`: XOR de todos los bytes desde `HEADER` hasta el ultimo byte de payload

### Reglas de longitud

En `src/api/UnerProtocol.ts`:

- `payload max = 30`
- `LEN min = 2`
- `LEN max = 32`
- `total min = 8`
- `total max = 38`

Formula:

```text
LEN = 1 (CMD) + payloadLen + 1 (CHK)
```

### Checksum

El checksum es XOR acumulado de:

```text
HEADER + LEN + TOKEN + CMD + PAYLOAD
```

No incluye el propio byte `CHK`.

### Parser esperado del firmware

El parser compatible con la app debe:

1. resincronizar por `55 4E 45 52`
2. validar `LEN`
3. validar `TOKEN = 0x3A`
4. leer `CMD`
5. leer `PAYLOAD`
6. validar `CHK`

El runtime actual del frontend **no** usa `VER` ni `ROUTE` en el canal binario
operativo.

## Diferencia importante con UNER Studio

`UNER Studio` tiene un constructor/traductor extendido en
`src/features/protocolStudio/utils.ts` que analiza y genera frames con esta
forma:

```text
[55][4E][45][52][LEN(payload)][3A][02][ROUTE][CMD][PAYLOAD][CHK]
```

Ese formato tiene:

- `VER = 0x02`
- `ROUTE = (src << 4) | dst`
- `LEN = solo payload`

Eso **no coincide** con el runtime binario operativo de `UNERProtocol.ts`.

### Recomendacion para firmware

Si el objetivo es compatibilidad con la app operativa actual:

- implementar primero el formato binario de `UNERProtocol.ts`

Si ademas se quiere compatibilidad futura con `UNER Studio` como herramienta de
inyeccion/analisis live:

- implementar como opcion secundaria el formato extendido del Studio
- o agregar un adaptador en frontend para unificar ambos dialectos

## Comandos binarios usados hoy por la app

### 1. Home / heartbeat

Archivo:

- `src/pages/Home.tsx`

Comando emitido por la UI:

```text
CMD = 0xA2 (HEARTBEAT_BEAT)
PAYLOAD = [periodMsLow][periodMsHigh]
```

Detalles:

- el payload es `u16 LE`
- la pantalla usa el mismo `0xA2` tanto para enviar como para escuchar
- al recibir `0xA2`, llama `onHeartbeatReceived()`

Ejemplo:

```text
periodMs = 500
payload = F4 01
```

### 2. Wi-Fi

Archivo:

- `src/pages/WifiSection.tsx`

#### 2.1 Consultar modo

```text
CMD = 0x10 (WIFI_GET_MODE)
PAYLOAD = vacio
```

Respuesta esperada:

```text
CMD = 0x11 (WIFI_MODE)
PAYLOAD = [mode]
```

Donde:

- `0 = AP`
- `1 = STATION`

#### 2.2 Pedir scan

```text
CMD = 0x12 (WIFI_GET_SCAN)
PAYLOAD = vacio
```

Respuesta esperada:

```text
CMD = 0x13 (WIFI_SCAN_LIST)
PAYLOAD = [count][net1][net2]...
```

Formato de cada red:

```text
[ssidLen][ssid bytes][rssi][security]
```

Donde:

- `ssidLen`: 1 byte
- `ssid`: `ssidLen` bytes UTF-8
- `rssi`: 1 byte signed, transmitido como byte
- `security`: 1 byte

#### 2.3 Configurar AP

```text
CMD = 0x14 (WIFI_SET_AP)
PAYLOAD = [ssidLen][ssid][passLen][pass][ip0][ip1][ip2][ip3]
```

Validaciones frontend:

- `ssidLen` entre `1` y `32`
- `passLen == 0` o `passLen >= 8`
- IP debe ser IPv4 valida

Casos soportados:

- `0.0.0.0` para usar IP default del firmware
- password vacia para AP abierto

Referencia detallada:

- `docs/wifi-firmware-payloads.md`

#### 2.4 Configurar STA

```text
CMD = 0x15 (WIFI_SET_STA)
PAYLOAD = [ssidLen][ssid][passLen][pass][fixedIp][ip0][ip1][ip2][ip3]
```

Validaciones frontend:

- `ssidLen` entre `1` y `32`
- `passLen >= 8`
- si `fixedIp = 0`, igual se envian 4 bytes de IP y la app usa `0.0.0.0`
- si `fixedIp = 1`, la app exige IPv4 explicita

Referencia detallada:

- `docs/wifi-firmware-payloads.md`

#### 2.5 ACK Wi-Fi esperado

La pantalla escucha:

```text
CMD = 0x16 (WIFI_ACK)
PAYLOAD = [cmdRef][code]
```

Interpretacion:

- `cmdRef`: comando reconocido por firmware
- `code = 0`: exito
- `code != 0`: error mostrado en UI

La UI hoy usa `WIFI_ACK` al menos para:

- `WIFI_SET_AP (0x14)`
- `WIFI_SET_STA (0x15)`

### 3. Sensores / Visor / telemetria

Archivo:

- `src/pages/EstadoSection.tsx`

#### 3.1 Iniciar o actualizar stream

```text
CMD = 0x20 (TELEMETRY_SET_RATE)
PAYLOAD = [periodMsLow][periodMsHigh]
```

Reglas:

- `periodMs > 0`: inicia o actualiza stream
- `periodMs = 0`: finalizador explicito, detiene stream

Uso de UI:

- modo temporizado: la app arranca stream y programa el finalizador localmente
- modo constante: la app arranca stream y espera hasta que el usuario toque `Detener`
- si el usuario cambia el intervalo mientras la sesion esta activa, la app reenvia `0x20` con el nuevo periodo

Limites de UI:

- duracion minima: `1s`
- duracion maxima: `240s`

Referencia detallada:

- `docs/telemetry-session-protocol.md`

#### 3.2 ACK de telemetria esperado

```text
CMD = 0x21 (TELEMETRY_ACK)
PAYLOAD = [code][periodMsLow][periodMsHigh]
```

Interpretacion de la app:

- `code = 0` y `periodMs > 0`: telemetria activa
- `code = 0` y `periodMs = 0`: telemetria detenida
- `code != 0`: error de firmware

#### 3.3 Datos de telemetria esperados

```text
CMD = 0x22 (TELEMETRY_DATA)
PAYLOAD = [schema][seqL][seqH][accXl][accXh][accYl][accYh][accZl][accZh][gyroXl][gyroXh][gyroYl][gyroYh][gyroZl][gyroZh][tempL][tempH]
```

Longitud esperada:

```text
17 bytes
```

Desglose:

- `schema`: 1 byte
- `seq`: `u16 LE`
- `accX accY accZ`: `i16 LE`
- `gyroX gyroY gyroZ`: `i16 LE`
- `tempRaw`: `i16 LE`

La app:

- incrementa contador de paquetes
- guarda `seq`
- convierte `tempRaw` a `°C` con formula MPU6050

## Comportamiento UI que afecta al firmware

### Sesion de telemetria temporizada

Ejemplo:

- intervalo = `200 ms`
- duracion = `2 s`

Secuencia:

1. app envia `CMD 0x20`, payload `C8 00`
2. firmware responde `CMD 0x21`, payload `[00][C8][00]`
3. firmware emite `CMD 0x22` durante la ventana
4. a los `2 s`, la app envia finalizador `CMD 0x20`, payload `00 00`
5. firmware responde `CMD 0x21`, payload `[00][00][00]`

### Sesion de telemetria constante

Secuencia:

1. app envia `CMD 0x20`, payload `periodMs LE`
2. firmware responde `CMD 0x21`
3. firmware mantiene `CMD 0x22`
4. al presionar `Detener`, la app envia `CMD 0x20`, payload `00 00`
5. firmware responde `CMD 0x21`, payload `[00][00][00]`

## Modo mock del frontend

Cuando la URL contiene `mock`:

- `WebSocketContext` no abre un socket real
- `connected = true`
- los paquetes binarios se reinyectan localmente en `rawListeners`
- `WifiSection` y `EstadoSection` fabrican respuestas mock usando `UNERProtocol.buildPacket(...)`

Eso significa que:

- `/ws/mock` no define una interfaz de firmware real
- es solo simulacion interna del frontend

## Requisitos minimos de compatibilidad para firmware

Si el objetivo es hacer compatible el firmware con la app actual:

1. Exponer un WebSocket en `/ws`
2. Aceptar binario crudo para el canal operativo
3. Parsear frames con formato:

```text
[UNER][LEN][TOKEN][CMD][PAYLOAD][CHK]
```

4. Implementar al menos estos comandos:

- `0xA2` heartbeat
- `0x10`, `0x11`, `0x12`, `0x13`, `0x14`, `0x15`, `0x16`
- `0x20`, `0x21`, `0x22`

5. Responder con payloads exactamente compatibles con la UI
6. Mantener LE en todos los `u16` e `i16`
7. No mezclar en binario los campos `VER` y `ROUTE`, porque el runtime actual no los manda

## Diferencias abiertas que conviene resolver

Hoy existen dos divergencias en el frontend:

### 1. Dialecto binario operativo vs Studio

- operativo: `UNER + LEN + TOKEN + CMD + PAYLOAD + CHK`
- Studio: `UNER + LEN(payload) + TOKEN + VER + ROUTE + CMD + PAYLOAD + CHK`

### 2. Canal JSON de login

Hoy el frontend emite tanto:

- `login_attempt`
- `login`

Si el firmware va a implementar auth real por WebSocket, conviene unificar esos
mensajes en el frontend o soportar ambas variantes temporalmente.

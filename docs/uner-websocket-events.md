# WebSocket events a paquetes UNER para STM

## Objetivo

Cuando la web necesita hablar con la STM, no envia binario crudo directo por el WebSocket. Envia JSON con `type=stmPacket` y los bytes UNER v2 en `payload.data`. La ESP debe actuar como bridge: validar esos bytes y escribirlos al enlace UART/UNER hacia la STM.

## Formato UNER v2

```text
HEADER "UNER" | LEN | TOKEN ":" | VERSION 0x02 | ROUTE | CMD | PAYLOAD | CHK
```

- `LEN` es la cantidad de bytes de payload.
- `ROUTE = (src << 4) | dst`.
- Para Web -> STM se usa `src=WEB_APP(0x3)`, `dst=MCU(0x1)`, `route=0x31`.
- `CHK` es XOR desde el header hasta el ultimo byte del payload.

## Envelope WebSocket

```json
{
  "type": "stmPacket",
  "payload": {
    "action": "setMpuStream",
    "cmd": "SET_MPU_STREAM",
    "periodMs": 20,
    "data": [85, 78, 69, 82, 3, 58, 2, 49, 97, 1, 20, 0, 114]
  }
}
```

La ESP debe validar `data` antes de reenviar:

1. header `55 4E 45 52`;
2. token `0x3A`;
3. version `0x02`;
4. ruta esperada o permitida;
5. longitud total `10 + LEN`;
6. checksum XOR.

## Comandos de reinicio

| Accion en la web | CMD | Payload | Frame UNER |
| --- | --- | --- | --- |
| Reiniciar ESP normal | `REBOOT_ESP = 0x16` | `[0x00]` | `55 4E 45 52 01 3A 02 31 16 00 12` |
| Reiniciar ESP en AP | `REBOOT_ESP = 0x16` | `[0x01]` | `55 4E 45 52 01 3A 02 31 16 01 13` |
| Reiniciar STM32 | `RESET_MCU = 0x19` | vacio | `55 4E 45 52 00 3A 02 31 19 1C` |

Es normal que el WebSocket se corte si el reinicio afecta a la ESP o si la STM reinicia el enlace.

## Telemetria MPU real

La pantalla `MPU + IR` usa el contrato vigente de firmware:

| Accion en la web | CMD | Payload | Regla |
| --- | --- | --- | --- |
| Snapshot puntual | `GET_MPU_SNAPSHOT = 0x60` | vacio | lectura puntual |
| Iniciar/actualizar stream | `SET_MPU_STREAM = 0x61` | `[01, period_l, period_h]` | periodo minimo UI/F4: `20 ms` |
| Detener stream | `STOP_MPU_STREAM = 0x62` | vacio | corta transmision del requester |
| Datos push | `EVT_APP_GET_MPU_READINGS = 0x90` | 42 bytes | misma estructura que snapshot |

Ejemplo `SET_MPU_STREAM` a `20 ms`:

```text
55 4E 45 52 03 3A 02 31 61 01 14 00 72
```

Ejemplo `STOP_MPU_STREAM`:

```text
55 4E 45 52 00 3A 02 31 62 67
```

La UI decodifica los `float32` de `0x90` directamente en grados. El yaw queda
corregido por el AK8963 y panel, gráfico y modelo 3D comparten el mismo cero local.

Mas detalle: [telemetry-session-protocol.md](telemetry-session-protocol.md).

## Telemetria IR propuesta

La misma pantalla incorpora un stream IR independiente del MPU. El cliente
demultiplexa por `cmd_id`, asi que ambos pueden estar activos a la vez:

| Accion en la web | CMD | Payload | Regla |
| --- | ---: | --- | --- |
| Snapshot puntual IR | `GET_IR_SNAPSHOT = 0x6A` | vacio | lectura puntual |
| Iniciar/actualizar stream IR | `SET_IR_STREAM = 0x6B` | `[enable, period_l, period_h]` | clamp UI `20..1000 ms` |
| Detener stream IR | `STOP_IR_STREAM = 0x6C` | vacio | parada explicita |
| Datos push IR | `IR_STREAM = 0x91` | 56 bytes | raw/norm ADC, linea y tracking |

El ADC no se controla desde estos comandos; el stream solo publica la ultima
muestra disponible. Las luces IR se reportan en flags y no se modifican desde
`SET_IR_STREAM`.

Mas detalle: [ir-session-protocol.md](ir-session-protocol.md).

## Pantalla y permiso remoto

La web escucha eventos raw:

- `EVT_SCREEN_CHANGED = 0x95`
- `EVT_MENU_SELECTION_CHANGED = 0x96`

Ambos payloads incluyen `screen_code` little-endian. Para conceder un permiso remoto, la web valida primero el PIN contra la ESP y despues envia `AUTH_PIN_GRANTED (0x59)` o el wrapper JSON `stm.auth.pin.grant` con el `screenCode` actual. La UI no da el grant por exitoso al enviarlo: espera el siguiente `screen.changed` / `screen.current` para confirmar que la STM salio del flujo de permiso o reporto error.

Cuando `source=NOTIFICATION`, F4 puede extender `0x95` a 9 bytes con
`remainingMs` y `totalMs`. La Web usa esos campos para identificar la
notificacion activa y reproducir su cuenta regresiva, sin transportar el resto
del contenido de la OLED. Al finalizar el aviso, F4 envia otro `0x95` con la
pantalla restaurada.

El botón `Sincronizar pantalla` no reconstruye el estado desde el cache: envía
un `getCurrentScreen` (`0x52`) nuevo y conserva su `requestId` hasta recibir el
`screen.current` correlacionado. El snapshot comienza con
`[screenCode:u32 LE, source:u8]` y puede agregar:

- menú: `selectedIndex,itemCount`, para alinear pantalla y cursor juntos;
- notificación: `remainingMs,totalMs`;
- dashboard `0x010101`: flags ESP/STA/AP/USB/RF, backend AT/WEB, modo, IP y
  SSID.

La réplica del dashboard usa esos valores reportados por la F4 y las mismas
reglas visuales del renderer físico. Si primero llega el evento corto `0x95`,
la Web solicita automáticamente un `0x52` para hidratar los datos dinámicos.

El Home consulta el modo con `getCarMode` (`0x5B`) y lo cambia mediante
`setCarMode` (`0x6E`, argumento `mode:0..2`). El cambio queda confirmado por la
respuesta `[status, mode]` y por el evento `carModeChanged` (`0x97`). La F4
muestra durante 2,5 s la pantalla de aviso `0x010105`, `Cambio remoto a
{MODO}`.

Mas detalle: [remote-auth-web-flow.md](remote-auth-web-flow.md).

## Estado QT por USB

La F4 publica `EVT_QT_USB_STATE = 0x9E` cada vez que cambia el estado DTR de
USB CDC. El ESP valida el payload `[connected:u8]` y lo convierte al evento
JSON `qtUsbStateChanged`, disponible solamente para sesiones STM autenticadas.

El Home obtiene primero el valor autoritativo `usbActive` mediante
`getControlSnapshot` y luego mantiene la fila `QT / USB` del estado general
actualizada con esos eventos. Como respaldo visual, también interpreta los
`screen.changed` de las notificaciones `0x020401 USB conectado` y `0x020402 USB
desconectado`; `qtUsbStateChanged` sigue siendo la fuente autoritativa. El valor
mostrado no depende del `f4Alive` cacheado en el `hello`. Si el WebSocket o la
sesion PIN no estan disponibles, el estado se presenta como desconectado y sin
confirmacion reciente.

## Alive Qt hacia Web mediante forwarding F4

El evento canónico `qtAlive` confirma que llegó al ESP un frame UNER
`PING (0x31)` vacío con `src=PC_QT (0x2)`, `dst=WEB_APP/ESP broker (0x3)` y
`route=0x23`. La F4 solamente lo reenvía de USB CDC a UART1; no ejecuta el
comando ni cambia su ruta. El Home valida los cuatro campos y conserva la hora
local de recepcion para el diagnostico QT.

La fila compacta del Home se presenta como `QT / USB · PF` y combina el estado
DTR autoritativo con `unerRouterForwardingEnabled`. Al pulsarla abre un modal
que vuelve a consultar `getControlSnapshot` y `getPreferences`, muestra el
ultimo `qtAlive`, el inicio estimado de la conexion, periodo/contador Alive USB
y contadores de overflow/cola TX.

El modal QT permite cambiar PF, antes de las tres tarjetas de diagnostico,
mediante el contrato existente `setPreferences`: `fieldMask=512` (`bit 9`) y
`values=[0|1]`. Tras la respuesta, la Web relee `getPreferences`; solo entonces
presenta `PF ON` o `PF OFF`. No se crea un comando UNER adicional porque F4 ya
persiste y aplica esa preferencia.

Un cambio persistido genera ademas una notificacion F4 de 2000 ms:
`0x050417` para `Port forward / activado` y `0x050418` para
`Port forward / desactivado`. El visor Web replica ambos `screenCode`, incluido
el progreso del aviso, y no anticipa la confirmacion con el estado del switch.

## WiFi desde Web hacia ESP

En modo AP, `hello.data.clientIp` identifica la IP del visor actual y
`wifi.ap.clients.list` permite rotular su fila como `Este dispositivo`. El
SoftAP puede conservar varias estaciones, pero el ESP concede una sola
interfaz Web activa; los demás equipos reciben una página liviana de interfaz
ocupada hasta que finaliza la concesión.

La F4 diferencia asociación física (`0x84/0x85`, pantallas `0x020601/0x020602`)
de aplicación Web operativa (`0x89/0x8A`, pantallas `0x020502/0x020503`).

La UI WiFi ya usa comandos JSON directos al target `esp` para no pasar passwords por STM:

- `wifi.scan.start`
- `wifi.detail.get`
- `wifi.credentials.submit`
- `wifi.credentials.cancel`
- `wifi.ap.credentials.set`

Durante el arranque de aprovisionamiento (`apActive=true` y
`staConnected=false`), la Web redirige a `/provision` antes del login PIN. En
esa vista solo utiliza `esp.device.getStatus`, `wifi.scan.start`,
`wifi.scan.stop`, `wifi.detail.get` y `wifi.credentials.submit`. La excepcion
sin PIN existe en ESP unicamente mientras esa condicion fisica de red siga
vigente; el resto de los comandos conserva la sesion PIN de FirmwareF4.

La ESP debe responder con `device.response` y emitir `device.event` segun el flujo documentado en [WIFI_WEB_ESP_STM_FLOW.md](WIFI_WEB_ESP_STM_FLOW.md).

### Clientes del Access Point

La vista AP mantiene arriba el estado y los campos de configuracion, y debajo
muestra una lista scrollable consultada con `wifi.ap.clients.list`. Cada fila
presenta el nombre estable generado por el ESP, la IP y la MAC. El boton
`Desconectar` envia `wifi.ap.clients.disconnect {mac}`; si se selecciona el
propio navegador, el corte de red posterior a la confirmacion es esperado.

El ESP8266 no expone hostname DHCP de las estaciones asociadas. La UI no debe
presentar el nombre generado como un hostname real: el response incluye
`nameSource="generated-from-mac"`.

Durante un escaneo AP el WebSocket puede reconectar por el salto de canal. La
Web mantiene el pedido `wifi.scan.start` activo durante 20 s, conserva el
spinner y no descarta un `wifi.scan.results` tardio. Al volver, el ESP anuncia
`hello.data.wifiScanPending`; puede emitir `wifi.scan.resumed` mientras el
driver sigue ocupado o reproducir directamente el resultado cacheado con el
`requestId` original. La lista recibida siempre reemplaza el estado visible,
incluso si el ACK inicial se perdio con el enlace.

La sesion PIN tiene una gracia visual separada de 25 s y, cuando vuelve
`hello`, consulta `esp.auth.session.get`. Solo mantiene al usuario si F4 y ESP
confirman la sesion reanudada; un cierre definitivo o una reconciliacion
negativa limpia el usuario.

### Cambio explicito RED / AP desde la Web

Guardar `wifi.ap.credentials.set` modifica SSID, password e IP del SoftAP, pero
no cambia por si solo el modo persistido de arranque. La seccion WiFi muestra
un boton separado que siempre propone el modo fisico opuesto:

- ESP en AP-only: propone `AP -> RED`;
- ESP con STA conectada, incluso si esta en `AP_STA`: propone `RED -> AP`.

Antes de enviar el comando, la Web abre un dialogo que avisa que se perderan
el WebSocket y la red actual. El dialogo usa exclusivamente la configuracion
persistida: muestra el SSID de destino y su IP fija. Para AP, `0.0.0.0` se
presenta como `192.168.4.1`; para STA, `0.0.0.0` se informa como DHCP porque el
router todavia no asigno una IP predecible.

El pedido API v1 es:

```json
{
  "api": 1,
  "type": "request",
  "requestId": "wifi-mode-switch-...",
  "command": "esp.reboot",
  "args": { "mode": "ap" }
}
```

`mode` acepta `ap` o `normal`. La ESP persiste `nextBootMode` antes de confirmar
la respuesta y reinicia despues de un retardo corto para permitir que el frame
WebSocket salga. La respuesta incluye `targetMode`, `targetSsid`, `targetIp` y
`targetIpSource` (`fixed`, `default` o `dhcp`). `esp.device.getStatus` tambien
publica `configuredBootMode` para diagnosticar la seleccion guardada.

## Checklist minimo de bridge ESP

1. Aceptar `stmPacket` con `payload.data` numerico.
2. Validar frame UNER v2 completo antes de escribir a UART.
3. Reenviar respuestas STM -> Web como bytes raw o `stmPacket`.
4. Mantener `device.command` JSON para WiFi y auth ESP.
5. No loguear passwords ni PINs.
6. Publicar `screen.changed` o frames raw `0x95/0x96` para que Web cierre bien PIN/granted.

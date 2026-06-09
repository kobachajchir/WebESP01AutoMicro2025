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
    "periodMs": 8,
    "data": [85, 78, 69, 82, 3, 58, 2, 49, 97, 1, 8, 0, 110]
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
| Iniciar/actualizar stream | `SET_MPU_STREAM = 0x61` | `[01, period_l, period_h]` | periodo minimo UI: `8 ms` |
| Detener stream | `STOP_MPU_STREAM = 0x62` | vacio | corta transmision del requester |
| Datos push | `EVT_APP_GET_MPU_READINGS = 0x90` | 42 bytes | misma estructura que snapshot |

Ejemplo `SET_MPU_STREAM` a `8 ms`:

```text
55 4E 45 52 03 3A 02 31 61 01 08 00 6E
```

Ejemplo `STOP_MPU_STREAM`:

```text
55 4E 45 52 00 3A 02 31 62 67
```

La UI decodifica `0x90`, toma `roll/pitch/yaw` en milideg, los pasa a grados y actualiza el panel Euler, el grafico y el modelo 3D.

Mas detalle: [telemetry-session-protocol.md](telemetry-session-protocol.md).

## Pantalla y permiso remoto

La web escucha eventos raw:

- `EVT_SCREEN_CHANGED = 0x95`
- `EVT_MENU_SELECTION_CHANGED = 0x96`

Ambos payloads incluyen `screen_code` little-endian. Para conceder un permiso remoto, la web valida primero el PIN contra la ESP y despues envia `AUTH_PIN_GRANTED (0x59)` o el wrapper JSON `stm.auth.pin.grant` con el `screenCode` actual. La UI no da el grant por exitoso al enviarlo: espera el siguiente `screen.changed` / `screen.current` para confirmar que la STM salio del flujo de permiso o reporto error.

Mas detalle: [remote-auth-web-flow.md](remote-auth-web-flow.md).

## WiFi desde Web hacia ESP

La UI WiFi ya usa comandos JSON directos al target `esp` para no pasar passwords por STM:

- `wifi.scan.start`
- `wifi.detail.get`
- `wifi.credentials.submit`
- `wifi.credentials.cancel`
- `wifi.ap.credentials.set`

La ESP debe responder con `device.response` y emitir `device.event` segun el flujo documentado en [WIFI_WEB_ESP_STM_FLOW.md](WIFI_WEB_ESP_STM_FLOW.md).

## Checklist minimo de bridge ESP

1. Aceptar `stmPacket` con `payload.data` numerico.
2. Validar frame UNER v2 completo antes de escribir a UART.
3. Reenviar respuestas STM -> Web como bytes raw o `stmPacket`.
4. Mantener `device.command` JSON para WiFi y auth ESP.
5. No loguear passwords ni PINs.
6. Publicar `screen.changed` o frames raw `0x95/0x96` para que Web cierre bien PIN/granted.

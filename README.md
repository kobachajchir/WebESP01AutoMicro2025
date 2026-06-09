# Web ESP01 Auto Micro 2025

Frontend React/Vite para operar la UI Web del auto, hablar con la ESP por WebSocket y, cuando corresponde, mandar frames UNER v2 hacia la STM.

## Contrato Web / ESP / STM

La web usa dos carriles:

- JSON WebSocket directo a ESP para WiFi, auth remota y sesiones.
- `stmPacket` para comandos que deben llegar a STM como bytes UNER v2 en `payload.data`.

Referencia de cierre: [docs/web-esp-stm-readiness.md](docs/web-esp-stm-readiness.md).

## UNER v2 por WebSocket

Cuando el destino logico es STM, el frame viaja asi:

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

El frame UNER usa ruta `0x31` (`src=WEB_APP=0x3`, `dst=MCU=0x1`) y checksum XOR.

Mas detalle: [docs/uner-websocket-events.md](docs/uner-websocket-events.md).

## Telemetria MPU real

La vista `MPU + IR` esta alineada con el contrato de firmware:

- `SET_MPU_STREAM = 0x61` inicia o actualiza el stream.
- `STOP_MPU_STREAM = 0x62` corta la transmision.
- `EVT_APP_GET_MPU_READINGS = 0x90` trae snapshot de 42 bytes.
- El periodo minimo que envia la UI es `8 ms`.
- `roll`, `pitch` y `yaw` llegan en milideg, se convierten a grados y alimentan el panel Euler, el grafico y el modelo 3D.

Mas detalle: [docs/telemetry-session-protocol.md](docs/telemetry-session-protocol.md).

## WiFi y redes ESP

La seccion WiFi ya pide redes y credenciales por JSON directo al ESP:

- `wifi.scan.start`
- `wifi.detail.get`
- `wifi.credentials.submit`
- `wifi.credentials.cancel`
- `wifi.ap.credentials.set`
- evento global `wifi.credentials.requested`

La password real no se guarda en storage, no debe loguearse y no debe reenviarse a STM.

Mas detalle: [docs/WIFI_WEB_ESP_STM_FLOW.md](docs/WIFI_WEB_ESP_STM_FLOW.md).

## PIN, permisos y granted

La web separa responsabilidades:

- valida PIN remoto contra ESP con `esp.auth.pin.login` / `esp.auth.pin.validateScreen`;
- concede una accion pendiente en STM con `AUTH_PIN_GRANTED (0x59)` o `stm.auth.pin.grant`;
- espera `screen.changed` / `screen.current` antes de considerar exitoso el grant.

La UI escucha `EVT_SCREEN_CHANGED (0x95)` y `EVT_MENU_SELECTION_CHANGED (0x96)` para no conceder sobre una pantalla vieja.

Mas detalle: [docs/remote-auth-web-flow.md](docs/remote-auth-web-flow.md).

## Reinicios

Desde configuracion:

- Reiniciar ESP normal: `REBOOT_ESP (0x16)` payload `[0x00]`.
- Reiniciar ESP en AP: `REBOOT_ESP (0x16)` payload `[0x01]`.
- Reiniciar STM32: `RESET_MCU (0x19)` payload vacio.

Es normal perder WebSocket durante un reinicio.

## Desarrollo

```bash
npm install
npm run dev
npm run build
```

En desarrollo, si no se define `VITE_WS_URL`, la app usa `ws://<host>/ws/mock`.

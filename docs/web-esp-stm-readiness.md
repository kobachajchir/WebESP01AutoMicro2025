# Checklist Web / ESP / STM

## Resumen

Este documento cruza lo que la UI ya hace con el contrato vigente de firmware para cerrar tres frentes:

- telemetria MPU desde STM hacia Web;
- pedido de redes y credenciales hacia ESP;
- validacion PIN contra ESP y `granted` contra STM.

## Telemetria MPU

Estado UI: lista.

La vista `MPU + IR`:

- envia `SET_MPU_STREAM (0x61)` con `[01, period_l, period_h]`;
- normaliza el periodo minimo a `8 ms`;
- envia `STOP_MPU_STREAM (0x62)` para cortar la transmision;
- escucha `EVT_APP_GET_MPU_READINGS (0x90)`;
- decodifica el snapshot de 42 bytes;
- convierte `roll`, `pitch` y `yaw` de milideg a grados;
- usa esos Euler para el panel de valores, el grafico y el modelo 3D.

Requisito ESP bridge:

- reenviar `stmPacket.payload.data` hacia UART/UNER;
- devolver respuestas STM como bytes raw o `stmPacket`;
- no reempaquetar el payload `0x90` como el formato viejo de 17 bytes.

Contrato obsoleto: `0x20/0x21/0x22`.

## WiFi y redes ESP

Estado UI: lista por carril JSON Web -> ESP.

La vista WiFi:

- pide scan con `wifi.scan.start`;
- pide detalle con `wifi.detail.get`;
- envia credenciales STA con `wifi.credentials.submit`;
- permite cancelar con `wifi.credentials.cancel`;
- guarda credenciales AP con `wifi.ap.credentials.set`;
- abre modal global si ESP emite `wifi.credentials.requested`.

Requisito ESP:

- responder `device.response` para comandos inmediatos;
- emitir `device.event` para `wifi.scan.results`, `wifi.detail.result` y `wifi.credentials.result`;
- no enviar passwords a STM;
- no loguear passwords.

Si STM opera el scan por firmware, los comandos UNER de soporte son:

| CMD | Uso |
| ---: | --- |
| `0x14 START_SCAN` | iniciar scan |
| `0x15 GET_SCAN_RESULTS` | leer resultados |
| `0x18 STOP_SCAN` | cancelar scan |
| `0x1A WIFI_GET_DETAIL` | detalle RSSI/cifrado/canal |

## PIN, permiso y granted

Estado UI: lista con validacion por ESP y confirmacion por pantalla STM.

Flujo:

1. Web recibe `EVT_SCREEN_CHANGED (0x95)` o `screen.changed` con una pantalla PIN.
2. Web muestra el modal de validacion.
3. Web valida PIN contra ESP con `esp.auth.pin.validateScreen`.
4. Si ESP confirma, Web envia `AUTH_PIN_GRANTED (0x59)` o wrapper `stm.auth.pin.grant`.
5. Web espera otro `screen.changed` / `screen.current`.
6. Se considera exito solo si STM sale de `PIN_ENTRY/PIN_WAITING` sin caer en denied, timeout, blocked o permission denied.

La web tambien soporta login remoto contra ESP con `esp.auth.pin.login`.

Requisito ESP bridge:

- exponer `esp.auth.pin.login` y `esp.auth.pin.validateScreen`;
- publicar pantallas STM como JSON o reenviar frames raw `0x95/0x96`;
- mapear `stm.auth.pin.grant` a `AUTH_PIN_GRANTED (0x59)` con `screen_code_le32`;
- rechazar grants si el `screenCode` no coincide con el screen actual.

## Eventos de pantalla

La UI acepta:

| Evento | CMD | Payload |
| --- | ---: | --- |
| Screen changed | `0x95` | `[screen_code_le32, source]` |
| Menu selection changed | `0x96` | `[screen_code_le32, selected, count, source]` |

Esto es necesario para cerrar correctamente `PIN/granted`, navegacion remota y refresco del visor OLED.

## Prueba de humo recomendada

1. Web conecta al ESP y pide `stm.screen.getCurrent`.
2. ESP publica `screen.current` o reenvia `0x95`.
3. En WiFi, Web ejecuta `wifi.scan.start` y recibe `wifi.scan.results`.
4. En `MPU + IR`, Web inicia stream a `8 ms`.
5. STM responde `0x61` y luego emite `0x90` de 42 bytes.
6. El modelo 3D cambia con `yaw/pitch/roll`.
7. Web detiene con `0x62`.
8. Para una accion protegida, Web valida PIN contra ESP, envia grant y confirma por cambio de pantalla STM.

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
- normaliza el periodo minimo a `20 ms`;
- envia `STOP_MPU_STREAM (0x62)` para cortar la transmision;
- escucha `EVT_APP_GET_MPU_READINGS (0x90)`;
- decodifica el snapshot de 42 bytes con nueve `float32` little-endian;
- recibe `roll`, `pitch` y yaw magnético relativo directamente en grados;
- muestra si el AK8963 aporta una referencia válida;
- usa la misma orientación puesta a cero para panel, gráfico y modelo 3D.

Requisito ESP bridge:

- reenviar `stmPacket.payload.data` hacia UART/UNER;
- devolver respuestas STM como bytes raw o `stmPacket`;
- no reempaquetar el payload `0x90` como el formato viejo de 17 bytes.

Contrato obsoleto: `0x20/0x21/0x22`.

## Telemetria IR

Estado UI/F4: contrato implementado en ambos extremos Web y STM.

La vista `MPU + IR`:

- envia `SET_IR_STREAM (0x6B)` con `[enable, period_l, period_h]`;
- normaliza el periodo IR a `20..1000 ms`;
- envia `STOP_IR_STREAM (0x6C)` para parada explicita;
- puede pedir `GET_IR_SNAPSHOT (0x6A)` sin activar streaming;
- escucha `IR_STREAM (0x91)`;
- decodifica el payload fijo de 56 bytes;
- usa `raw[8]` y `norm[8]` para paneles, barras y render de obstaculos;
- mantiene el estado IR separado del estado MPU.

Invariantes del contrato y requisito del bridge ESP:

- mantener un estado `UNER_IrStreamState` independiente de `mpu_stream`;
- publicar IR como `0x91` y MPU como `0x90`;
- no encender/apagar ADC desde el comando de stream porque ADC ya corre por DMA;
- no controlar luces IR desde `SET_IR_STREAM`; solo reportar `ir_lights_on`.

Pendiente de cierre en hardware: comprobar que el bridge ESP reenvia sin
alteraciones los frames UNER y sostiene el periodo seleccionado durante una
captura completa de calibracion. No hace falta agregar comandos nuevos a la STM
para el primer banco de muestras.

Mas detalle: [ir-session-protocol.md](ir-session-protocol.md).

## WiFi y redes ESP

Estado UI: lista por carril JSON Web -> ESP.

La vista WiFi:

- al abrir ejecuta `esp.device.getStatus` y carga SSID, IP fija, gateway y
  mascara; no inicia un scan automaticamente;
- pide scan con `wifi.scan.start`;
- detiene el scan con `wifi.scan.stop` al cambiar a la vista AP;
- pide detalle con `wifi.detail.get`;
- envia credenciales STA con `wifi.credentials.submit`;
- permite cancelar con `wifi.credentials.cancel`;
- guarda credenciales AP con `wifi.ap.credentials.set`;
- abre modal global si ESP emite `wifi.credentials.requested`.

El panel `Acerca de` usa `esp.device.getStatus` para firmware, build y runtime
del ESP01, y consulta `getFirmwareInfo` + `getBuildInfo` a la F4 cuando existe
sesión PIN. `Actualizar datos` ejecuta ambas fuentes; las tres tarjetas de
repositorio reservan su QR y la fila de medios mantiene tres fotografías.
La lectura ESP reutiliza el `EspWifiStatusContext`: si el polling ya tiene una
consulta en vuelo recibe la misma promesa y sus datos `raw`, evitando dos
`getStatus` simultaneos y un posible descarte por backpressure WebSocket.

Cuando `esp.device.getStatus` informa `apActive=true` y
`staConnected=false`, la aplicacion entra automaticamente en `/provision`.
Esta ruta publica reutiliza exclusivamente el formulario STA y la lista de
redes: muestra el alive WebSocket, modo e IP AP; permite iniciar el scan de
forma manual y probar/persistir las credenciales elegidas. No expone Home,
logout, configuracion general ni el formulario que cambia el propio AP.

El aprovisionamiento sale solo cuando la ESP obtiene enlace STA o deja de estar
en AP. Si se pierde el WebSocket, `/provision` vuelve a la ruta normal de login
o Home; por lo tanto no queda una pantalla publica utilizable sin confirmar el
estado real de la placa.

`wifi.credentials.submit` acepta `ip`, `gateway` y `subnet`. `0.0.0.0` en
`ip` selecciona DHCP. `wifi.ap.credentials.set` acepta `ip`; `0.0.0.0`
selecciona el SoftAP predeterminado `192.168.4.1/24`. La Web nunca lee claves:
si el SSID no cambia y el campo password queda vacio, usa
`reusePassword=true` para que ESP conserve el secreto persistido.

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

### Modo de arranque ESP desde la Web

Estado: implementado en Web y bridge ESP.

- la UI diferencia la pestaña de edicion WIFI/AP del modo fisico real;
- el boton dinamico solo propone el modo opuesto (`RED -> AP` o `AP -> RED`);
- un modal confirma el corte de conexion, SSID e IP de destino;
- cambios escritos pero aun no persistidos se advierten y no se usan;
- `esp.reboot {mode:"ap"|"normal"}` persiste `nextBootMode` y recien despues
  confirma/reinicia;
- la respuesta autoritativa informa `targetMode`, `targetSsid`, `targetIp` y
  `targetIpSource`;
- una STA con IP `0.0.0.0` se informa como DHCP, sin inventar una direccion que
  el router todavia no asigno.

Guardar la configuracion AP y entrar en AP-only siguen siendo dos operaciones
separadas. Esto evita reinicios involuntarios al editar credenciales y permite
confirmar explicitamente la perdida temporal del enlace.

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

## OLED Studio hacia OLED fisico

Estado: implementado en Web; requiere el bridge ESP y el comando F4 `0x6D`
del mismo contrato.

- OLED Studio rasteriza el documento vivo a 1024 bytes con layout
  `x + 128 * floor(y / 8)` y bit `1 << (y % 8)`.
- Al pulsar `Enviar a OLED`, Web vuelve a consultar `getCarMode` y
  `getCurrentScreen`; exige conexion API v1, sesion PIN F4, modo `TEST`,
  pantalla `0x030503` y capability `oledCanvas`.
- Web carga dos fragmentos Base64 de 512 bytes. ESP reconstruye y verifica
  CRC-32/ISO-HDLC antes de particionar UART.
- `Mostrada con exito` solo se publica cuando `oledCanvas.commit` devuelve
  `state:"rendered"`, 1024 bytes, el mismo CRC y `screenCode=0x030503`
  despues de la confirmacion I2C/DMA F4.
- Si cambia conexion, sesion, modo o pantalla, Web intenta cancelar y nunca
  conserva ese intento como preview confirmado.

Contrato completo:
[`integration/OLED_CANVAS_TRANSFER.md`](integration/OLED_CANVAS_TRANSFER.md).

## Prueba de humo recomendada

1. Web conecta al ESP y pide `stm.screen.getCurrent`.
2. ESP publica `screen.current` o reenvia `0x95`.
3. En WiFi, Web ejecuta `wifi.scan.start` y recibe `wifi.scan.results`.
4. En `MPU + IR`, Web inicia stream a `20 ms`.
5. STM responde `0x61` y luego emite `0x90` de 42 bytes.
6. El modelo 3D cambia con `yaw/pitch/roll`.
7. Web inicia IR stream con `0x6B`.
8. STM responde `0x6B` y luego emite `0x91` de 56 bytes.
9. Web renderiza obstaculos, linea y sensores de piso.
10. Web detiene MPU con `0x62` e IR con `0x6C`.
11. Para una accion protegida, Web valida PIN contra ESP, envia grant y confirma por cambio de pantalla STM.

# Flujo WiFi Web / ESP / STM

## Cambios de UI en la Web

- `src/pages/WifiSection.tsx`
  - Se reincorpora la pantalla WiFi completa.
  - Arriba de la card principal aparece un selector flotante `WIFI | AP`.
  - `WIFI` muestra:
    - formulario para conectar el ESP a una red STA,
    - lista de redes detectadas,
    - pedido de detalle por red,
    - envio de credenciales reales al ESP.
  - `AP` muestra:
    - formulario para guardar SSID y password del Access Point del ESP.
- `src/components/SystemResetActions.tsx`
  - Se separan las acciones de reinicio en dos bloques:
    - ESP
    - STM32
  - El bloque ESP agrega un dropdown para:
    - `Reiniciar`
    - `Reiniciar en modo AP`
- `src/contexts/WifiCredentialsContext.tsx`
  - Mantiene el modal global para solicitudes disparadas por el ESP a partir de pedidos originados en STM.

## Comandos Web -> ESP por WebSocket JSON

### 1. Escaneo de redes

Request:

```json
{
  "type": "device.command",
  "payload": {
    "requestId": "<uuid>",
    "target": "esp",
    "command": "wifi.scan.start",
    "params": {}
  }
}
```

Response inmediata recomendada:

```json
{
  "type": "device.response",
  "payload": {
    "command": "wifi.scan.start",
    "ok": true
  }
}
```

Evento con resultados:

```json
{
  "type": "device.event",
  "payload": {
    "event": "wifi.scan.results",
    "origin": "esp",
    "data": {
      "networks": [
        {
          "ssid": "MiWifi",
          "signalStrength": -48,
          "encryptionType": 3,
          "channel": 6
        }
      ]
    }
  }
}
```

## 2. Detalle de una red

Request:

```json
{
  "type": "device.command",
  "payload": {
    "requestId": "<uuid>",
    "target": "esp",
    "command": "wifi.detail.get",
    "params": {
      "ssid": "MiWifi"
    }
  }
}
```

Response o evento:

```json
{
  "type": "device.response",
  "payload": {
    "command": "wifi.detail.get",
    "ok": true,
    "data": {
      "ssid": "MiWifi",
      "signalStrength": -48,
      "encryptionType": 3,
      "channel": 6
    }
  }
}
```

o

```json
{
  "type": "device.event",
  "payload": {
    "event": "wifi.detail.result",
    "origin": "esp",
    "data": {
      "ssid": "MiWifi",
      "signalStrength": -48,
      "encryptionType": 3,
      "channel": 6
    }
  }
}
```

## 3. Credenciales STA desde la WiFi Section o desde el modal global

Submit:

```json
{
  "type": "device.command",
  "payload": {
    "requestId": "<uuid>",
    "target": "esp",
    "command": "wifi.credentials.submit",
    "params": {
      "ssid": "MiWifi",
      "password": "ClaveReal123"
    }
  }
}
```

Cancel:

```json
{
  "type": "device.command",
  "payload": {
    "requestId": "<uuid>",
    "target": "esp",
    "command": "wifi.credentials.cancel",
    "params": {
      "ssid": "MiWifi"
    }
  }
}
```

Resultado final:

```json
{
  "type": "device.event",
  "payload": {
    "event": "wifi.credentials.result",
    "origin": "esp",
    "data": {
      "status": "success",
      "ssid": "MiWifi",
      "ip": "192.168.1.50"
    }
  }
}
```

Estados admitidos:

- `success`
- `failed`
- `timeout`
- `cancelled`

## 4. Guardado de credenciales AP

Request:

```json
{
  "type": "device.command",
  "payload": {
    "requestId": "<uuid>",
    "target": "esp",
    "command": "wifi.ap.credentials.set",
    "params": {
      "ssid": "AutoMicro_AP",
      "password": "ClaveAP123"
    }
  }
}
```

Response:

```json
{
  "type": "device.response",
  "payload": {
    "command": "wifi.ap.credentials.set",
    "ok": true,
    "data": {
      "message": "Credenciales AP guardadas"
    }
  }
}
```

## 5. Solicitud de credenciales originada en STM

STM -> ESP:

- `CMD 0x12 SET_CREDENTIALS`
- payload:

```text
[1, ssid_len, ssid..., 11, "connRequest"]
```

Interpretación:

- `target = 1` indica STA.
- `"connRequest"` no es password real.
- El ESP no debe persistir esa cadena.
- El ESP no debe intentar conectar con esa cadena.
- El ESP debe abrir una solicitud pendiente en RAM y responder `OK` a STM.

ESP -> Web:

```json
{
  "type": "device.event",
  "event": "wifi.credentials.requested",
  "ssid": "MiWifi"
}
```

o con envelope:

```json
{
  "type": "device.event",
  "payload": {
    "event": "wifi.credentials.requested",
    "origin": "esp",
    "data": {
      "ssid": "MiWifi"
    }
  }
}
```

La web abre el modal global aunque el usuario esté en otra pantalla.

## Comandos binarios propuestos / actualizados en firmware

## A. Nuevo `WIFI_GET_DETAIL`

Código elegido:

- `0x1A`

Motivo:

- `0x10` a `0x19` ya tienen comandos ocupados.
- `0x1A` queda libre y sigue dentro del bloque WiFi/sistema ya usado.

Request binario propuesto:

```text
CMD = 0x1A
payload = [ssid_len, ssid...]
```

Response binaria propuesta en el mismo `CMD 0x1A`:

```text
[ssid_len, ssid..., signalStrength_i8, encryptionType_u8, channel_u8]
```

Campos:

- `ssid_len`: longitud del SSID
- `ssid`: nombre de la red
- `signalStrength_i8`: RSSI en dBm
- `encryptionType_u8`: tipo de cifrado
- `channel_u8`: canal detectado

Mapeo sugerido de `encryptionType`:

- `0 = OPEN`
- `1 = WEP`
- `2 = WPA`
- `3 = WPA2`
- `4 = WPA3`
- `5 = WPA/WPA2`

## B. `REBOOT_ESP` con payload de boot mode

Código existente:

- `0x16`

Nuevo payload:

```text
[boot_mode]
```

Valores:

- `0x00 = reinicio normal`
- `0x01 = reinicio en modo AP`

Esto permite que la web, desde Configuración, le pida al ESP que reinicie
forzando el arranque AP si hace falta recuperar conectividad.

## Implementación sugerida en ESP

1. Mantener un dispatcher WebSocket para:
   - `wifi.scan.start`
   - `wifi.detail.get`
   - `wifi.credentials.submit`
   - `wifi.credentials.cancel`
   - `wifi.ap.credentials.set`

2. Cuando llega `wifi.scan.start`:
   - disparar scan o devolver cache,
   - emitir `wifi.scan.results`.

3. Cuando llega `wifi.detail.get`:
   - si la red está en cache, devolver detalle,
   - si no está, responder error o reescanear según política.

4. Cuando llega `wifi.credentials.submit`:
   - validar SSID/password,
   - guardar en RAM o NVS según diseño,
   - conectar el ESP localmente,
   - nunca reenviar la password a STM32.

5. Cuando la solicitud vino desde STM con `connRequest`:
   - guardar la solicitud pendiente en RAM,
   - emitir `wifi.credentials.requested`,
   - esperar `wifi.credentials.submit` desde la Web.

6. Cuando llega `wifi.ap.credentials.set`:
   - guardar SSID/password AP en NVS,
   - responder por `device.response`.

7. Cuando llega `REBOOT_ESP 0x16 [boot_mode]`:
   - persistir el modo de arranque si aplica,
   - reiniciar el ESP,
   - al boot decidir entre arranque normal o AP según `boot_mode`.

## Cambios necesarios en STM32

STM32 no necesita conocer la password real cuando la web conecta el ESP a una red.

STM sí debe seguir:

1. enviando `CMD 0x12 SET_CREDENTIALS` con `connRequest` cuando necesite que la web complete la clave;
2. esperando un `OK` inmediato del ESP al abrir la solicitud pendiente;
3. dejando que la resolución real de la conexión quede del lado ESP/Web.

STM no necesita implementar `WIFI_GET_DETAIL` si el scan y detalle viven sólo en ESP.

Si el proyecto decide que STM también debe consultar detalles, entonces STM tendría que:

- agregar el `CMD 0x1A` a su enum,
- enviar `[ssid_len, ssid...]`,
- parsear la response `[ssid_len, ssid..., signalStrength_i8, encryptionType_u8, channel_u8]`.

## Seguridad

- La password no se guarda en `localStorage` ni `sessionStorage`.
- La password no debe aparecer en logs.
- La password no debe reenviarse a STM32 para el flujo de conexión Web -> ESP.

# Flujo de auth remota Web / ESP / STM

## Objetivo

La web necesita cubrir dos cosas distintas sin mezclarlas:

- autenticar al operador web contra la ESP por PIN;
- conceder una solicitud de permiso pendiente en la STM solo despues de que esa auth remota ya fue validada.

En el frontend esto se modela como:

1. `login` de la web -> valida PIN remoto en ESP.
2. `screen.current` / `screen.changed` -> fuente de verdad de la UI STM.
3. `validateScreen` -> revalida PIN remoto cuando la STM esta en una pantalla de permiso.
4. `grant` -> destraba la solicitud pendiente en la STM.

## Flujo recomendado

1. La web abre WebSocket, ejecuta `verifySession` y, si hace falta, hace login.
2. La web pide `stm.screen.getCurrent` y luego escucha `screen.current` y `screen.changed`.
3. Si el operador quiere loguearse remoto con PIN, la web manda a la ESP `esp.auth.pin.login`.
4. Si el login remoto da OK, la web marca al operador como autenticado remotamente.
5. Cuando la STM entra en `0x080104` con `sourceName = "PERMISSION"`, la web sabe que hay una solicitud grantable.
6. Si la politica exige revalidacion para esa pantalla, la web manda `esp.auth.pin.validateScreen`.
7. Si la ESP responde OK, la web manda a la STM `stm.auth.pin.grant`.
8. La web no da por exitoso el grant al enviarlo: espera el siguiente `screen.changed` o `screen.current` para confirmar el estado real.

## Comandos JSON propuestos

### ESP auth

#### `esp.auth.pin.login`

Request:

```json
{
  "type": "device.command",
  "payload": {
    "requestId": "<uuid>",
    "target": "esp",
    "command": "esp.auth.pin.login",
    "params": {
      "pin": "1234"
    }
  }
}
```

Response sugerida:

```json
{
  "type": "device.response",
  "payload": {
    "requestId": "<uuid>",
    "command": "esp.auth.pin.login",
    "ok": true,
    "data": {
      "action": 1,
      "code": 0
    }
  }
}
```

#### `esp.auth.pin.validateScreen`

Request:

```json
{
  "type": "device.command",
  "payload": {
    "requestId": "<uuid>",
    "target": "esp",
    "command": "esp.auth.pin.validateScreen",
    "params": {
      "pin": "1234"
    }
  }
}
```

Response sugerida:

```json
{
  "type": "device.response",
  "payload": {
    "requestId": "<uuid>",
    "command": "esp.auth.pin.validateScreen",
    "ok": true,
    "data": {
      "action": 3,
      "code": 0
    }
  }
}
```

## STM auth

#### `stm.auth.pin.grant`

Request:

```json
{
  "type": "device.command",
  "payload": {
    "requestId": "<uuid>",
    "target": "stm",
    "command": "stm.auth.pin.grant",
    "params": {
      "screenCode": 524548
    }
  }
}
```

`screenCode` corresponde a `0x080104` y debe viajar en decimal JSON o como string hexadecimal si el bridge ya lo normaliza.

## Inputs remotos opcionales STM

Estos wrappers permiten operar la UI STM como si se tocara el hardware:

- `stm.input.rotateLeft`
- `stm.input.rotateRight`
- `stm.input.encoderButton`
- `stm.input.userButton`

Params sugeridos:

- rotaciones: `{ "screenCode": 524548 }`
- botones: `{ "screenCode": 524548, "pressKind": "short" | "long" }`

## Fuente de verdad de la UI STM

La web no debe inferir el resultado solo por un ACK del bridge. Debe esperar la pantalla real publicada por la STM:

- `0x080104` + `PERMISSION`: entry
- `0x080105` + `PERMISSION`: waiting
- `0x080106`: denied
- `0x080107`: timeout
- `0x080108`: blocked
- cualquier pantalla no-permission posterior: flujo continuado

## Compatibilidad actual del frontend

Hoy este repo mantiene compatibilidad hacia atras:

- auth remota ESP:
  - default: `device.command` JSON hacia la ESP (`esp.auth.pin.login` / `esp.auth.pin.validateScreen`)
  - fallback explicito: `VITE_REMOTE_AUTH_BRIDGE_MODE=uner` para volver a `APP_PIN_CONFIG (0x60)` por UNER raw
- comandos remotos STM:
  - default: hex legacy `0x53`..`0x59`
  - opcional: `VITE_STM_REMOTE_COMMAND_MODE=json`

Mientras el bridge JSON no exponga estos wrappers, el comportamiento por defecto sigue siendo el legacy.

## Validacion cerrada contra ESP y STM

La UI considera cerrado el flujo solo si se cumplen las dos validaciones:

1. ESP confirma el PIN remoto (`esp.auth.pin.validateScreen` o fallback UNER).
2. STM confirma el efecto del grant con un cambio de pantalla real.

Detalles implementados:

- `ScreenProvider` acepta frames raw `EVT_SCREEN_CHANGED (0x95)` y `EVT_MENU_SELECTION_CHANGED (0x96)`.
- `ScreenStreamWorkspace` envia `AUTH_PIN_GRANTED (0x59)` con `screen_code_le32` o el wrapper `stm.auth.pin.grant`.
- El modal de PIN queda en espera hasta que la pantalla salga de `PIN_ENTRY` / `PIN_WAITING`.
- Si STM reporta `PIN_DENIED`, `PIN_TIMEOUT`, `PIN_BLOCKED` o `PERMISSION_DENIED`, la UI trata el grant como fallido.

Esto evita dar por bueno un `granted` solo por ACK del bridge.

## Respuesta rapida ante PIN incorrecto

La ESP no debe dejar vencer el timeout cuando el PIN es incorrecto. Debe responder inmediatamente con un resultado negativo explicito para que la UI pueda ocultar los inputs y mostrar "PIN incorrecto" con boton de reintento.

Formato JSON recomendado:

```json
{
  "type": "device.response",
  "payload": {
    "requestId": "<mismo requestId>",
    "command": "esp.auth.pin.validateScreen",
    "ok": false,
    "code": "INVALID_PIN",
    "data": {
      "code": 1,
      "status": "invalid_pin",
      "attemptsLeft": 2
    }
  }
}
```

Tambien es compatible responder `ok=true` como ACK de transporte si `data.code=1`; la UI prioriza `code/status` sobre `ok`.

Para el fallback UNER `APP_PIN_CONFIG (0x60)`, la respuesta debe ser:

```text
[action, code]
```

con `code=1` para `INVALID_PIN`. El timeout queda reservado para perdida real de respuesta o enlace.

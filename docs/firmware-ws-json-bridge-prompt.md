# Prompt para implementar JSON entrante por WebSocket en firmware

```text
Necesito que implementes en el firmware de la ESP una capa de entrada/salida por WebSocket que acepte JSON entrante real, lo decodifique, decida si el comando es para la propia ESP o para la STM, y actúe como traductor entre la app web y el protocolo interno/UNER.

Contexto actual del firmware:
- Hoy `/ws` está siendo usado principalmente como canal de salida de telemetría.
- El firmware actual no parsea `WS_TEXT`: cuando entra texto por WebSocket se ignora.
- El único `deserializeJson` actual del proyecto no corresponde al WebSocket, sino a `config.json`.
- Quiero cambiar eso: `/ws` debe pasar a ser un canal full duplex para control + datos + eventos.

Objetivo funcional:
- La app web va a enviar JSON por WebSocket.
- El firmware debe leer esos JSON entrantes, validarlos y rutearlos.
- Si el comando es local de la ESP, debe ejecutarlo localmente y enviar la notificacion de vento a la STM para actualizar en pantalla
- Si el comando es para la STM, debe mapearlo a UNER y reenviarlo a la STM.
- Esta capa además debe transformar eventos y datos internos en mensajes JSON legibles para la UI, porque esta es la capa que conecta lo visual del cliente con el firmware.

Importante:
- Te dejamos adjuntos estos mismos documentos para usar como fuente de verdad:
  - `telemetry-session-protocol.md`
  - `websocket-firmware-contract.md`
  - `wifi-firmware-payloads.md`
- Léelos y tomalos como referencia obligatoria para payloads, eventos y contratos actuales de la app.

Requerimientos de implementación:

1. WebSocket `/ws`
- Mantener `/ws` como endpoint único.
- Soportar `WS_TEXT` para entrada JSON desde la app.
- Mantener salida de datos/eventos por el mismo socket.
- No romper la telemetría saliente existente: integrarla dentro de esta nueva capa.

2. Parseo de JSON entrante
- Implementar parseo real de `WS_TEXT`.
- Definir un límite explícito para el JSON entrante por WebSocket, independiente del límite UNER hacia la STM.
- Usa un límite explícito y razonable, por ejemplo `1024 bytes` máximo por mensaje JSON de entrada.
- Si el mensaje supera ese tamaño, responder error JSON y no procesarlo.
- Si el JSON es inválido, responder error JSON y no procesarlo.
- No usar `deserializeJson` sobre buffers sin control de tamaño.
- El flujo debe ser:
  1. recibir texto WS
  2. verificar tamaño
  3. copiar a buffer seguro y null-terminated
  4. deserializar JSON
  5. validar campos obligatorios
  6. decidir destino ESP o STM
  7. ejecutar/matchear
  8. responder por WS

3. Envelope JSON sugerido
- Quiero una estructura clara y estable. Usa este modelo:

Entrada desde la app:
```json
{
  "type": "device.command",
  "payload": {
    "requestId": "abc-123",
    "target": "esp",
    "command": "esp.telemetry.setRate",
    "params": {
      "periodMs": 500
    }
  }
}
```

Respuesta:
```json
{
  "type": "device.response",
  "payload": {
    "requestId": "abc-123",
    "target": "esp",
    "command": "esp.telemetry.setRate",
    "ok": true,
    "code": "OK",
    "message": "Telemetry updated",
    "data": {}
  }
}
```

Evento/dato asíncrono:
```json
{
  "type": "device.event",
  "payload": {
    "event": "telemetry.data",
    "origin": "esp",
    "requestId": "abc-123",
    "data": {}
  }
}
```

4. Validaciones mínimas del JSON
- Verificar que exista `type`.
- Aceptar sólo `type = "device.command"` para comandos entrantes.
- Verificar `payload`.
- Verificar `requestId`.
- Verificar `target`.
- Verificar `command`.
- Verificar `params` cuando corresponda.
- Si falta algo o el formato no coincide, devolver error estructurado por WebSocket.

5. Routing ESP vs STM
- El firmware debe distinguir explícitamente si un comando es:
  - local de la ESP
  - para forwarding hacia la STM

Regla:
- `target = "esp"`: handler local
- `target = "stm"`: bridge hacia STM usando UNER

6. Límite especial para STM
- Cuando el comando vaya hacia la STM, el máximo total a mandar por UNER es `254 bytes` para evitar overflow.
- Este chequeo explícito debe hacerse sólo en el camino `target = "stm"`.
- No aplicar esa restricción como límite general del JSON del WebSocket.
- Quiero una validación explícita del tamaño final del frame UNER antes de transmitirlo a la STM.
- Si supera `254 bytes` totales, devolver error al cliente y no transmitir.

7. Registro/tabla de comandos
- Implementar una tabla de comandos JSON que indique:
  - nombre JSON
  - target por defecto
  - si es local o forward
  - función validadora de params
  - función encoder params -> payload UNER o llamada local
  - función decoder de respuesta/evento -> JSON de salida

8. Casos que debe cubrir sí o sí

8.1 Control de motores
- Debe poder recibir comandos JSON visuales de control y traducirlos a comandos UNER para la STM.
- Este es un caso `target = "stm"`.
- Aplicar aquí el chequeo explícito de `254 bytes` del frame UNER total.
- Debe poder responder a la UI si el comando fue aceptado, rechazado o si hubo error de tamaño.

8.2 Escaneo de datos / telemetría
- Debe aceptar comandos JSON relacionados con iniciar, actualizar o detener telemetría.
- Debe mapearlos al contrato documentado en `telemetry-session-protocol.md`.
- Debe soportar:
  - inicio temporizado
  - inicio constante
  - actualización de período
  - finalizador explícito
- Debe emitir hacia la UI:
  - ack de telemetría
  - datos de telemetría
  - fin por timeout o detención manual si corresponde

8.3 Wi-Fi
- Debe aceptar JSON para operaciones Wi-Fi y mapearlas a las estructuras reales del firmware.
- Para AP y STA, respetar exactamente los payloads documentados en `wifi-firmware-payloads.md`.
- Debe cubrir:
  - get mode
  - get scan
  - set AP
  - set STA
  - ACK Wi-Fi
  - eventos y datos relevantes para la UI

8.4 Eventos
- Esta capa debe ser capaz de emitir eventos JSON hacia la UI cuando:
  - cambie estado Wi-Fi
  - haya ACK/NACK
  - lleguen datos de telemetría
  - lleguen eventos desde STM
  - un comando a STM termine, falle o sea rechazado

9. Conversión de salida a JSON
- La app web necesita una capa visual estable.
- Entonces, además del parseo entrante, quiero que la ESP convierta salidas internas a JSON semántico.
- No limitarse a reenviar bytes si la UI necesita datos interpretables.
- La salida debe ser consistente y pensada para frontend.

10. Compatibilidad con los documentos adjuntos
- `telemetry-session-protocol.md`: usar para mapear telemetría, ack, stream, finalizador y límites temporizados.
- `wifi-firmware-payloads.md`: usar para payloads exactos AP/STA.
- `websocket-firmware-contract.md`: usar para entender el contrato actual de la app, sus expectativas y el estado real del WebSocket.
 `UNER_STM32_ESP_PROTOCOL_GUIDE.md`: usar para entender el contrato actual de la STM32 con la ESP, sus expectativas y el estado del auto del lado del firmware de la stm

11. Entregables que necesito
- Diseño modular propuesto para firmware.
- Estructuras de datos sugeridas para:
  - mensaje JSON entrante
  - respuesta JSON
  - evento JSON
  - tabla de comandos
- Pseudocódigo del dispatcher principal.
- Pseudocódigo del parser de `WS_TEXT`.
- Pseudocódigo de la decisión `ESP local` vs `STM`.
- Validaciones por comando.
- Estrategia de errores.
- Estrategia de límites:
  - límite del JSON entrante por WS
  - límite del frame UNER total a STM = `254 bytes`
- Ejemplos completos de mensajes JSON de entrada y salida.
- Ejemplos concretos para:
  - control de motores
  - telemetría
  - Wi-Fi AP
  - Wi-Fi STA
  - eventos

12. Errores estándar sugeridos
- `ERR_JSON_TOO_LARGE`
- `ERR_JSON_INVALID`
- `ERR_UNKNOWN_TYPE`
- `ERR_UNKNOWN_COMMAND`
- `ERR_BAD_PARAMS`
- `ERR_TARGET_INVALID`
- `ERR_STM_FRAME_TOO_LARGE`
- `ERR_UNER_BUILD_FAILED`
- `ERR_STM_TIMEOUT`
- `ERR_INTERNAL`

13. Restricciones importantes
- No inventar payloads Wi-Fi distintos a los adjuntos.
- No romper telemetría existente; integrarla a esta capa.
- No usar el mismo límite de STM como límite del JSON WS.
- El chequeo de `254 bytes` debe ser explícito y sólo para comandos dirigidos a STM.
- La capa debe servir de puente bidireccional entre:
  - UI visual
  - lógica local ESP
  - protocolo UNER hacia STM

14. Resultado esperado
- Quiero que `/ws` pase de ser un canal casi sólo saliente a un canal full duplex real.
- Quiero que la web pueda mandar JSON y que el firmware:
  - lo lea
  - lo decodifique
  - lo valide
  - sepa si es para ESP o STM
  - ejecute o traduzca
  - responda a la UI en JSON
  - publique eventos y datos de forma consistente

En resumen:
Implementar una capa de transporte/aplicación sobre WebSocket que haga de traductor entre JSON de la web y operaciones locales ESP o UNER hacia STM, usando los documentos adjuntos como contrato técnico base.
```

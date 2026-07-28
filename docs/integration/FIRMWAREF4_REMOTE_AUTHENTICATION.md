# Autenticacion local y sesiones remotas

Fecha de contrato: 2026-07-12.

La autoridad del PIN es FirmwareF4. El ESP conserva autenticacion y roles por
WebSocket, pero ya no decide por si solo si el PIN es correcto.

```text
Web ingresa PIN
  -> ESP valida forma y correlacion
  -> ESP envia AUTH_VALIDATE_PIN a F4
  -> F4 compara con su preferencia local
  -> F4 abre sesion del nodo y responde
  -> ESP abre la sesion WebSocket correspondiente
  -> Web recibe response/evento tipado
```

## Propiedad y almacenamiento

- PIN de cuatro digitos `0..9`.
- Default de migracion: `1234`.
- Persistido en el registro V5 de `app_preferences`.
- Nunca sale en `GET_PREFERENCES`, descriptors, logs o telemetria.
- Los intentos, bloqueos y sesiones son RAM; no desgastan Flash.
- Un cambio de PIN exige conocer el actual y revoca permisos/sesiones previos.

## Identidad de sesiones

UNER solo dispone de cuatro bits de nodo. Se reservan:

| Nodo | Uso |
| ---: | --- |
| `0x1` | MCU/F4 |
| `0x2` | PC/Qt por USB |
| `0x3` | ESP/broker y compatibilidad Web anterior |
| `0x4` | nRF reservado |
| `0x5..0xC` | ocho conexiones WebSocket, una por nodo |
| `0xF` | broadcast |

El ESP asigna un nodo `0x5..0xC` al aceptar cada WebSocket y no lo reutiliza
hasta cerrar/revocar la sesion anterior. F4 responde por el mismo transporte y
al `src` original, por lo que no necesita rutas estaticas para esos nodos.

El nodo `0x3` sigue aceptando autenticacion para una migracion controlada, pero
es una identidad compartida y no aisla WebSockets. En produccion queda reservado
al broker/control plane. El ESP asigna `0x5..0xC` del lado servidor y nunca
acepta un `src` elegido por el navegador o Protocol Studio.

## `0x51 AUTH_VALIDATE_PIN`

Todos los digitos viajan como valores binarios `0..9`, no ASCII.

### Scope 0: login de sesion

Request, 6 bytes:

| Offset | Tipo | Campo |
| ---: | --- | --- |
| 0 | u8 | `auth_request_id`, 1..255 |
| 1 | u8 | scope `0` |
| 2..5 | u8[4] | digitos PIN `0..9` |

### Scope 1: conceder permiso local desde Web

Request, 10 bytes:

| Offset | Tipo | Campo |
| ---: | --- | --- |
| 0 | u8 | `auth_request_id` |
| 1 | u8 | scope `1` |
| 2..5 | u8[4] | digitos PIN |
| 6 | u32 LE | `screen_code` observado por la Web |

F4 exige que exista un `Permission_Request()` local pendiente y que el codigo
coincida con la pantalla actual. Si el PIN es correcto, restaura la pantalla,
ejecuta la continuacion protegida y muestra `Autenticado remoto`. Esta
validacion tambien abre o renueva la sesion remota del nodo solicitante.

### Scope 2: cambiar PIN

Request, 10 bytes:

| Offset | Tipo | Campo |
| ---: | --- | --- |
| 0 | u8 | `auth_request_id` |
| 1 | u8 | scope `2` |
| 2..5 | u8[4] | PIN actual |
| 6..9 | u8[4] | PIN nuevo |

F4 valida el actual, persiste V5, revoca sesiones/permisos anteriores y vuelve
a abrir solamente la sesion solicitante con el PIN nuevo. Ante un error de
programacion intenta restaurar el PIN anterior en un slot nuevo y mantiene el
valor anterior en RAM. Como todo log en un unico sector, un corte de energia o
fallo fisico durante erase/program no ofrece garantia transaccional entre
reinicios; el ESP debe informar el NACK y no asumir que el cambio ocurrio.

### Response `0x51`

Response, 9 bytes:

| Offset | Tipo | Campo |
| ---: | --- | --- |
| 0 | u8 | status `0=procesado` |
| 1 | u8 | `auth_request_id` |
| 2 | u8 | scope |
| 3 | u8 | granted `0/1` |
| 4 | u32 LE | `ttl_ms`; cero si fue rechazado |
| 8 | u8 | intentos restantes |

PIN incorrecto no es un error de transporte: devuelve status 0, `granted=0` y
el contador actualizado. Los errores estructurales usan NACK.

## NACK de autenticacion

| Status | Significado |
| ---: | --- |
| 1 | payload/formato invalido |
| 2 | scope no soportado |
| 3 | `screen_code` no coincide |
| 4 | no hay permiso local pendiente |
| 5 | fallo de persistencia o transporte no soportado, segun contexto previo |
| 6 | comando de grant antiguo/deprecado |
| 7 | sesion F4 requerida |
| 8 | input remoto bloqueado durante ingreso local de PIN |
| 9 | origen reservado/invalido para un evento ESP |

## `0x5D AUTH_REMOTE_RESULT` como control de sesion

El significado anterior de resultado calculado por ESP queda reemplazado por
control de sesion F4.

Request de 1 byte:

- `0`: logout/revoke del nodo origen.
- `1`: query.

Response de 6 bytes:

```text
status:u8, authenticated:u8, ttl_remaining_ms:u32 LE
```

## `0x59 AUTH_PIN_GRANTED`

El flujo antiguo permitia que ESP afirmara que el PIN era correcto sin que F4
lo viera. F4 registra temporalmente requests de cuatro bytes solo para responder
NACK status 6 `deprecated`. No concede permisos ni sesiones.

El aviso de exito para la Web se deriva de la response `0x51`; el ESP publica un
evento JSON como `auth.session.granted`. No se envia un segundo frame UART. Las
responses `0x51`, `0x5D` y sus NACK usan una cola F4 dedicada y se reintentan
cuando la TX DMA esta ocupada, antes de reanudar telemetria.

## TTL, intentos y bloqueo

- Sesion remota: 60 segundos.
- TTL deslizante: cada comando protegido aceptado renueva 60 segundos.
- Intentos: 3 por nodo.
- Al llegar a cero: bloqueo de 60 segundos por nodo.
- Reboot F4 limpia todas las sesiones.
- Evento boot ESP o perdida de alive limpia todas las sesiones remotas.
- Logout/disconnect envia `0x5D action=0` para su nodo.
- Cambiar PIN revoca permisos locales y sesiones remotas anteriores.
- Al expirar o revocar la sesion se detienen los streams MPU/IR cuyo owner era
  ese nodo.

El bloqueo F4 por nodo no reemplaza rate limiting por IP en ESP: reconectar
puede asignar otro nodo.

## Guard de comandos

Por UART quedan publicos:

- `0x31 PING`;
- `0x51 AUTH_VALIDATE_PIN`;
- `0x59` solo para NACK deprecated;
- `0x5D` logout/query;
- `0x68/0x69` identidad y build para handshake.

Requests Web hacia otros handlers F4 requieren una sesion activa. Si falta,
F4 responde NACK status 7. ACK/NACK y responses que F4 esperaba del nodo `0x3`
siguen pasando para no romper WiFi, assets o credenciales. Los eventos ESP solo
se aceptan con `src=0x3`; un cliente `0x5..0xC` no puede inyectar boot, WiFi o
eventos de conexion.

Mientras hay ingreso local de PIN, `0x53..0x58` se rechazan con status 8 aunque
el nodo tenga sesion: la Web nunca puede rotar digitos ni confirmar el PIN
fisico mediante eventos de UI. Debe usar scope 1 y enviar el PIN completo.

USB/Qt conserva el contrato anterior y no depende de la sesion Web.

## Flujo local

`Permission_Request()` ya no concede automaticamente:

1. guarda pantalla y handler actuales;
2. muestra ingreso de cuatro digitos;
3. el giro del encoder cambia el digito, un click corto avanza la posicion y
   mantener el encoder confirma/envia;
4. compara en F4 con la misma preferencia que usa Web;
5. concede la politica temporal o muestra rechazo/bloqueo;
6. restaura la UI y ejecuta la continuacion solo tras exito.

El boton USER corto o largo cancela sin consumir intento, restaura la pantalla
anterior y nunca confirma el PIN. La ayuda inferior usa USER + flecha para
volver y encoder con `Camb/Enviar`. Un PIN rechazado se reintenta con click o
manteniendo el encoder; durante bloqueo solo USER vuelve.

Los intentos fallidos se conservan aunque el operador cancele o venza el
formulario; cerrar y reabrir no recupera intentos. El presupuesto se reinicia
tras PIN correcto, cambio valido de PIN o al finalizar los 60 segundos de
bloqueo.

El formulario vence tras 60 segundos sin completar. Tres errores lo bloquean
durante 60 segundos incluso si se cierra y vuelve a abrir. USER cancela primero
el flujo de permiso, sin dejar el gestor en estado busy. Las notificaciones
OLED quedan suspendidas mientras el formulario posee la UI.

Las politicas estan declaradas para reset ESP, factory reset, credenciales
WiFi, test de motores, configuracion y modo TEST. En este corte los guards ya
estan conectados en reset ESP y modo TEST; los demas callers deben adoptar
`Permission_Request()` antes de considerarse protegidos.

## Responsabilidades ESP y Web

ESP:

- mantiene autenticacion por WebSocket y roles por conexion;
- nunca valida el PIN contra su `/config.json`;
- asigna nodo UNER por cliente;
- ignora/rechaza cualquier `src` UNER enviado por la Web;
- convierte string de cuatro digitos a valores `0..9`;
- conserva `requestId` JSON y usa `auth_request_id` para el wire;
- marca sesion activa solo tras response F4 granted;
- no guarda ni imprime el PIN;
- envia logout antes de reutilizar un nodo;
- detiene/unsubscribe streams antes de logout y reconcilia suscripciones de
  multiples clientes con el unico owner MPU y el unico owner IR disponibles en
  F4;
- aplica rate limiting y una sola transaccion UART MCU en vuelo.

Web:

- conserva Login, modal de PIN, validacion de pantalla y cambio de PIN;
- deja de enviar `stm.auth.pin.grant`/`0x59`;
- espera la response final F4 atraves del ESP;
- muestra TTL, intentos, bloqueo y origen `stm32`;
- elimina fallback `APP_PIN_CONFIG=0x60` y logs de PIN.

## Limite de seguridad

El PIN viaja en claro por WebSocket y UART. UART es un enlace fisico local, pero
HTTP/WS sin TLS permite captura en la red. Si el ESP8266 no puede ofrecer TLS,
la documentacion y la UI no deben afirmar confidencialidad; se requiere una red
confiable y rate limiting.

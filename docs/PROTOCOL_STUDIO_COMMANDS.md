# Catálogo de Protocol Studio

Fecha: 2026-10-02. El selector y el traductor Web consumen `src/features/protocolStudio/commandManifest.json`. Contracts guarda la fotografía en `catalog/protocol-studio.json`.

Cada entrada incluye ID, nombre, dueño, longitudes separadas de request/response, finalización, timeout de registro, permiso, sensibilidad, esquema, campos y cobertura. `form` permite campos tipados; `raw` requiere bytes explícitos. Los declarados/rechazados se leen pero no generan solicitudes. La disponibilidad refleja código inspeccionado, no prueba física.

Para futuras revisiones, ejecutar en Web `npm run protocol:inventory`: informa IDs operativos nuevos sin asignar, renombrados, payloads manuales, declarados y excepciones de handlers. No se ejecuta automáticamente al compilar. No sustituye una revisión de cambios de formato/transportes.

## Uso y comportamiento

- Requests: origen cliente/MCU, destino dueño del comando. Respuestas: invertir ruta y introducir el payload manual; los formularios representan requests/eventos.
- Enteros multibyte y float32 se codifican little endian. Códigos de pantalla se ingresan como un entero hex de 8 dígitos; ejemplo `00050417` produce `17 04 05 00`.
- PIN: cuatro valores numéricos 0..9, nunca cuatro bytes ASCII. No guardar secretos reales en ejemplos.
- La longitud y dirección determinan el esquema de solicitud/respuesta; un request SET con datos sigue siendo request. ACK intermedio no termina un ACK_THEN_SAME_COMMAND.
- Giro 57/58 reproduce el evento físico del encoder: en teclado puede cruzar filas y hacer wrap. No se infiere posición de cursor ni texto desde 96. Detalle canónico: `docs/SCREEN_BEHAVIOR.md` de Contracts.
- Studio construye/lee frames UNER; no concede autorización ni convierte comandos internos en endpoints JSON públicos. El ESP asigna el nodo Web real.

## Asignaciones

| ID | Nombre | Destino | Cobertura | Disponibilidad | Request | Response |
| --- | --- | --- | --- | --- | --- | --- |
| 0x10 | SET_MODE_AP | ESP | form | implemented | 0..0 | 1..255 |
| 0x11 | SET_MODE_STA | ESP | form | implemented | 0..0 | 1..255 |
| 0x12 | SET_CREDENTIALS | ESP | form | implemented | 3..98 | 1..255 |
| 0x13 | CLEAR_CREDENTIALS | ESP | form | implemented | 0..0 | 1..1 |
| 0x14 | START_SCAN | ESP | form | implemented | 0..0 | 2..255 |
| 0x15 | GET_SCAN_RESULTS | ESP | form | implemented | 0..0 | 2..255 |
| 0x16 | REBOOT_ESP | ESP | form | implemented | 1..1 | 0..0 |
| 0x17 | FACTORY_RESET | ESP | form | implemented | 0..0 | 1..1 |
| 0x18 | STOP_SCAN | ESP | form | implemented | 0..0 | 1..2 |
| 0x19 | RESET_MCU | F4 | form | implemented | 0..0 | 0..0 |
| 0x1A | WIFI_GET_DETAIL | ESP | form | implemented | 1..33 | 4..36 |
| 0x30 | GET_STATUS | ESP | form | implemented | 0..0 | 18..255 |
| 0x31 | PING_ALIVE | DUAL | form | implemented | 0..16 | 0..16 |
| 0x40 | GET_PREFERENCES | F4 | form | implemented | 0..1 | 1..255 |
| 0x41 | REQUEST_FIRMWARE | ESP | form | implemented | 0..0 | 1..33 |
| 0x42 | ECHO | F4 | form | implemented | 0..255 | 0..0 |
| 0x43 | SET_ENCODER_FAST | ESP | form | esp-handler | 1..1 | 2..2 |
| 0x44 | GET_CONNECTED_USERS | ESP | form | esp-handler | 0..0 | 2..2 |
| 0x45 | GET_USER_INFO | ESP | form | esp-handler | 1..1 | 10..10 |
| 0x46 | GET_INTERFACES_CONNECTED | ESP | form | esp-handler | 0..0 | 5..5 |
| 0x47 | GET_CREDENTIALS | ESP | form | rejected | 0..0 | 1..255 |
| 0x48 | CONNECT_WIFI | ESP | form | implemented | 0..0 | 1..255 |
| 0x49 | DISCONNECT_WIFI | ESP | form | implemented | 0..0 | 1..255 |
| 0x4A | SET_AP_CONFIG | ESP | form | implemented | 8..102 | 1..1 |
| 0x4B | START_AP | ESP | form | implemented | 0..0 | 1..255 |
| 0x4C | STOP_AP | ESP | form | implemented | 0..0 | 1..255 |
| 0x4D | GET_CONNECTED_USERS_MODE | ESP | form | esp-handler | 0..0 | 4..4 |
| 0x4E | SET_AUTO_RECONNECT | ESP | form | implemented | 1..1 | 2..2 |
| 0x51 | AUTH_VALIDATE_PIN | F4 | form | implemented | 6..10 | 9..9 |
| 0x52 | GET_CURRENT_SCREEN | F4 | form | implemented | 0..0 | 5..45 |
| 0x53 | MENU_ITEM_CLICK | F4 | form | implemented | 4..5 | 0..0 |
| 0x54 | TRIGGER_ENCODER_BUTTON | F4 | form | implemented | 4..5 | 0..0 |
| 0x55 | TRIGGER_USER_BUTTON | F4 | form | implemented | 4..5 | 0..0 |
| 0x56 | REQUEST_SCREEN_PAGE | F4 | form | implemented | 5..5 | 0..0 |
| 0x57 | TRIGGER_ENCODER_ROTATE_LEFT | F4 | form | implemented | 4..4 | 0..0 |
| 0x58 | TRIGGER_ENCODER_ROTATE_RIGHT | F4 | form | implemented | 4..4 | 0..0 |
| 0x59 | AUTH_PIN_GRANTED_DEPRECATED | F4 | raw | declared | 4..4 | 0..0 |
| 0x5A | BINARY_ASSET_STREAM | ESP | form | internal-reader | 1..1 | 1..255 |
| 0x5B | GET_CAR_MODE | F4 | form | implemented | 0..0 | 1..1 |
| 0x5C | WIFI_CREDENTIALS_WEB_RESULT | ESP | form | implemented | 2..96 | 0..0 |
| 0x5D | AUTH_REMOTE_RESULT | F4 | form | implemented | 1..1 | 6..6 |
| 0x5E | SET_I2C_POLICY | F4 | form | implemented | 1..1 | 2..2 |
| 0x5F | GET_I2C_POLICY | F4 | form | implemented | 0..0 | 2..2 |
| 0x60 | GET_MPU_SNAPSHOT | F4 | form | implemented | 0..0 | 42..42 |
| 0x61 | SET_MPU_STREAM | F4 | form | implemented | 1..3 | 4..4 |
| 0x62 | STOP_MPU_STREAM | F4 | form | implemented | 0..0 | 1..1 |
| 0x63 | SET_PREFERENCES | F4 | form | implemented | 4..64 | 5..5 |
| 0x64 | GET_TELEMETRY_SNAPSHOT | F4 | form | implemented | 0..0 | 92..92 |
| 0x65 | GET_BALANCE_PID | F4 | form | implemented | 0..0 | 13..13 |
| 0x66 | SET_BALANCE_PID | F4 | form | implemented | 5..13 | 14..14 |
| 0x67 | GET_CONTROL_SNAPSHOT | F4 | form | implemented | 0..0 | 64..64 |
| 0x68 | GET_FIRMWARE_INFO | F4 | form | implemented | 0..0 | 1..196 |
| 0x69 | GET_BUILD_INFO | F4 | form | implemented | 0..0 | 1..149 |
| 0x6A | GET_IR_SNAPSHOT | F4 | form | implemented | 0..0 | 56..56 |
| 0x6B | SET_IR_STREAM | F4 | form | implemented | 1..3 | 4..4 |
| 0x6C | STOP_IR_STREAM | F4 | form | implemented | 0..0 | 1..1 |
| 0x6D | OLED_CANVAS_TRANSFER | F4 | form | implemented | 3..118 | 10..10 |
| 0x6E | SET_CAR_MODE | F4 | form | implemented | 1..1 | 2..2 |
| 0x6F | GET_BOOT_REPORT | F4 | form | implemented | 0..0 | 22..22 |
| 0x70 | WIFI_CREDENTIALS_FLOW | ESP | form | implemented | 1..255 | 3..255 |
| 0x71 | AP_CLIENTS_PAGE | ESP | form | implemented | 2..2 | 3..255 |
| 0x72 | AP_CLIENT_DISCONNECT | ESP | form | implemented | 6..6 | 2..2 |
| 0x73 | GET_EXTENSION_PROFILE | F4 | form | implemented | 0..0 | 2..2 |
| 0x74 | SET_EXTENSION_PROFILE | F4 | form | implemented | 1..1 | 1..1 |
| 0x75 | GET_EXTENSION_PIN_MAP | F4 | form | declared | 0..0 | 0..0 |
| 0x76 | REBOOT_INTO_PROFILE | F4 | form | implemented | 1..1 | 0..0 |
| 0x77 | GET_AP_CONFIG | F4 | form | implemented | 0..0 | 10..41 |
| 0x78 | SET_AP_CONFIG_F4 | F4 | form | implemented | 1..103 | 3..3 |
| 0x79 | GET_IR_EMITTERS | F4 | form | implemented | 0..0 | 3..3 |
| 0x7A | SET_IR_EMITTERS | F4 | form | implemented | 3..3 | 4..4 |
| 0x80 | EVT_BOOT | ESP | raw | implemented | 0..255 | 0..255 |
| 0x81 | EVT_MODE_CHANGED | ESP | form | implemented | 0..255 | 7..39 |
| 0x82 | EVT_STA_CONNECTED | ESP | form | implemented | 0..255 | 7..39 |
| 0x83 | EVT_STA_DISCONNECTED | ESP | form | implemented | 0..255 | 7..39 |
| 0x84 | EVT_AP_CLIENT_JOIN | ESP | form | implemented | 0..255 | 1..1 |
| 0x85 | EVT_AP_CLIENT_LEAVE | ESP | form | implemented | 0..255 | 1..1 |
| 0x86 | EVT_APP_USER_CONNECTED | ESP | form | implemented | 0..255 | 4..4 |
| 0x87 | EVT_APP_USER_DISCONNECTED | ESP | form | implemented | 0..255 | 4..4 |
| 0x88 | EVT_WEBSERVER_UP | ESP | form | implemented | 0..255 | 0..0 |
| 0x89 | EVT_WEBSERVER_CLIENT_CONNECTED | ESP | form | implemented | 0..255 | 4..4 |
| 0x8A | EVT_WEBSERVER_CLIENT_DISCONNECTED | ESP | form | implemented | 0..255 | 4..4 |
| 0x8B | EVT_LAST_WIFI_NOT_FOUND | ESP | raw | implemented | 0..255 | 0..255 |
| 0x8C | EVT_CONTROLLER_CONNECTED | ESP | raw | implemented | 0..255 | 0..255 |
| 0x8D | EVT_CONTROLLER_DISCONNECTED | ESP | raw | implemented | 0..255 | 0..255 |
| 0x8E | EVT_USB_CONNECTED | ESP | form | implemented | 0..255 | 0..0 |
| 0x8F | EVT_USB_DISCONNECTED | ESP | form | implemented | 0..255 | 0..0 |
| 0x90 | EVT_MPU_STREAM | F4 | raw | implemented | 0..0 | 42..42 |
| 0x91 | EVT_IR_STREAM | F4 | raw | implemented | 0..0 | 56..56 |
| 0x92 | EVT_WIFI_CONNECTED | ESP | raw | implemented | 0..255 | 0..255 |
| 0x93 | EVT_NETWORK_IP | ESP | form | implemented | 5..5 | 5..5 |
| 0x94 | EVT_BOOT_COMPLETE | ESP | form | implemented | 5..5 | 5..5 |
| 0x95 | EVT_SCREEN_CHANGED | F4 | form | implemented | 0..0 | 5..9 |
| 0x96 | EVT_MENU_SELECTION_CHANGED | F4 | form | implemented | 0..0 | 7..7 |
| 0x97 | EVT_CAR_MODE_CHANGED | F4 | form | implemented | 0..0 | 1..1 |
| 0x98 | EVT_IR_EMITTERS_CHANGED | F4 | form | implemented | 0..0 | 3..3 |
| 0x9E | EVT_QT_USB_STATE | F4 | form | implemented | 0..0 | 1..1 |
| 0x9F | EVT_MCU_BOOT_REPORT | F4 | raw | implemented | 0..0 | 22..22 |
| 0xA4 | LEGACY_WIFI_SCAN_STARTED | RESERVED | form | declared | 0..0 | 0..0 |
| 0xA5 | LEGACY_WIFI_SCAN_COMPLETED | RESERVED | form | declared | 0..0 | 0..0 |
| 0xA6 | LEGACY_WIFI_STA_CONNECT_REQUESTED | RESERVED | form | declared | 0..0 | 0..0 |
| 0xA7 | LEGACY_WIFI_STA_DISCONNECT_REQUESTED | RESERVED | form | declared | 0..0 | 0..0 |
| 0xA8 | LEGACY_WIFI_AP_STATE_REQUESTED | RESERVED | form | declared | 0..0 | 0..0 |
| 0xA9 | LEGACY_WEB_COMMAND_REJECTED | RESERVED | form | declared | 0..0 | 0..0 |
| 0xAA | LEGACY_CREDENTIALS_UPDATED | RESERVED | form | declared | 0..0 | 0..0 |
| 0xE0 | ACK | DUAL | form | implemented | 1..2 | 0..0 |
| 0xE1 | NACK | DUAL | form | implemented | 1..2 | 0..0 |

## Diferencias y pendientes explícitos

- Registro ESP marca 43/44/45/46/4D como no implementados; tabla y handlers ESP ejecutan estas operaciones. Studio las incluye con evidencia de la excepción. No implica handler local F4 para 43.
- 47 devuelve NACK UNKNOWN_CMD. 59 está deprecado. 75 solo está declarado. 5A puede interpretarse como transferencia interna recibida por F4; el productor ESP no quedó confirmado y no se ofrece como solicitud operativa.
- 40/41 y PING dependen de destino/transporte. Studio documenta el significado canónico F4 y el alias USB de 41; el catálogo no demuestra equivalencia entre handlers ESP/F4.
- Los eventos ESP variables y servicios con cobertura raw conservan entrada hexadecimal. Los formularios completos de esos formatos quedan pendientes; todos sus IDs sí están asignados.
- Actualizar manifiesto runtime y fotografía Contracts juntos al cambiar un comando. El informe optativo detecta nuevas asignaciones, no verifica automáticamente todos los cambios de bytes.
- El registro ESP tiene 76 antes de 75 aunque usa búsqueda binaria. Corrección de orden pendiente en firmware; esta entrega Web no altera firmware.

## Esquemas por comando

### 0x10 SET_MODE_AP

Request vacío. Respuesta ESP: status inicial + bloque WiFi variable (no asumir IP de 4 bytes solamente).

Finalización: SAME_COMMAND; timeout de registro: 300 ms; permiso: ESP_ADMIN. Evidencia: ESP:src/f4_command_registry.c:23; ESP:src/uner_app_handlers.cpp.

### 0x11 SET_MODE_STA

Request vacío. Respuesta ESP: status inicial + bloque WiFi variable (no asumir IP de 4 bytes solamente).

Finalización: SAME_COMMAND; timeout de registro: 300 ms; permiso: ESP_ADMIN. Evidencia: ESP:src/f4_command_registry.c:24; ESP:src/uner_app_handlers.cpp.

### 0x12 SET_CREDENTIALS

target:u8 (0 AP,1 STA),ssid_len:u8,ssid:utf8,password_len:u8,password:utf8

Finalización: SAME_COMMAND; timeout de registro: 300 ms; permiso: ESP_ADMIN. Evidencia: ESP:src/f4_command_registry.c:25.

### 0x13 CLEAR_CREDENTIALS

Request vacío.

Finalización: ACK_THEN_SAME_COMMAND; timeout de registro: 100 ms; permiso: ESP_ADMIN. Evidencia: ESP:src/f4_command_registry.c:26.

### 0x14 START_SCAN

Request vacío.

Finalización: SAME_COMMAND; timeout de registro: 200 ms; permiso: INTERNAL. Evidencia: ESP:src/f4_command_registry.c:27.

### 0x15 GET_SCAN_RESULTS

Request vacío en el handler ESP. Respuesta variable según el servicio; conservar bytes de diagnóstico.

Finalización: SAME_COMMAND; timeout de registro: 100 ms; permiso: INTERNAL. Evidencia: ESP:src/f4_command_registry.c:28.

### 0x16 REBOOT_ESP

Formato variable: bytes hex explícitos; esquema detallado pendiente de formulario dedicado.

Finalización: ACK; timeout de registro: 50 ms; permiso: ESP_ADMIN. Evidencia: ESP:src/f4_command_registry.c:29.

### 0x17 FACTORY_RESET

Request vacío.

Finalización: ACK_THEN_SAME_COMMAND; timeout de registro: 200 ms; permiso: ESP_ADMIN. Evidencia: ESP:src/f4_command_registry.c:30.

### 0x18 STOP_SCAN

Request vacío.

Finalización: ACK_THEN_SAME_COMMAND; timeout de registro: 100 ms; permiso: INTERNAL. Evidencia: ESP:src/f4_command_registry.c:31.

### 0x19 RESET_MCU

vacío; ACK [19,status] y reset diferido

Finalización: ACK; timeout de registro: 250 ms; permiso: STM_SESSION. Evidencia: ESP:src/f4_command_registry.c:32.

### 0x1A WIFI_GET_DETAIL

ssid_len:u8,ssid:utf8; respuesta: ssid_len,ssid,rssi:i8,encryption:u8,channel:u8

Finalización: SAME_COMMAND; timeout de registro: 150 ms; permiso: INTERNAL. Evidencia: ESP:src/f4_command_registry.c:33.

### 0x30 GET_STATUS

Request vacío. Response: status:u8,ap_active:u8,wifi_active:u8,mode:u8,wifi_status:u8,ipv4[4],ssid_len:u8,ssid:utf8,sta_ip[4],ap_ip[4],ap_ssid_len:u8,ap_ssid,ap_pass_preview_len:u8,ap_pass_preview (hasta 16 bytes),clients:u8. La vista previa de contraseña viaja en UNER físico, no en JSON Web; tratar como sensible.

Finalización: SAME_COMMAND; timeout de registro: 100 ms; permiso: INTERNAL. Evidencia: ESP:src/f4_command_registry.c:37.

### 0x31 PING_ALIVE

Formato variable: bytes hex explícitos; esquema detallado pendiente de formulario dedicado.

Finalización: SAME_COMMAND; timeout de registro: 150 ms; permiso: PUBLIC. Evidencia: ESP:src/f4_command_registry.c:38.

### 0x40 GET_PREFERENCES

vacío = snapshot 40+ssid_len; index:u8 = descriptor. No es la antigua lista de SSID.

Finalización: ACK_THEN_SAME_COMMAND; timeout de registro: 100 ms; permiso: STM_SESSION. Evidencia: ESP:src/f4_command_registry.c:41.

### 0x41 REQUEST_FIRMWARE

Request vacío en el handler ESP. Alias USB F4 de firmware; por UART pertenece al ESP. Interpretar según destino/transporte.

Finalización: ACK_THEN_SAME_COMMAND; timeout de registro: 200 ms; permiso: INTERNAL. Evidencia: ESP:src/f4_command_registry.c:42.

### 0x42 ECHO

Notificación OLED en F4; no devuelve el payload como eco. Para eco usar 31.

Finalización: NONE; timeout de registro: 0 ms; permiso: STM_SESSION. Evidencia: ESP:src/f4_command_registry.c:43.

### 0x43 SET_ENCODER_FAST

ESP acepta y repite enable:u8 en [status,accepted]; no demuestra cambio del encoder F4. F4 no tiene handler local para este ID.

Finalización: ACK_THEN_SAME_COMMAND; timeout de registro: 0 ms; permiso: STM_SESSION. Evidencia: ESP:src/f4_command_registry.c:44; ESP:src/uner_cmdspec.c + src/uner_app_handlers.cpp:UNER_App_OnCommandTable.

### 0x44 GET_CONNECTED_USERS

Handler ESP operativo; difiere del registro F4. Request vacío; response [status,connected_users].

Finalización: SAME_COMMAND; timeout de registro: 0 ms; permiso: INTERNAL. Evidencia: ESP:src/f4_command_registry.c:45; ESP:src/uner_cmdspec.c + src/uner_app_handlers.cpp:UNER_App_OnCommandTable.

### 0x45 GET_USER_INFO

Handler ESP operativo; difiere del registro F4. index:u8; response [status,index,id:u32 LE,ip[4]].

Finalización: SAME_COMMAND; timeout de registro: 0 ms; permiso: INTERNAL. Evidencia: ESP:src/f4_command_registry.c:46; ESP:src/uner_cmdspec.c + src/uner_app_handlers.cpp:UNER_App_OnCommandTable.

### 0x46 GET_INTERFACES_CONNECTED

Handler ESP operativo; difiere del registro F4. Request vacío; response [status,sta,ap,usb,nrf].

Finalización: SAME_COMMAND; timeout de registro: 0 ms; permiso: INTERNAL. Evidencia: ESP:src/f4_command_registry.c:47; ESP:src/uner_cmdspec.c + src/uner_app_handlers.cpp:UNER_App_OnCommandTable.

### 0x47 GET_CREDENTIALS

Handler ESP rechaza con NACK UNKNOWN_CMD. No devuelve credenciales; reservado para lectura histórica.

Finalización: NACK_ONLY; timeout de registro: 0 ms; permiso: ESP_ADMIN. Evidencia: ESP:src/f4_command_registry.c:48; ESP:src/uner_cmdspec.c + src/uner_app_handlers.cpp:UNER_App_OnCommandTable.

### 0x48 CONNECT_WIFI

Request vacío en el handler ESP. Respuesta variable según el servicio; conservar bytes de diagnóstico. Respuesta ESP: status inicial + bloque WiFi variable (no asumir IP de 4 bytes solamente).

Finalización: ACK_THEN_SAME_COMMAND; timeout de registro: 300 ms; permiso: ESP_ADMIN. Evidencia: ESP:src/f4_command_registry.c:49; ESP:src/uner_app_handlers.cpp.

### 0x49 DISCONNECT_WIFI

Request vacío en el handler ESP. Respuesta variable según el servicio; conservar bytes de diagnóstico. Respuesta ESP: status inicial + bloque WiFi variable (no asumir IP de 4 bytes solamente).

Finalización: ACK_THEN_SAME_COMMAND; timeout de registro: 100 ms; permiso: ESP_ADMIN. Evidencia: ESP:src/f4_command_registry.c:50; ESP:src/uner_app_handlers.cpp.

### 0x4A SET_AP_CONFIG

ssid_len,ssid,password_len,password,protected:u8,ipv4[4]. Solo origen MCU; Web configura F4 por 78.

Finalización: ACK_THEN_SAME_COMMAND; timeout de registro: 200 ms; permiso: ESP_ADMIN. Evidencia: ESP:src/f4_command_registry.c:51.

### 0x4B START_AP

Request vacío en el handler ESP. Respuesta variable según el servicio; conservar bytes de diagnóstico. Respuesta ESP: status inicial + bloque WiFi variable (no asumir IP de 4 bytes solamente).

Finalización: ACK_THEN_SAME_COMMAND; timeout de registro: 300 ms; permiso: ESP_ADMIN. Evidencia: ESP:src/f4_command_registry.c:52; ESP:src/uner_app_handlers.cpp.

### 0x4C STOP_AP

Request vacío en el handler ESP. Respuesta variable según el servicio; conservar bytes de diagnóstico. Respuesta ESP: status inicial + bloque WiFi variable (no asumir IP de 4 bytes solamente).

Finalización: ACK_THEN_SAME_COMMAND; timeout de registro: 100 ms; permiso: ESP_ADMIN. Evidencia: ESP:src/f4_command_registry.c:53; ESP:src/uner_app_handlers.cpp.

### 0x4D GET_CONNECTED_USERS_MODE

Handler ESP operativo; difiere del registro F4. Request vacío; response [status,ap_mode,ap_users,ws_users].

Finalización: SAME_COMMAND; timeout de registro: 0 ms; permiso: INTERNAL. Evidencia: ESP:src/f4_command_registry.c:54; ESP:src/uner_cmdspec.c + src/uner_app_handlers.cpp:UNER_App_OnCommandTable.

### 0x4E SET_AUTO_RECONNECT

Formato variable: bytes hex explícitos; esquema detallado pendiente de formulario dedicado.

Finalización: ACK_THEN_SAME_COMMAND; timeout de registro: 100 ms; permiso: ESP_ADMIN. Evidencia: ESP:src/f4_command_registry.c:55.

### 0x51 AUTH_VALIDATE_PIN

request_id:u8 no cero,scope:u8,pin[4] (valores numéricos 0..9, no ASCII); scope 1 agrega screen:u32 LE; scope 2 agrega new_pin[4]. Response [status,id,scope,granted,ttl_ms:u32 LE,attempts_left].

Finalización: SAME_COMMAND; timeout de registro: 1500 ms; permiso: PUBLIC. Evidencia: ESP:src/f4_command_registry.c:57.

### 0x52 GET_CURRENT_SCREEN

Request vacío; response screen:u32 LE,source:u8 y extensión de menú/notificación/dashboard.

Finalización: SAME_COMMAND; timeout de registro: 50 ms; permiso: STM_SESSION. Evidencia: ESP:src/f4_command_registry.c:58.

### 0x53 MENU_ITEM_CLICK

screen:u32 LE,item:u8 (1..3); ACK status 0 aplicado,2 pantalla distinta,3 inválido,4 sin handler.

Finalización: ACK; timeout de registro: 500 ms; permiso: STM_SESSION. Evidencia: ESP:src/f4_command_registry.c:59.

### 0x54 TRIGGER_ENCODER_BUTTON

screen:u32 LE,press:u8 (0 corta,1 larga); byte opcional. ACK de acción aplicada/rechazada.

Finalización: ACK; timeout de registro: 500 ms; permiso: STM_SESSION. Evidencia: ESP:src/f4_command_registry.c:60.

### 0x55 TRIGGER_USER_BUTTON

screen:u32 LE,press:u8 (0 corta,1 larga); byte opcional. ACK de acción aplicada/rechazada.

Finalización: ACK; timeout de registro: 500 ms; permiso: STM_SESSION. Evidencia: ESP:src/f4_command_registry.c:61.

### 0x56 REQUEST_SCREEN_PAGE

screen:u32 LE,direction:u8 (0 anterior,1 siguiente). El handler necesita el quinto byte.

Finalización: ACK; timeout de registro: 500 ms; permiso: STM_SESSION. Evidencia: ESP:src/f4_command_registry.c:62.

### 0x57 TRIGGER_ENCODER_ROTATE_LEFT

screen:u32 LE exacto. Giro físico izquierdo; en teclado puede cambiar fila y hacer wrap según contexto. No publica cursor ni texto.

Finalización: ACK; timeout de registro: 500 ms; permiso: STM_SESSION. Evidencia: ESP:src/f4_command_registry.c:63.

### 0x58 TRIGGER_ENCODER_ROTATE_RIGHT

screen:u32 LE exacto. Giro físico derecho; en teclado puede cambiar fila y hacer wrap según contexto. No publica cursor ni texto.

Finalización: ACK; timeout de registro: 500 ms; permiso: STM_SESSION. Evidencia: ESP:src/f4_command_registry.c:64.

### 0x59 AUTH_PIN_GRANTED_DEPRECATED

Formato variable: bytes hex explícitos; esquema detallado pendiente de formulario dedicado.

Finalización: NACK_ONLY; timeout de registro: 50 ms; permiso: PUBLIC. Evidencia: ESP:src/f4_command_registry.c:65.

### 0x5A BINARY_ASSET_STREAM

Transferencia interna F4/ESP: request [asset_id:u8]. Chunk recibido por F4: status:u8,asset_id:u8,width:u8,height:u8,total:u16 LE,offset:u16 LE,data_len:u8,data. El registro ESP no garantiza el productor; no enviar como solicitud Web pública. Disponible para interpretar chunks; productor ESP pendiente de confirmar.

Finalización: ACK_THEN_SAME_COMMAND; timeout de registro: 1000 ms; permiso: INTERNAL. Evidencia: ESP:src/f4_command_registry.c:66.

### 0x5B GET_CAR_MODE

Request vacío; response [mode:u8]: 0 IDLE,1 FOLLOW,2 TEST,3 GOTO sin objetivo.

Finalización: SAME_COMMAND; timeout de registro: 50 ms; permiso: STM_SESSION. Evidencia: ESP:src/f4_command_registry.c:67.

### 0x5C WIFI_CREDENTIALS_WEB_RESULT

ESP → F4: result:u8,ssid_len:u8,ssid:utf8; éxito agrega IPv4[4], fallos no agregan bytes. No es una solicitud Web pública.

Finalización: ACK; timeout de registro: 200 ms; permiso: INTERNAL. Evidencia: ESP:src/f4_command_registry.c:68.

### 0x5D AUTH_REMOTE_RESULT

action:u8 (0 logout,1 query); response [status,active,ttl_ms:u32 LE].

Finalización: SAME_COMMAND; timeout de registro: 500 ms; permiso: PUBLIC. Evidencia: ESP:src/f4_command_registry.c:69.

### 0x5E SET_I2C_POLICY

policy:u8 (1 balanceada,2 MPU,3 OLED); response [status,policy].

Finalización: SAME_COMMAND; timeout de registro: 50 ms; permiso: STM_SESSION. Evidencia: ESP:src/f4_command_registry.c:70.

### 0x5F GET_I2C_POLICY

Request vacío.

Finalización: SAME_COMMAND; timeout de registro: 50 ms; permiso: STM_SESSION. Evidencia: ESP:src/f4_command_registry.c:71.

### 0x60 GET_MPU_SNAPSHOT

Snapshot 42 bytes: status:u8,flags:u8,seq:u16 LE,dt_us:u16 LE,roll/pitch/yaw:f32 grados,accel XYZ:f32 g,gyro XYZ:f32 grados/s. Request 60 vacío; 90 evento.

Finalización: SAME_COMMAND; timeout de registro: 50 ms; permiso: STM_SESSION. Evidencia: ESP:src/f4_command_registry.c:72.

### 0x61 SET_MPU_STREAM

enable:u8[,period_ms:u16 LE]; respuesta [status,active,period_ms:u16 LE].

Finalización: SAME_COMMAND; timeout de registro: 500 ms; permiso: STM_SESSION. Evidencia: ESP:src/f4_command_registry.c:73.

### 0x62 STOP_MPU_STREAM

Request vacío.

Finalización: SAME_COMMAND; timeout de registro: 500 ms; permiso: STM_SESSION. Evidencia: ESP:src/f4_command_registry.c:74.

### 0x63 SET_PREFERENCES

mask:u32 LE, valores en orden de descriptor (bool u8,u16 LE). Bit 6 calibración MPU rechazado; campos AP usan 78. Response [status,changed_mask:u32 LE].

Finalización: ACK_THEN_SAME_COMMAND; timeout de registro: 250 ms; permiso: STM_SESSION. Evidencia: ESP:src/f4_command_registry.c:75.

### 0x64 GET_TELEMETRY_SNAPSHOT

Request vacío.

Finalización: SAME_COMMAND; timeout de registro: 80 ms; permiso: STM_SESSION. Evidencia: ESP:src/f4_command_registry.c:76.

### 0x65 GET_BALANCE_PID

Request vacío; response [status,Kp:f32 LE,Ki:f32 LE,Kd:f32 LE].

Finalización: SAME_COMMAND; timeout de registro: 50 ms; permiso: STM_SESSION. Evidencia: ESP:src/f4_command_registry.c:77.

### 0x66 SET_BALANCE_PID

mask:u8 (1 Kp,2 Ki,4 Kd), f32 LE presentes en orden Kp,Ki,Kd. Response [status,changed_mask,Kp:f32,Ki:f32,Kd:f32].

Finalización: ACK_THEN_SAME_COMMAND; timeout de registro: 80 ms; permiso: STM_SESSION. Evidencia: ESP:src/f4_command_registry.c:78.

### 0x67 GET_CONTROL_SNAPSHOT

Request vacío.

Finalización: SAME_COMMAND; timeout de registro: 80 ms; permiso: STM_SESSION. Evidencia: ESP:src/f4_command_registry.c:79.

### 0x68 GET_FIRMWARE_INFO

Request vacío.

Finalización: SAME_COMMAND; timeout de registro: 50 ms; permiso: PUBLIC. Evidencia: ESP:src/f4_command_registry.c:80.

### 0x69 GET_BUILD_INFO

Request vacío.

Finalización: SAME_COMMAND; timeout de registro: 50 ms; permiso: PUBLIC. Evidencia: ESP:src/f4_command_registry.c:81.

### 0x6A GET_IR_SNAPSHOT

Snapshot IR 56 bytes; mismo codec de producción f4Payloads.decodeIrSnapshot: status,flags,seq:u16,period_ms:u16,tick_ms:u32,raw[8]:u16,normalized[8]:u16,pattern,alignment,confidence,ambiguous,width_mm:u16,error_mm:f32,error_norm:f32. Todos multibyte LE.

Finalización: SAME_COMMAND; timeout de registro: 50 ms; permiso: STM_SESSION. Evidencia: ESP:src/f4_command_registry.c:82.

### 0x6B SET_IR_STREAM

enable:u8[,period_ms:u16 LE]; respuesta [status,active,period_ms:u16 LE].

Finalización: SAME_COMMAND; timeout de registro: 500 ms; permiso: STM_SESSION. Evidencia: ESP:src/f4_command_registry.c:83.

### 0x6C STOP_IR_STREAM

Request vacío.

Finalización: SAME_COMMAND; timeout de registro: 500 ms; permiso: STM_SESSION. Evidencia: ESP:src/f4_command_registry.c:84.

### 0x6D OLED_CANVAS_TRANSFER

BEGIN [1,id:u16,128,64,0,total:u16=1024,crc:u32]; CHUNK [2,id:u16,offset:u16,len:u8,data(1..112)]; COMMIT [3,id:u16]; CANCEL [4,id:u16]. Response [op,status,id:u16,next_offset:u16,crc:u32]. Solo UART Web autenticada, TEST y pantalla OLED Canvas.

Finalización: SAME_COMMAND; timeout de registro: 1000 ms; permiso: STM_SESSION. Evidencia: ESP:src/f4_command_registry.c:85.

### 0x6E SET_CAR_MODE

mode:u8 (0 IDLE,1 FOLLOW,2 TEST,3 GOTO sin objetivo); response [status,mode].

Finalización: SAME_COMMAND; timeout de registro: 500 ms; permiso: STM_SESSION. Evidencia: ESP:src/f4_command_registry.c:86.

### 0x6F GET_BOOT_REPORT

Reporte de arranque 22 bytes; mismo codec de producción f4Payloads.decodeBootReport. Request 6F vacío; 9F evento.

Finalización: SAME_COMMAND; timeout de registro: 50 ms; permiso: PUBLIC. Evidencia: ESP:src/f4_command_registry.c:87.

### 0x70 WIFI_CREDENTIALS_FLOW

0=query; 1=submit seguido flags:u8 y seis textos len:u8+utf8 (ssid,password,ip,gateway,subnet,bssid); 2=cancel seguido ssid len+utf8. Response: status:u8,action:u8,flags:u8,sta_len:u8,sta_ssid,ap_len:u8,ap_ssid.

Finalización: SAME_COMMAND; timeout de registro: 500 ms; permiso: ESP_ADMIN. Evidencia: ESP:src/f4_command_registry.c:88.

### 0x71 AP_CLIENTS_PAGE

page:u8,page_size:u8; response status y página variable de clientes AP.

Finalización: SAME_COMMAND; timeout de registro: 250 ms; permiso: ESP_ADMIN. Evidencia: ESP:src/f4_command_registry.c:89.

### 0x72 AP_CLIENT_DISCONNECT

mac[6]; response [status,scheduled].

Finalización: SAME_COMMAND; timeout de registro: 250 ms; permiso: ESP_ADMIN. Evidencia: ESP:src/f4_command_registry.c:90.

### 0x73 GET_EXTENSION_PROFILE

vacío; response [status,profile]. Perfil 0 NRF24,1 BEEPER_PB12.

Finalización: SAME_COMMAND; timeout de registro: 500 ms; permiso: STM_SESSION. Evidencia: ESP:src/f4_command_registry.c:91; F4:Core/Inc/app_preferences.h:ext_profile_t.

### 0x74 SET_EXTENSION_PROFILE

profile:u8 (0 NRF24,1 BEEPER_PB12); response [status]. Reinicio independiente 76.

Finalización: SAME_COMMAND; timeout de registro: 3500 ms; permiso: STM_SESSION. Evidencia: ESP:src/f4_command_registry.c:92; F4:Core/Inc/app_preferences.h:ext_profile_t.

### 0x75 GET_EXTENSION_PIN_MAP

Request vacío.

Finalización: NONE; timeout de registro: 0 ms; permiso: STM_SESSION. Evidencia: ESP:src/f4_command_registry.c:94.

### 0x76 REBOOT_INTO_PROFILE

profile:u8 (0 NRF24,1 BEEPER_PB12); ACK [76,status] antes del reinicio; no respuesta por mismo ID.

Finalización: ACK; timeout de registro: 3500 ms; permiso: STM_SESSION. Evidencia: ESP:src/f4_command_registry.c:93; F4:Core/Inc/app_preferences.h:ext_profile_t.

### 0x77 GET_AP_CONFIG

vacío; response [status,apply_state,protected,password_set,ssid_len,ssid,ipv4[4]].

Finalización: SAME_COMMAND; timeout de registro: 200 ms; permiso: STM_SESSION. Evidencia: ESP:src/f4_command_registry.c:95.

### 0x78 SET_AP_CONFIG_F4

mask:u8 bits 0 SSID,1 contraseña,2 protección,3 IP; concatenar en ese orden len+utf8,len+utf8,bool:u8,ipv4[4]. Contraseña vacía conserva. Response [status,changed_mask,apply_state].

Finalización: ACK_THEN_SAME_COMMAND; timeout de registro: 500 ms; permiso: STM_SESSION. Evidencia: ESP:src/f4_command_registry.c:96.

### 0x79 GET_IR_EMITTERS

vacío; response [line_enabled,objects_enabled,persisted]. No contiene status inicial.

Finalización: SAME_COMMAND; timeout de registro: 500 ms; permiso: STM_SESSION. Evidencia: ESP:src/f4_command_registry.c:97.

### 0x7A SET_IR_EMITTERS

[line_enabled,objects_enabled,persist]; response [status,line_enabled,objects_enabled,persisted].

Finalización: SAME_COMMAND; timeout de registro: 500 ms; permiso: STM_SESSION. Evidencia: ESP:src/f4_command_registry.c:98.

### 0x80 EVT_BOOT

mode:u8,wifi_status:u8,ipv4[4],ssid_len:u8,ssid:utf8; trailer de diagnóstico reset (marker,version,reason,flags). Evento sin status inicial de operación.

Finalización: EVENT; timeout de registro: 0 ms; permiso: INTERNAL. Evidencia: ESP:src/f4_command_registry.c:101.

### 0x81 EVT_MODE_CHANGED

mode:u8,wifi_status:u8,ipv4[4],ssid_len:u8,ssid:utf8 (0..32 bytes). Evento sin status inicial de operación.

Finalización: EVENT; timeout de registro: 0 ms; permiso: INTERNAL. Evidencia: ESP:src/f4_command_registry.c:102; ESP:src/uner_app_handlers.cpp:append_wifi_info.

### 0x82 EVT_STA_CONNECTED

mode:u8,wifi_status:u8,ipv4[4],ssid_len:u8,ssid:utf8 (0..32 bytes). Evento sin status inicial de operación.

Finalización: EVENT; timeout de registro: 0 ms; permiso: INTERNAL. Evidencia: ESP:src/f4_command_registry.c:103; ESP:src/uner_app_handlers.cpp:append_wifi_info.

### 0x83 EVT_STA_DISCONNECTED

mode:u8,wifi_status:u8,ipv4[4],ssid_len:u8,ssid:utf8 (0..32 bytes). Evento sin status inicial de operación.

Finalización: EVENT; timeout de registro: 0 ms; permiso: INTERNAL. Evidencia: ESP:src/f4_command_registry.c:104; ESP:src/uner_app_handlers.cpp:append_wifi_info.

### 0x84 EVT_AP_CLIENT_JOIN

ap_clients:u8. Cantidad de clientes AP tras incorporación/salida.

Finalización: EVENT; timeout de registro: 0 ms; permiso: INTERNAL. Evidencia: ESP:src/f4_command_registry.c:105.

### 0x85 EVT_AP_CLIENT_LEAVE

ap_clients:u8. Cantidad de clientes AP tras incorporación/salida.

Finalización: EVENT; timeout de registro: 0 ms; permiso: INTERNAL. Evidencia: ESP:src/f4_command_registry.c:106.

### 0x86 EVT_APP_USER_CONNECTED

client_id:u32 LE. Evento de conexión/desconexión del cliente.

Finalización: EVENT; timeout de registro: 0 ms; permiso: INTERNAL. Evidencia: ESP:src/f4_command_registry.c:107.

### 0x87 EVT_APP_USER_DISCONNECTED

client_id:u32 LE. Evento de conexión/desconexión del cliente.

Finalización: EVENT; timeout de registro: 0 ms; permiso: INTERNAL. Evidencia: ESP:src/f4_command_registry.c:108.

### 0x88 EVT_WEBSERVER_UP

Payload vacío en productor ESP actual.

Finalización: EVENT; timeout de registro: 0 ms; permiso: INTERNAL. Evidencia: ESP:src/f4_command_registry.c:109.

### 0x89 EVT_WEBSERVER_CLIENT_CONNECTED

client_id:u32 LE. Evento de conexión/desconexión del cliente.

Finalización: EVENT; timeout de registro: 0 ms; permiso: INTERNAL. Evidencia: ESP:src/f4_command_registry.c:110.

### 0x8A EVT_WEBSERVER_CLIENT_DISCONNECTED

client_id:u32 LE. Evento de conexión/desconexión del cliente.

Finalización: EVENT; timeout de registro: 0 ms; permiso: INTERNAL. Evidencia: ESP:src/f4_command_registry.c:111.

### 0x8B EVT_LAST_WIFI_NOT_FOUND

Formato variable: bytes hex explícitos; esquema detallado pendiente de formulario dedicado.

Finalización: EVENT; timeout de registro: 0 ms; permiso: INTERNAL. Evidencia: ESP:src/f4_command_registry.c:112.

### 0x8C EVT_CONTROLLER_CONNECTED

Formato variable: bytes hex explícitos; esquema detallado pendiente de formulario dedicado.

Finalización: EVENT; timeout de registro: 0 ms; permiso: INTERNAL. Evidencia: ESP:src/f4_command_registry.c:113.

### 0x8D EVT_CONTROLLER_DISCONNECTED

Formato variable: bytes hex explícitos; esquema detallado pendiente de formulario dedicado.

Finalización: EVENT; timeout de registro: 0 ms; permiso: INTERNAL. Evidencia: ESP:src/f4_command_registry.c:114.

### 0x8E EVT_USB_CONNECTED

Payload vacío en productor ESP actual.

Finalización: EVENT; timeout de registro: 0 ms; permiso: INTERNAL. Evidencia: ESP:src/f4_command_registry.c:115.

### 0x8F EVT_USB_DISCONNECTED

Payload vacío en productor ESP actual.

Finalización: EVENT; timeout de registro: 0 ms; permiso: INTERNAL. Evidencia: ESP:src/f4_command_registry.c:116.

### 0x90 EVT_MPU_STREAM

Snapshot 42 bytes: status:u8,flags:u8,seq:u16 LE,dt_us:u16 LE,roll/pitch/yaw:f32 grados,accel XYZ:f32 g,gyro XYZ:f32 grados/s. Request 60 vacío; 90 evento.

Finalización: EVENT; timeout de registro: 0 ms; permiso: STM_SESSION. Evidencia: ESP:src/f4_command_registry.c:117.

### 0x91 EVT_IR_STREAM

Snapshot IR 56 bytes; mismo codec de producción f4Payloads.decodeIrSnapshot: status,flags,seq:u16,period_ms:u16,tick_ms:u32,raw[8]:u16,normalized[8]:u16,pattern,alignment,confidence,ambiguous,width_mm:u16,error_mm:f32,error_norm:f32. Todos multibyte LE.

Finalización: EVENT; timeout de registro: 0 ms; permiso: STM_SESSION. Evidencia: ESP:src/f4_command_registry.c:118.

### 0x92 EVT_WIFI_CONNECTED

Formato variable: bytes hex explícitos; esquema detallado pendiente de formulario dedicado.

Finalización: EVENT; timeout de registro: 0 ms; permiso: INTERNAL. Evidencia: ESP:src/f4_command_registry.c:119.

### 0x93 EVT_NETWORK_IP

Formato variable: bytes hex explícitos; esquema detallado pendiente de formulario dedicado.

Finalización: EVENT; timeout de registro: 0 ms; permiso: INTERNAL. Evidencia: ESP:src/f4_command_registry.c:120.

### 0x94 EVT_BOOT_COMPLETE

Formato variable: bytes hex explícitos; esquema detallado pendiente de formulario dedicado.

Finalización: EVENT; timeout de registro: 0 ms; permiso: INTERNAL. Evidencia: ESP:src/f4_command_registry.c:121.

### 0x95 EVT_SCREEN_CHANGED

screen:u32 LE,source:u8[,remaining_ms:u16,total_ms:u16].

Finalización: EVENT; timeout de registro: 0 ms; permiso: STM_SESSION. Evidencia: ESP:src/f4_command_registry.c:122.

### 0x96 EVT_MENU_SELECTION_CHANGED

screen:u32 LE,selected:u8,count:u8,source:u8. No contiene cursor ni buffer del teclado.

Finalización: EVENT; timeout de registro: 0 ms; permiso: STM_SESSION. Evidencia: ESP:src/f4_command_registry.c:123.

### 0x97 EVT_CAR_MODE_CHANGED

mode:u8 (0 IDLE,1 FOLLOW,2 TEST,3 GOTO sin objetivo).

Finalización: EVENT; timeout de registro: 0 ms; permiso: STM_SESSION. Evidencia: ESP:src/f4_command_registry.c:124.

### 0x98 EVT_IR_EMITTERS_CHANGED

line_enabled:u8,objects_enabled:u8,persisted:u8; evento sin status inicial.

Finalización: EVENT; timeout de registro: 0 ms; permiso: STM_SESSION. Evidencia: ESP:src/f4_command_registry.c:125.

### 0x9E EVT_QT_USB_STATE

connected:u8

Finalización: EVENT; timeout de registro: 0 ms; permiso: STM_SESSION. Evidencia: ESP:src/f4_command_registry.c:126.

### 0x9F EVT_MCU_BOOT_REPORT

Reporte de arranque 22 bytes; mismo codec de producción f4Payloads.decodeBootReport. Request 6F vacío; 9F evento.

Finalización: EVENT; timeout de registro: 0 ms; permiso: STM_SESSION. Evidencia: ESP:src/f4_command_registry.c:127.

### 0xA4 LEGACY_WIFI_SCAN_STARTED

Request vacío.

Finalización: NONE; timeout de registro: 0 ms; permiso: INTERNAL. Evidencia: ESP:src/f4_command_registry.c:129.

### 0xA5 LEGACY_WIFI_SCAN_COMPLETED

Request vacío.

Finalización: NONE; timeout de registro: 0 ms; permiso: INTERNAL. Evidencia: ESP:src/f4_command_registry.c:130.

### 0xA6 LEGACY_WIFI_STA_CONNECT_REQUESTED

Request vacío.

Finalización: NONE; timeout de registro: 0 ms; permiso: INTERNAL. Evidencia: ESP:src/f4_command_registry.c:131.

### 0xA7 LEGACY_WIFI_STA_DISCONNECT_REQUESTED

Request vacío.

Finalización: NONE; timeout de registro: 0 ms; permiso: INTERNAL. Evidencia: ESP:src/f4_command_registry.c:132.

### 0xA8 LEGACY_WIFI_AP_STATE_REQUESTED

Request vacío.

Finalización: NONE; timeout de registro: 0 ms; permiso: INTERNAL. Evidencia: ESP:src/f4_command_registry.c:133.

### 0xA9 LEGACY_WEB_COMMAND_REJECTED

Request vacío.

Finalización: NONE; timeout de registro: 0 ms; permiso: INTERNAL. Evidencia: ESP:src/f4_command_registry.c:134.

### 0xAA LEGACY_CREDENTIALS_UPDATED

Request vacío.

Finalización: NONE; timeout de registro: 0 ms; permiso: INTERNAL. Evidencia: ESP:src/f4_command_registry.c:135.

### 0xE0 ACK

original_cmd:u8[,status:u8]; ACK intermedio no termina ACK_THEN_SAME_COMMAND.

Finalización: NONE; timeout de registro: 0 ms; permiso: INTERNAL. Evidencia: ESP:src/f4_command_registry.c:137.

### 0xE1 NACK

original_cmd:u8[,reason:u8]; rechazo, no éxito.

Finalización: NONE; timeout de registro: 0 ms; permiso: INTERNAL. Evidencia: ESP:src/f4_command_registry.c:138.


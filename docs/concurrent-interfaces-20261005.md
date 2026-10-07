# Dos interfaces simultaneas — AMI-20261005-04

Implementado en fuentes el 2026-10-05. Sin tests, compilaciones, validaciones,
ejecucion de aplicaciones ni prueba fisica en esta tarea.

ESP admite como maximo dos WebSockets API v1 en `/ws`, incluso desde una misma
IP. Cada uno hace su propio login PIN y conserva nodo/generation/suscripciones.
`hello.maxClients=2`; `hello.features.independentSessions=true`; el campo
opcional `hello.resumeToken` identifica una reconexion dentro de la gracia.
Los clientes lo retienen solo en memoria y lo presentan como query
`resumeToken`. Un socket nuevo sin token no hereda autoridad por IP ni por
consultar un nodo F4 anterior. El logout de una interfaz no cierra la otra.

F4 mantiene MPU/IR por transporte y nodo. Dos clientes Wi-Fi comparten la
adquisicion a traves del broker ESP; Qt USB tiene una suscripcion independiente.
SET/STOP conserva IDs y payloads; STOP/SET enabled=0 afecta solo al endpoint
solicitante. El STOP propio se admite despues de logout para limpiar demanda
sin conceder acceso a datos ni afectar otros endpoints. Un reinicio ESP deja
vigentes la sesion y los streams USB. Cambiar el PIN o reiniciar F4 mantiene la
revocacion global correspondiente.

Cada sesion se consulta cada 20 s mientras esta autenticada. Una consulta o
envio de stream renueva solo una sesion vigente; nunca revive una vencida.
Ambas interfaces pueden operar a la vez, con respuestas privadas y cambios
de estado comunes. Las mutaciones aceptadas se aplican en el orden recibido.
No se agrega un bloqueo exclusivo de control entre interfaces.

GET_TELEMETRY_SNAPSHOT `0x64` conserva sus 92 bytes: `mpuStreamActive` indica
si existe cualquier suscriptor MPU y `mpuStreamPeriodMs` es el menor periodo
activo, o el valor por defecto si no hay suscriptores. GET_IR_SNAPSHOT `0x6A`
usa el periodo propio si existe, o el defecto, y una secuencia de snapshots
independiente de las suscripciones. Eventos MPU `0x90` (42 bytes) e IR `0x91`
(56 bytes) conservan formato; cada endpoint conserva su periodo/secuencia.

Actualizar F4, ESP y los clientes antes de usar simultaneidad. Es necesario
recompilar y cargar ambos firmwares, reconstruir la Web servida y recompilar
Qt para disponer de estos cambios. Nada de eso se ejecuto en esta tarea.
Los cambios de codigo quedan locales, sin commits ni publicacion de estos
cuatro repositorios. El registro se publica separadamente en Contracts.

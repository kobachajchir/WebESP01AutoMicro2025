# Control Libre / GOTO XY y calibración de motores
Fecha: 2026-10-07. Implementación en fuente; no se ejecutaron tests, compilaciones ni validaciones por instrucción del usuario.

## Experiencia implementada
Control tiene un pill Libre / GOTO XY. Libre conserva los mandos; GOTO permite ingresar X/Y en centímetros y comenzar/cancelar una misión F4. Calibración de motores tiene acceso propio y modal desde requisitos. El editor Web de secuencias queda como herramienta de simulación plegable.

La barra superior informa conexión autorizada, modo, MPU, motores, objetos, balance y seguridad; Seguidor añade calibración inferior y alineación blanco/negro/blanco. Una condición incumplida es un botón completo con cursor de selección, cruz roja circular y acceso a su resolución. Una condición cumplida presenta check verde circular y permanece informativa. Estado desconocido se muestra pendiente, sin inventar cumplimiento. El selector de modo es modal y espera confirmación F4 antes de cerrar.

Calibración básica permite intensidad 1..20%, rampa 0..5000 ms, timeout 1000..30000 ms y notas de batería/carga/superficie. Curva permite hasta cinco niveles ascendentes y 1..5 repeticiones por nivel. Cada ensayo exige preparar y comenzar de nuevo; no encadena desplazamientos sin reposicionar. Guarda tiempo del metro, PWM firmado aplicado a cada motor después del balance, máximos, integral de duty, tiempos adelante/atrás y ciclos eléctricos estimados. Exportación JSON conserva perfil, notas e historial; importación restaura el perfil de motores. Los historiales Web y Qt son independientes, con límite de 200 ensayos.

El primer ensayo de cada nivel reemplaza la calibración anterior al guardarse; las repeticiones posteriores promedian velocidades para ese nivel y rampa. Así recalibrar por cambio de batería no mezcla automáticamente el primer nuevo resultado con condiciones antiguas. Un ensayo cancelado/fallido conserva el perfil anterior. Mediana y dispersión se presentan a partir del historial local que comparte intensidad, rampa y notas.

## Referencia física del metro
Dos franjas transversales iguales separadas 100 cm entre bordes equivalentes. Sensor inferior central inicialmente negro; ventana desde la salida de la primera franja hasta la salida de la segunda, debounce de 20 ms. Requiere blanco/pista inferior y MPU calibrados, lecturas recientes, emisores de objetos y perfil IR transferido, balance estable. No depende de que FOLLOW clasifique 111 como ruta válida.

Rampa y balance permanecen activos durante movimiento. El guardado explícito desactiva el balance antes de escribir Flash. El perfil no caduca; recalibración manual según batería, carga o suelo. No hay medición de tensión de batería ni encoders de rueda: PWM no es número de vueltas.

## Responsabilidad y cancelación
- F4: servicio portable auto_motion con handle privado y puertos read/command/hold/save. Planificación local y perfil persistente; MotionControl y Balance siguen arbitrando PWM final.
- ESP: sesión STM, nombres WebSocket y bridge UNER, respuesta final correlacionada.
- Web y Qt: preparación, requisitos, parámetros, visualización e historial. Nunca generan una posición medida ni ejecutan un bucle de navegación remoto.
- Una intención autónoma excluye mandos manuales/TEST. Cancelar detiene su intención y conserva balance; Detener general desarma todo. Cambio de modo, calibraciones incompatibles y balance apagado cancelan movimiento.
- Desconectar el cliente no cancela: la F4 continúa hasta fin, cancelación local o parada de seguridad. Timeouts de transporte no reintentan mutaciones automáticamente.

## GOTO y límites del modelo
Origen y rumbo inicial al comenzar; X positivo derecha, Y positivo adelante. Distancia inicial 10..200 cm, tolerancia estimada 10 cm, timeout 30 s. Orientación actualizada una vez por secuencia MPU; avance integrado desde la intención previamente aceptada, usando velocidad calibrada y rampa del punto seleccionado. No se integra aceleración cruda para fingir odometría.

La evasión es reactiva con cinco curvas IR, umbral frontal de 200 mm, desvío lateral 60 grados y tramo estimado de 25 cm. Ambigüedad usa candidato más cercano; lectura fuera de perfil, ambos lados bloqueados, desvío >5 s o falta de progreso >8 s detienen la misión. No implementa mapa, SLAM ni garantía de llegada. El perfil IR compacto admite 2..8 distancias por sensor; el cliente rechaza perfiles mayores sin descartar muestras silenciosamente.

Una curva de ensayos de un metro aporta velocidad media por intensidad/rampa y repetibilidad. La aceleración instantánea requiere instrumentación/mediciones adicionales; no se afirma haberla obtenido.

## Pantalla y despliegue
F4: nueva entrada con icono Tool en Motores, pantalla 0x040104. Encoder cambia intensidad/rampa; pulsación encoder cambia campo; USER corto comienza, cancela o guarda; encoder largo cancela y vuelve. USER largo conserva el enrutamiento global existente. Web/Qt identifican la pantalla; 0x52/0x95/0x96 no publican todo su contenido y no se promete framebuffer idéntico. Métricas por 0x23/0x27.

Preferencias pasan de V12 a V13 con migración lectora de V12 y perfil inicialmente vacío; guardar requiere desarmado. Actualizar F4 y ESP antes de usar Web/Qt nuevos. Los clientes exigen estado v1 confirmado. No se regeneró el bundle LittleFS ni se reflasheó hardware.

## Trabajo posterior sujeto a pedido
Compilar los cuatro consumidores, generar/copiar bundle ESP, instalar/reflashear y comprobar físicamente el metro, signo de giro, detección de obstáculos, cancelación y migración Flash. Esas comprobaciones no forman parte de los resultados ejecutados en este cambio.

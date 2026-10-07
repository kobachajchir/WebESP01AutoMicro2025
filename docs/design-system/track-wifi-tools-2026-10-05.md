# Seguidor y WiFi — controles integrados, 2026-10-05

Aplicación del manual 0.3.0 autorizado, usando sus tokens, recetas y componentes.
Objetivos: Seguidor y controles de recuperación WiFi. Las fuentes de identidad
son el manual vigente y las primitivas compartidas. La sección AP conserva su
formulario, clientes y operaciones.

| Decisión | Evidencia | Cobertura | Verificación |
| --- | --- | --- | --- |
| Herramientas debajo de Iniciar IR, Grabar y demás acciones | Confirmada por solicitud | Fuente | No verificada |
| Puntos/Ribbon como selector de una única opción | Confirmada por solicitud | Estado exclusivo; solo se dibuja la representación elegida | No verificada |
| Debug sensores como toggle independiente | Confirmada por solicitud | Compatible con Puntos o Ribbon | No verificada |
| Burbujas comunes con MPU + IR | Confirmada por solicitud | Componente y estimador axial compartidos; calibración guardada común | No verificada |
| Diagnóstico en panel lateral | Propuesta aplicada, reubicación autorizada | Fuente | No verificada |
| Consulta y AP fallback dentro de modo físico WiFi | Confirmada por solicitud | Consulta de política/estado, pill alternante confirmada | No verificada |
| Reintentar estación sobre una red guardada sin cambios | Confirmada intención; condición Propuesta aplicada | Conserva envío de credenciales al editar red o en aprovisionamiento | No verificada |
| Superficies y acciones consistentes | Observada en manual; Propuesta aplicada | Tokens `--ui-*`, foco, texto/icono y estilos comunes de transporte | No verificada |

Debug comparte `IrObjectDetectionMarkers` con MPU + IR. Las burbujas, disco y
anillo conservan materiales, estimación axial y anclajes CAD. En el Seguidor
heredan el mismo grupo de normalización que el GLB, sin modificar escala del
vehículo, y solo aparecen tras cargar el modelo. No se duplican sobre el cuerpo
de reemplazo. Se retiran los tres puntos sintéticos del debug anterior.

La estimación usa la curva persistida o el modelo visual sin curva, con límite
visual común de 5 cm. La lectura compartida de calibración conserva el formato,
la clave y la interpretación existentes de MPU + IR. Las muestras reales exigen
conexión, sesión STM, stream solicitado/activo y lectura confirmada; Debug no
envía comandos ni inicia una suscripción. Distancia estimada no es telemetría de
distancia física. Se conserva el marcador de error lateral de línea existente.

WiFi elimina la tarjeta separada Recuperación de conexión. La tarjeta de modo
físico agrupa la pill AP fallback, el botón que pasa de Leyendo configuración a
Consultar política, el estado de aplicación y los errores. La carga inicial
consulta la política junto a la configuración existente; consultar después
refresca política y conexión sin sobrescribir los formularios editados. Cambiar
modo sigue como acción separada con su confirmación existente.

AP fallback alterna según GET confirmado; SET se completa con nueva lectura.
Desconexión, respuesta incompatible o error dejan estado sin confirmar. El
botón Reintentar estación usa credenciales guardadas cuando STA está desconectada
y el formulario coincide con esa configuración; editar datos mantiene Conectar
ESP a esta red. La pantalla de aprovisionamiento conserva su envío de credenciales.

Reglas aplicadas: una selección exclusiva para representación; toggles para
opciones independientes; acciones de hardware con estado confirmado; tokens de
marca para ambas superficies; reflujo y foco conservados. Propuestas de disposición
y aceptación estética pendientes de revisión solicitada por el usuario.

Sin tests, compilaciones, validaciones, ejecución visual, carga ni prueba física.
Fuente Web local; bundle/data ESP sin regenerar. Registro: AMI-20261005-08.

La navegación manual posterior de las escenas está documentada en
[Navegación de cámara](camera-navigation-2026-10-05.md): Ctrl + arrastrar,
deselección de vista, pausa de seguimiento y restauración al elegir un preset.

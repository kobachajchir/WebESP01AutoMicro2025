# Componentes y recetas de composición

**Estado:** borrador. En la matriz, evidencia, cobertura, verificación y aprobación son campos distintos. `No verificada` significa que se leyó el código pero no se observó el componente en una sesión renderizada. La evidencia y fuente principal de cada familia se detallan abajo.

**Identidad confirmada · D-09/D-14.** La cabecera compartida coloca `LogoDashboardV2.webp` dentro de `home-brand-glyph` sin recuadro y muestra el nombre de la sección. El login emplea el mismo símbolo libre de fondo. En campos de red, la etiqueta visible es **Password** y la sección se llama **WiFi**. El favicon deriva del mismo logo; las ilustraciones temáticas de las tarjetas se usan como contexto, no como símbolos alternativos.

| Familia | Evidencia | Cobertura | Verificación | Aprobación | Fuente principal |
| --- | --- | --- | --- | --- | --- |
| Botones primario, secundario, peligro e iconográfico | Observada | Cubierta | No verificada | Pendiente | `.app-button`, `.toolbar-btn`, `PageHeader`, Control |
| Enlaces y navegación | Observada | Parcial | No verificada | Pendiente | `PageHeader`, tarjetas de `Home` |
| Campos de texto, Password y PIN | Observada | Cubierta | No verificada | Pendiente | `PinScreen`, `WifiSection`, `.app-input` |
| Selectores y controles segmentados | Observada | Cubierta | No verificada | Pendiente | WiFi STA/AP, Control simple/dual |
| Tarjetas técnicas y de navegación | Observada | Cubierta | No verificada | Pendiente | `.app-panel`, `.home-module-card`, WiFi |
| Cabecera, tiras y navegación de estado | Observada | Cubierta | No verificada | Pendiente | `PageHeader`, `SectionStatusStrip`, Home |
| Modales y diálogos | Observada + propuesta aplicada | Cubierta | No verificada | Pendiente | `modal.tsx`, `PinScreenModal`, `useModalScrollLock` |
| Menús y dropdowns | Observada | Parcial | No verificada | Pendiente | Selector de modo de `Home` |
| Pestañas | Observada | Parcial | No verificada | Pendiente | Ajustes de Home; WiFi usa segmentado |
| Tablas | Propuesta | No cubierta | No verificada | Pendiente | No se derivó una tabla canónica de estas cinco vistas |
| Alertas, banners y feedback | Observada | Cubierta | No verificada | Pendiente | Login, Home, WiFi |
| Badges, pills y métricas | Observada | Cubierta | No verificada | Pendiente | `.home-status-pill`, métricas WiFi/Control |
| Tooltips | Propuesta | No cubierta | No verificada | Pendiente | No hay patrón consistente en las cinco vistas |
| Loaders y progreso | Observada | Parcial | No verificada | Pendiente | PIN, carga de escena, acciones WiFi |
| Switches de emisión y apertura óptica estimada | Observada + propuesta aplicada | Cubierta en fuente | No verificada | Borrador autorizado; pendiente visual | [Aplicación 2026-10-05](emission-controls-2026-10-05.md), `IrEmittersControls`, `ToggleButton` |
| Vistas y bloques de telemetría colapsables | Confirmada disposición + propuesta aplicada | Cubierta en fuente | No verificada | Disposición pedida; revisión visual pendiente | [Reorganización 2026-10-05](sensor-layout-2026-10-05.md), `SensorDisclosure`, Control real |
| Haces, sliders de opacidad y visibilidad | Confirmada disposición + propuesta aplicada | Cubierta en fuente | No verificada | Controles pedidos; revisión visual pendiente | [Reorganización 2026-10-05](sensor-layout-2026-10-05.md), `SensorBeamControls`, `SensorDisclosure` |
| Iconos de vistas y gráfica condicionada a la placa | Confirmada interacción + propuesta aplicada | Cubierta en fuente | No verificada | Cambios pedidos; revisión visual pendiente | [Reorganización 2026-10-05](sensor-layout-2026-10-05.md), `SensorCameraViewIcon`, `RealtimeEulerPanel` |
| Acciones de motores, balance plegable e indicador de armado | Confirmada interacción + propuesta aplicada | Cubierta en fuente | No verificada | Cambios pedidos; revisión visual pendiente | [Control de motores 2026-10-05](motor-controls-2026-10-05.md), `MotionControlActions`, `MotionBalancePanel`, `MotionBalanceStatus` |
| Selector Puntos/Ribbon, herramientas del Seguidor y política WiFi integrada | Confirmada interacción + propuesta aplicada | Cubierta en fuente | No verificada | Cambios pedidos; revisión visual pendiente | [Seguidor y WiFi 2026-10-05](track-wifi-tools-2026-10-05.md), `IrObjectDetectionMarkers`, `ApFallbackControls`, transporte compartido |
| LED blanco binario, apertura fija y detección axial por sensor | Toggle y ±30° desde el eje confirmados por pedido del 2026-10-06 | Cubierta en fuente | No verificada | Sin cono blanco, opacidad ni preview; revisión visual pendiente | [Reorganización y corrección](sensor-layout-2026-10-05.md), `IrEmittersControls`, `UnderbodySensorBeams`, `ObstacleRay` |
| Estados vacíos | Propuesta | No cubierta | No verificada | Pendiente | No hay un arquetipo común demostrado |

## Anatomía y uso

### Botones y enlaces · Observada · D-02/D-07

**Propósito:** ejecutar, alternar o navegar. **Anatomía:** etiqueta o icono con nombre accesible, borde fino, radio de 8 px, fondo de acción o superficie; primario más sólido y secundario translúcido. **Variantes:** primario, ghost, peligro, iconográfico y segmentado; mínimos observados cercanos a 2.75 rem en botón común. **Estados:** normal, hover, presión, deshabilitado y ocupado cuando aplica. **Responsive:** la barra puede envolver y los botones de formulario pueden ocupar el ancho. **Teclado/foco:** conservar foco visible de `--ui-ring-strong`, activar con teclado y no ocultar el nombre de botones solo icono. **Tokens:** `semantic.*.action`, `.focus`, `components.button`. **Combinación:** acción primaria tras contexto y estado. **Prohibido:** usar cian brillante para todas las acciones o permitir una orden física bloqueada como si estuviera disponible.

### Campos y selectores · Observada · D-02/D-04

**Propósito:** entrada de PIN o configuración de red. **Anatomía:** etiqueta visible (PIN tiene etiqueta accesible y casillas visuales), campo oscuro/translúcido, borde, placeholder y ayuda. **Variantes:** texto, Password, valor numérico, elección de WiFi/AP y simple/dual. **Estados:** foco, seleccionado, cargando, error y deshabilitado según vista. **Responsive:** una columna en pantallas estrechas. **Teclado:** no sustituir el campo por un dibujo sin foco; el PIN real recibe teclado numérico. **Tokens:** `semantic.*.field`, `.text`, `.focus`. **Prohibido:** usar placeholder como única etiqueta o diferenciar errores solo por color.

### Paneles, tarjetas y navegación · Observada · D-01/D-05/D-07

**Propósito:** agrupar datos o llevar a una capacidad. **Anatomía técnica:** encabezado, contenido, borde tenue y sombra; el marco exterior puede usar blur, los paneles anidados no lo repiten. **Anatomía de módulo:** imagen temática, máscara de lectura, título, descripción, flecha y metadatos/estado. **Variantes:** panel común de 8 px, tarjeta de módulo de ~1.05 rem y tarjeta primaria con borde más intenso. **Estados:** hover en puntero fino, presión y deshabilitado cuando es interactiva. **Responsive:** módulos redistribuidos en proporción horizontal en móvil y contenido técnico apilado; no recortar estado crítico. **Teclado:** toda tarjeta navegable debe recibir foco visible y nombre completo. **Tokens:** `semantic.*.surface`, `.border`, `sections.dashboard`. **Prohibido:** usar imagen sin máscara bajo texto o convertir tarjeta informativa en acción sin señal visual.

### Cabecera, estados, alertas y feedback · Observada · D-03/D-04

**Propósito:** orientar y explicar disponibilidad. **Anatomía:** título + glifo de sección + acciones; franja de estado con pares etiqueta/valor; avisos con tono, texto y, si corresponde, acción. **Variantes:** éxito, error, información, advertencia, neutral. **Estados:** enlace conectado/desconectado, pendiente, fallo, simulación y bloqueo. **Responsive:** envolver o apilar sin perder el título ni la alerta. **Accesibilidad:** nombre accesible, `role="status"` o `role="alert"` según urgencia y texto que no dependa del color. **Tokens:** `semantic.*.feedback`, `components.statusPill`. **Prohibido:** mostrar “Listo” en un bloque que depende de un enlace caído.

### Modales, menús y pestañas · Observada parcial · D-03/D-10

**Propósito:** decisiones locales, configuración y selección entre modos. **Anatomía:** encabezado, contexto, contenido, acción principal/cancelación; menú anclado a su disparador; pestañas o segmentado con selección visible. **Variantes:** credenciales WiFi, ajustes e información, selector de modo. **Responsive:** diálogo dentro del viewport; en móvil aparece desde el borde inferior, sin manija que prometa un arrastre inexistente. **Teclado/foco:** el diálogo toma y contiene el foco, responde a Escape y lo devuelve al control que lo abrió. **Scroll:** se bloquean documento y ruta mientras está abierto; solo desplaza el contenido interior. **Movimiento:** entrada y salida simétricas, 240 ms sobre `transform` y `opacity`; 120 ms de fundido sin desplazamiento con movimiento reducido. **Tokens:** superficie sólida, borde, selección y foco. **Prohibido:** presentar una transición de modo como simple cambio visual si requiere confirmación del dispositivo. La interacción aún no fue verificada en navegador.

### Loaders, tablas, tooltips y estados vacíos · D-10

Los loaders existen en acciones puntuales: deben nombrar qué espera la persona y permitir salida cuando sea viable (**Observada** en texto, **Propuesta** como regla general). Tabla, tooltip y estado vacío no tienen una muestra canónica suficiente: emplear tipografía y superficie semánticas, foco/teclado y el patrón de feedback, pero registrar cada diseño como **Propuesta** antes de adoptarlo. No se autorizó tomar estas familias de otras páginas.

## Recetas de pantalla

| Arquetipo | Objetivo y orden | Densidad, alineación y reflujo | Evidencia |
| --- | --- | --- | --- |
| Acceso | Símbolo de acceso, título, explicación, entrada PIN, estado y acción | Tarjeta centrada de ancho limitado; padding menor en móvil | Observada: Login |
| Dashboard | Identidad, estado general, modo/pantalla actual, salud, módulos de navegación | Marco amplio; módulos ilustrados en grilla que se apila | Observada: Home |
| Control operativo | Título, estado, simulación, transporte, modo, secuencias y feedback | Paneles densos; reorganización `sm/md/xl` | Observada: Control |
| Configuración WiFi | Estado de enlace, modo, selector STA/AP, formulario/redes, feedback | Dos columnas cuando hay ancho; una columna en móvil | Observada: WiFi |
| Telemetría/escena | Título, estado, controles de stream, escena central, herramientas y lecturas | Escena dominante; herramientas pasan a grilla y paneles se apilan | Observada: MPU + IR |
| Tabla, detalle, vacío | Encabezado, contexto, contenido, estado/ayuda y acción proporcionada | Ancho de lectura y foco consistentes; sin composición fija aprobada | Propuesta: sin ejemplo canónico |

Las recetas indican prioridades, no píxeles obligatorios. En una pantalla nueva, preservar las relaciones entre título, estado, contenido y acción; marcar como **Propuesta** cualquier componente o estado que las fuentes no muestren.

## Calibración IR/Balance — 2026-10-01

Extensión propuesta aplicada sobre el manual 0.3.0 autorizado. Objetivo: modal de calibración en /statics. Identidad base confirmada, tokens y superficies observados; selector de procedimientos, pasos, historial, comparación y gráficos son propuestas. Cobertura implementada en código: preparación, captura, resultados, vacío, error de entrada, sin conexión, análisis/cancelación y falta de capacidad firmware. Sin observación renderizada, revisión visual ni validación por instrucción del usuario.

| Familia | Evidencia | Cobertura | Verificación | Aprobación |
| --- | --- | --- | --- | --- |
| Workspace IR/Balance | Propuesta aplicada | Código para escritorio y móvil | No verificada | Borrador autorizado |
| Pasos IR y curva con dispersión | Propuesta aplicada | Captura, resultados e histórico a 5 cm | No verificada | Pendiente de revisión |
| Historial, comparación y métricas de balance | Propuesta aplicada | IndexedDB, JSON y gráficos | No verificada | Pendiente de revisión |
| Resultados PID y sensibilidad | Propuesta aplicada | Propuesta/rechazo/datos insuficientes | No verificada | Pendiente de revisión |

Las gráficas no interpolan decorativamente datos reales. Las series combinan color con trazo/leyenda. Un botón principal guía cada etapa; las operaciones de adquisición y análisis mantienen cancelación. No hay cambio de ganancias desde UI ni afirmación de estabilidad física. Tokens y recetas se encuentran en src/index.css; no se creó una paleta propia de calibración.

## Reforma de calibración solicitada — 2026-10-01

La composición anterior queda sustituida en su presentación. Objetivo: CalibrationWorkspace, IrCalibrationWorkbench y superficies del BalanceWorkbench. Fuentes de identidad: manual 0.3.0, tokens, componentes, decisiones y BrandMark; se conserva la autorización registrada para aplicar el borrador. Evidencia confirmada: marca y paleta. Observada: cabecera instrumental, estado cercano y superficies legibles. Propuestas aplicadas: preparación en dos columnas con referencia de 5 cm, pasos subrayados, jerarquía de acciones y disposición móvil en una columna.

Se consolidan los estilos en src/features/calibration/calibration.css y se retiran ambos bloques antiguos de calibración de index.css. Se elimina blur y sombra por bloque, se corrige el selector del contenedor de diálogo (la clase de calibración está en el propio app-dialog), se elimina padding duplicado, se añade BrandMark y se usan tonos semánticos. Los botones secundarios son neutros; el acento señala selección y la acción principal. Se conservan procedimientos, datos y contratos.

Cinco reglas de esta reforma: marca común; paleta fija y tokens; superficies sólidas para lectura; estado junto a la operación; una jerarquía estable con acciones secundarias discretas. Cobertura en código: preparación/captura/resultados IR, cabecera/selector, formulario e historial Balance, claro/oscuro vía tokens y disposición móvil. Verificación en ejecución: No verificada. No se ejecutaron tests, builds, validaciones ni revisión visual por instrucción del usuario. La aceptación estética de esta nueva propuesta queda pendiente.


## Studios — D-15 · Propuesta aplicada

Diagrama UNER: panel → contexto → campos desplegables nativos (etiqueta, offset, valor, nota y descripción) → payload → checksum. El mapa de bytes consume roles de campo equivalentes. La etiqueta y offset transmiten significado aunque no se perciba el color. Salidas con código monoespaciado, reflujo y botón Copiar adyacente. OLED conserva el lienzo pixelado y su zoom; el marco fluye por contenido y los paneles se redistribuyen. Tokens locales de espaciado, radio, fondo de código y borde en src/features/studio.css heredan alias --ui-*.

Cobertura de fuente: constructor/traductor, galería/editor/código/envío; temas y media queries. Verificación visual, contraste y sesión física: No verificada. [Informe](studio-refinement-2026-10-02.md).

2026-10-06 — Propuesta implementada: tarjeta de estado FOLLOW, calibraciones blanco/pista y modal de pendientes al intentar iniciar. Ver [cobertura y límites](line-follow-2026-10-06.md).

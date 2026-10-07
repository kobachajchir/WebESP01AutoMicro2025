# Reorganización de MPU + IR — 2026-10-05

Aplicación del manual 0.3.0, cuyo borrador ya está autorizado. Fuente visual canónica: panel MPU + IR y cabecera colapsable de Control real, con sus tokens y primitivas. Objetivo: distribución de controles y telemetría de `/statics`. No se redefine marca ni paleta, y se preservan los cambios anteriores de logos fuera de esta tarea.

Disposición **Confirmada por el pedido y sus correcciones posteriores**: quitar el panel independiente de emisión; separar Haz objetos y Haz líneas en la barra lateral; LED blancos con toggle en Herramientas; informar ±30° desde el eje del LED (60° total) bajo el toggle; quitar el cono blanco, su opacidad y el preview; Vistas colapsable arriba de la escena, con iconos y ancho completo; mantener cuadrícula, origen, cámara y MPU Render; quitar Congelar pose; Limpiar sensores y Calibrar sensores junto a sensibilidad IR, calibración última a la derecha; Estado del sistema junto a Posición estimada y Seguimiento de línea debajo. Todos los desplegables empiezan cerrados. Gráfica en tiempo real es colapsable; en modo real se bloquea sin conexión real y sesión STM, mostrando No conectada debajo. Emulador MPU la abre y habilita sin conexión con estado Simulada.

**Observada**: la identidad de Control real, chevron de dropdown, superficies de 8 px, colores semánticos y estados junto a la acción. **Propuesta aplicada**: `SensorDisclosure` compartido para Vistas, los tres bloques de datos, Haces y la gráfica; seis posiciones principales y ocho ángulos isométricos. Las filas de vistas distribuyen columnas iguales con gaps en todo el ancho, y pasan a tres/dos columnas en pantallas estrechas. Todos empiezan cerrados. Contraerlos solo oculta contenido. La revisión visual no se eleva a aprobación.

| Familia | Cobertura | Evidencia | Verificación |
| --- | --- | --- | --- |
| Vistas, selección y colapso | SensorDisclosure, catálogo de cámara, iconos SVG por dirección, ancho completo y Vista libre al mover manualmente | Disposición e interacción confirmadas, iconos propuestos | No verificada |
| Toggle de luces y apertura | LED blancos en barra lateral; ±30° desde el eje (60° total) debajo del toggle; estado confirmado, bloqueo durante orden, error y consulta | Pedido confirmado, identidad observada | No verificada |
| Estado de emisores | Franja de conexión, sin confundir datos ausentes con apagado | Pedido confirmado y flujo existente | No verificada |
| Sensibilidad y acciones | Slider a la izquierda; limpiar y calibrar a la derecha; reflujo móvil | Pedido confirmado, adaptación propuesta | No verificada |
| Haces, opacidad y visibilidad | Dropdown debajo de sensibilidad; dos sliders IR 0–100 %, porcentaje y checkbox Mostrar; dos columnas que se apilan | Ubicación y controles confirmados, composición propuesta | No verificada |
| Paneles de telemetría | Dos columnas y seguimiento abajo; una columna en móvil | Orden confirmado, composición propuesta | No verificada |
| Gráfica en tiempo real | Modo real bloqueado sin conexión; simulación disponible sin placa, abierta al activarla e identificada como Simulada; historiales separados | Disponibilidad y nombre confirmados, composición propuesta | No verificada |
| Luz blanca binaria y detección de objetos | Iluminación fija solo con LED encendido confirmado; sin cono blanco ni preview; burbuja y sección por eje | Interacción pedida, composición propuesta | No verificada |

Se aplican D-01 (superficie legible), D-02 (tokens de color), D-03 (estado operativo junto al control), D-04 (etiquetas y cifras claras) y D-07/D-08 (formas compartidas y movimiento contenido). Se usan `--ui-ring`, `--ui-radius`, `--ui-accent`, `--ui-field`, `--ui-panel-hover`, `--ui-muted` y `--ui-touch-target`; no se introducen colores nuevos. Chevron, botón y checkbox conservan semántica nativa; las cabeceras exponen aria-expanded/aria-controls y el ajuste mantiene etiquetas y ayuda.

La disposición anterior del informe de emisión queda reemplazada por esta distribución. Emisores IR físicos se conservan dentro de Control real; Haz objetos/Haz líneas afectan solo el dibujo. LED blanco sigue enviando `stm.irEmitters.set` con el estado completo y usa el mismo GET/evento. Sin cambio de payload, permisos, timeout, rutas ni códigos OLED. Limpiar sensores conserva el alcance local; colapsar paneles o elegir cámara no envía comandos.

La extensión **Haces** usa etiquetas visibles, porcentajes con cifras tabulares, sliders nativos y casillas Mostrar para objetos y líneas. Comparte su visibilidad con Herramientas y conserva valores al contraerse. Ambos grupos IR parten de 2 %. Desde el 2026-10-06 se elimina el grupo blanco de este bloque: su encendido depende exclusivamente del toggle de LED blancos, reutilizando el componente ToggleButton y el estado confirmado del equipo.

El brillo blanco hacia el suelo conserva emisor, luz dirigida, mancha, halo e iluminación reflejada del modelo con ganancia fija. La corrección del 2026-10-06, confirmada por el pedido, fija 30° desde el eje central (±30°, 60° total), quita la malla del cono blanco y retira opacidad, Mostrar blanco y preview. Los efectos solo aparecen con lights=true confirmado y equipo disponible. El toggle conserva espera, bloqueo y errores existentes. La composición aditiva participa en la transmisión del acrílico, sin modificar GLB ni materiales. Son ganancias visuales, sin medición fotométrica. Fuente: IrEmittersControls, SensorBeamControls, beamVisualSettings, MpuIrScene3D y UnderbodySensorBeams. Sin tests, compilaciones ni validaciones visuales/físicas por instrucción del usuario.

La detección de objetos incorpora una burbuja centrada en el eje y una sección perpendicular tenue para cada sensor, sin alterar los materiales de los conos aprobados en el pedido. Su opacidad independiente evita perder la lectura con haces al 2 %. Se deriva su posición desde distancia estimada en coordenadas CAD; la telemetría existente conserva ADC y añade centímetros estimados o Ambigua/Fuera curva/Fuera rango. El texto diferencia ausencia de lectura, estimación y calibración no invertible, sin afirmar una medición de distancia enviada por firmware. No se agrega un movimiento ornamental: la posición sigue las lecturas.

Los iconos de `SensorCameraViewIcon` proyectan un bloque con frente, parte trasera y base distinguibles desde la dirección de cada preset. Consumen currentColor y conservan etiquetas visibles; no requieren imágenes externas. OrbitControls distingue movimiento manual de movimientos programáticos para deseleccionar solo en el primer caso. La gráfica usa muestras reales, se pausa sin adquisición y limpia su historial al perder disponibilidad; no se confunde con los controles de pose del modelo. Los tres trazos combinan color y patrones continuos/discontinuos.

Cobertura: fuente y documentación. Sin tests, compilaciones, screenshots ni validaciones de vista, teclado, contraste o hardware por instrucción del usuario. La deuda previa de estilos literales no se amplía al resto de la aplicación; el nuevo componente compartido utiliza los tokens existentes. La revisión en móvil/escritorio, ambos temas y estados conectado/desconectado sigue pendiente cuando se autorice.

## Vistas compactas agrupadas — 2026-10-05

Disposición **Confirmada por el pedido**: una grilla exterior con dos bloques
contiguos en una fila de escritorio, Principales e Isométricas. Principales usa
una grilla de 3 × 2 que empareja frente/trasera, izquierda/derecha y arriba/abajo
por columna. Isométricas reúne sus ocho botones en dos filas internas de cuatro,
identificadas como Sup. e Inf. Se conservan los catorce presets, sus iconos y sus
posiciones; seleccionar sigue restaurando la cámara y moverla deja Vista libre.

Etiquetas cortas **Propuestas aplicadas**: Frente, Trasera, Izq., Der., Arriba,
Abajo y Fr./Tr. con der./izq. Los nombres completos quedan en la cabecera de
selección, el title y el nombre accesible de cada botón. Se reducen icono, gap y
padding, conservando área táctil, foco y selección mediante tokens compartidos.
En pantallas estrechas se apilan los bloques; en móvil pequeño las filas
isométricas usan dos columnas para mantener legibilidad. No se agrega color,
efecto o contrato remoto. Cobertura en fuente; sin tests, builds ni validación
visual por instrucción del usuario. Registro: actualización de AMI-20261005-03.

## Gráfica simulada y ejes automáticos — 2026-10-05

Interacción **Confirmada por el pedido**: Emulador MPU habilita la gráfica sin
conexión y la identifica como Simulada. La curva usa Euler de la simulación,
incluyendo cambios manuales y valores fijos, con el intervalo local seleccionado.
La apertura al activar simulación es **Propuesta aplicada** para mostrar la
curva solicitada; puede contraerse después. Cambiar de fuente borra el historial
para no mezclar datos reales y simulados. La fuente real conserva requisitos de
conexión/sesión, Flujo MPU y muestras nuevas confirmadas.

Cada slider incorpora antes una casilla Auto/Fijo, activada inicialmente. Solo
controla el movimiento automático de ese eje: desmarcar conserva su ángulo y
permite ajustarlo con slider, botones y Restablecer. El movimiento global sigue
operando sobre los ejes marcados. Se conservan estas elecciones mientras la
pantalla permanece montada. Identidad **Observada**: tokens de acento, superficie,
borde y foco existentes; distribución de casilla/slider **Propuesta aplicada**.
Cobertura en fuente y documentación; sin tests, compilaciones, validación visual
o física. No se cambian protocolos ni se regenera bundle/data ESP.

## Simulación separada de las herramientas reales — 2026-10-06

MPU + IR reúne los controles locales en un panel desplegable Simulación, debajo
de las vistas y la gráfica y separado del panel Control real. El interruptor
general queda accesible con el dropdown cerrado. Movimiento y objetos tienen
interruptores independientes, pausa automática y períodos locales propios.
Encender movimiento inicia los ejes Auto; encender objetos inicia un barrido
delante del auto. Pausar objetos permite ubicarlos manualmente en la escena.
La trayectoria del objeto pertenece al mundo y las lecturas se proyectan usando
la pose vigente del vehículo. Contraer el panel no detiene los simuladores.

Vistas, escena y gráfica MPU muestran una pill Simulado cuando su fuente local
está activa. El flujo real correspondiente queda deshabilitado mientras se usa
su simulador; apagarlo deja la adquisición real disponible para iniciar.
Los emisores físicos conservan sus controles confirmados y comandos existentes.

Seguidor también separa su simulación en un dropdown inferior, con encendido
general, movimiento, obstáculos e intervalo local. Arranca apagada. Las muestras
locales incluyen la marca de línea válida para permitir avanzar al modelo.
Apagar retira los puntos y obstáculos simulados, conservando los reales.

Cambios de interfaz y generación local; sin nuevos comandos, payloads remotos,
screen codes ni modificaciones de firmware. Sin tests, builds ni validaciones
por instrucción del usuario. Bundle y data ESP no regenerados.

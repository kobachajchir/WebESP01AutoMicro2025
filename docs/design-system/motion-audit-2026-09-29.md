# Auditoría de movimiento y modales · 2026-09-29

**Alcance:** rutas de acceso, dashboard, Control, Wi‑Fi, MPU/IR, Seguidor, UNER Studio, Docs y OLED; cabecera, botones, switch, tarjetas, diálogos y carga compartidos. Revisión de código, sin ejecución visual ni medición. El usuario pidió aplicar cambios y no ejecutar tests ni validaciones.

## Hallazgos y correcciones aplicadas

| Antes | Después | Por qué |
| --- | --- | --- |
| La navegación esperaba la salida anterior (`mode="wait"`) y animaba blur, escala y desplazamiento horizontal; varias acciones también pedían View Transitions. | Una transición compartida de 180 ms con opacidad y desplazamiento vertical mínimo, sin espera serial ni transición nativa duplicada. | Mantiene orientación espacial y reduce el tiempo y el trabajo de dibujo entre rutas. |
| Los modales no bloqueaban el contenedor real de scroll de las rutas; el PIN solo bloqueaba `body`. | El modal común y el PIN se montan en un portal. Bloquean documento y contenedor de ruta mientras se ven, incluso durante la salida; el contenido del diálogo desplaza por dentro. | Evita que la página se mueva detrás del diálogo. |
| El diálogo compartido animaba blur y tardaba 400 ms; mostraba una manija móvil sin arrastre implementado. | Entrada/salida simétricas en 240 ms con opacidad y transform; en móvil asciende desde el borde inferior. Se retiró la manija. | Da relación espacial sin prometer un gesto inexistente ni retrasar la acción. |
| El PIN sacudía el error, rebotaba cada dígito y esperaba entre estados. | Estado de error/entrada con transición de 200 ms; dígitos con 140 ms sin rebote y variante suave para movimiento reducido. | El error se lee con texto y color; la sacudida no aportaba información. |
| El switch animaba fondo con un literal de color y escuchaba `click` además de teclado manual. | Fondo por tokens del tema, indicador con desplazamiento de 240 ms y teclado nativo de botón. | Conserva respuesta directa y evita una posible doble activación con teclado. |
| Docs escalonaba todas las tarjetas durante 400 ms y revelaba imágenes con blur. | Tarjetas disponibles de inmediato; imagen con fundido de 180 ms sin filtro. | La documentación se visita para leer y navegar, no para esperar una presentación. |
| El estado de enlace y el loader tenían pulsos ambientales constantes; la carga de ruta mostraba una pantalla ilustrada completa. | Estado de enlace estático, carga de ruta compacta y pantalla de arranque sin pulso. | Menos movimiento periférico y menor trabajo de dibujo; la carga sigue nombrando el estado. |
| Múltiples superficies anidadas repetían `backdrop-filter`; `transition-all` aparecía en controles. | Vidrio reservado para marcos/capas flotantes y transición de propiedades explícitas en controles compartidos. | Reduce trabajo visual y evita animar propiedades de layout por accidente. |
| Bloques de Control y línea de tiempo se elevaban al hover con `transition-all`; Guardar, Duplicar y Eliminar quedaban en tres columnas incluso en móvil estrecho. | Se quitó la elevación de esas acciones frecuentes, se nombraron las propiedades de la línea de tiempo y el grupo de acciones pasa a dos columnas con Eliminar en una fila completa bajo `sm`. | Hace más estable el trabajo de precisión y da espacio a los nombres de acción en móvil. |

## Oportunidades que superaron el filtro

| # | Ubicación | Propósito | Frecuencia | Movimiento aplicado |
| --- | --- | --- | --- | --- |
| 1 | Modal compartido y PIN | Relación espacial y cambio de estado | Ocasional | Opacidad y `transform`, 200–240 ms, curva `cubic-bezier(0.23, 1, 0.32, 1)`; salida por la misma trayectoria; sin desplazamiento con movimiento reducido. |
| 2 | Botones, cabecera, tarjetas y switch | Feedback al tocar | Decenas de veces por día | Presión `scale(0.97)` durante 100–120 ms; sin espera para activar. Hover con desplazamiento solo en puntero fino. |
| 3 | Ruta compartida | Evitar salto de contenido | Ocasional | Opacidad y `translateY(8px) scale(0.99)` a reposo en 180 ms; salida simétrica, sin blur. |
| 4 | Panel Acerca del proyecto | Indicar expansión | Ocasional | Altura y opacidad en 220 ms; se conserva altura por tratarse de un acordeón. Se quitó una segunda entrada CSS. |

## Candidatos rechazados

- **Valores de sensores y telemetría:** los datos se leen y comparan en tiempo real; un movimiento decorativo dificultaría la lectura.
- **Estado de enlace en vivo:** un pulso permanente no mejora la comprensión, pues el texto ya indica el estado.
- **Tarjetas de Docs en cascada:** cada visita debe permitir lectura inmediata; 400 ms de aparición repetida perjudicaban esa tarea.
- **Manija de arrastre en modal móvil:** se retiró porque no existe un gesto de arrastre real que siga el dedo.
- **Animación de acciones de teclado frecuentes:** se mantiene respuesta inmediata; no se agrega espera ni gesto ornamental.
- **Elevación de bloques de Control y línea de tiempo:** son herramientas de selección y arrastre usadas seguido; el desplazamiento en hover interfería con la percepción de posición.

## Riesgo y alcance de la conclusión

El mayor beneficio esperado viene del bloqueo correcto del scroll y de quitar blur/transiciones duplicadas en navegación. La fluidez, los fotogramas, el foco con modales simultáneos y el resultado visual en distintos tamaños siguen sin verificarse porque no se ejecutaron tests ni una sesión renderizada. La identidad (colores, Inter, vehículo e iconos) no cambia; nombre, logo y favicon continúan como decisiones D-09.

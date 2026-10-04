# Manual operativo de identidad visual

**Producto:** AutoMicro, sin año en el nombre visible. **Versión:** 0.3.0. **Aprobación:** nombre, logo, términos y gama de color confirmados; resto del manual en borrador. La fuente y los límites están en [sources.md](sources.md); los ID enlazan con [decisions.md](decisions.md). La interfaz renderizada sigue **No verificada**.

## Esencia y promesa visual

**Inferida · D-01/D-03/D-05.** La web se presenta como consola de un vehículo experimental conectado. Debe hacer comprensibles control, telemetría y conectividad en un entorno visual técnico. La personalidad visible es precisa, instrumental y contemporánea: datos claros, cian luminoso contenido y un vehículo dibujado como plano digital. Es una inferencia de las cinco superficies, no una promesa de marca aprobada.

## Principios de decisión

1. **Primero operación y estado · Inferida · D-03.** En una acción que dependa del ESP o STM32, mostrar conexión, disponibilidad y feedback inmediato. Correcto: botón con estado próximo. Incorrecto: comando disponible sin contexto de enlace.
2. **Luz con significado · Observada · D-02.** El cian guía atención y foco; verde, rosa y ámbar tienen sentido funcional. Correcto: resaltar selección o conexión. Incorrecto: colorear todos los paneles con igual intensidad.
3. **Profundidad contenida · Observada · D-01/D-07.** Usar grilla y brillo como ambiente, con paneles que sostienen lectura. Correcto: grilla de baja opacidad detrás. Incorrecto: telemetría sobre un fondo brillante o una imagen sin máscara.
4. **Vehículo como hilo visual · Observada · D-05.** Repetir la misma familia gráfica cuando una sección represente una capacidad del auto. Correcto: tarjeta de WiFi con ondas sobre el vehículo. Incorrecto: mezclar estilos de ilustración sin una función clara.
5. **Gama fija en dos modos · Confirmada · D-06/D-14.** Componentes nuevos consumen roles semánticos. Correcto: `--ui-text` y `--ui-panel`. Incorrecto: cambiar libremente la base o el acento, o usar texto blanco literal en un panel claro.

## Gramática de composición

**Observada · D-01/D-03/D-04.** En vistas operativas domina el título y el área de trabajo; sigue una franja de estado, luego controles y datos. El fondo técnico acompaña. El dashboard concentra navegación con tarjetas ilustradas y una franja de salud del sistema. Login es una excepción de acceso: una única tarjeta centrada, con logo, instrucciones, PIN y feedback. En MPU la escena 3D ocupa el centro y herramientas/datos la rodean; en Control la simulación precede la edición de secuencias; en WiFi el modo y la conexión preceden al formulario.

La cabecera compartida ofrece identidad de sección y acciones de navegación. Un título nunca debe competir con demasiados badges del mismo peso. En contenido técnico, agrupar datos por función y mantener una acción primaria reconocible.

## Color y temas

| Rol | Oscuro fijo | Claro fijo | Uso |
| --- | --- | --- | --- |
| Fondo base | `#070b10` | `#f8fafc` | Lienzo |
| Superficie sólida | `#101a24` | `#ffffff` | Paneles y diálogos legibles |
| Texto principal | `#f8fafc` | `#0f172a` | Títulos, datos y controles |
| Texto secundario | `#cbd5e1` | `#475569` | Descripción y ayuda |
| Texto tenue | `#a8bacd` | `#526277` | Metadatos, nunca la única señal de estado |
| Verde azulado base | `#0f766e` | `#047857` | Acción primaria y éxito |
| Cian / azul acento | `#22d3ee` | `#0369a1` | Foco, título y selección |
| Error / advertencia | `#fb7185` / `#fbbf24` | `#e11d48` / `#d97706` | Estado, con texto explicativo |

**Confirmada · D-02/D-06/D-14.** Estas gamas son fijas: el usuario elige modo claro u oscuro, no colores arbitrarios. En oscuro el cian luminoso se usa sobre azul casi negro; en claro se usa su variante azul más profunda sobre superficies claras. El verde azulado sigue la misma lógica. Las capas suaves usan las mismas tintas con alfa `0.34/0.18/0.08` en oscuro y `0.14/0.07/0.04` en claro; el anillo de foco usa el acento al `0.56`. El texto de acción es `#f8fafc` sobre base/acento en claro y se elige automáticamente según el fondo en oscuro. Los textos secundarios y los campos claros se oscurecieron para mejorar legibilidad. Los estados conservan texto e icono, no dependen solo del color. Los marcos pueden emplear `#03070d` como soporte para el logo y para preservar el brillo azul en ambos modos.

## Tipografía y voz

**Observada · D-04.** La interfaz usa `Inter` si está disponible, seguido por fuentes sans del sistema; no se observó un archivo de fuente propio ni una carga remota en el bootstrap. Títulos principales son muy pesados (`font-weight: 900`), con subrayado/acento corto. Encabezados de sección y tarjetas usan 800–900 y, en navegación, mayúsculas. Texto de apoyo usa una escala menor y color apagado. Los números de datos pueden usar `.tabular-nums`; el monoespaciado aparece en contextos técnicos. Mantener etiquetas legibles: el tamaño de 0.62–0.72 rem de algunos badges es un patrón observado, pero no se propone como mínimo general.

**Confirmada para términos · D-04/D-14.** La voz explica una acción y el resultado: “Elegí una red”, “Sin enlace”, “Validando...”. En texto visible usar exactamente **WiFi** y **Password**; `WIFI` queda reservado para identificadores internos de código y mensajes de protocolo. Mantener instrucciones en español, con tildes y sin mensajes que dependan solo del color.

## Espacio, grilla y densidad

**Observada · D-01/D-07.** Las vistas grandes usan un marco de hasta 2400 px y separación exterior `clamp(0.75rem, 1.7vw, 1.5rem)`. El login limita su tarjeta a `max-w-md`. Las secciones operativas usan gaps de 0.5 a 1.5 rem y tarjetas internas con 0.75 a 1.75 rem de padding. La grilla ambiental tiene pasos de 42–44 px y opacidad muy baja; no es una grilla de colocación del contenido. No forzar una cuadrícula única en formularios, escena 3D y tarjetas de navegación.

## Forma, material y profundidad

**Observada · D-07.** Radio común `8px`; chips y selectores segmentados son cápsulas; las tarjetas grandes de navegación llegan aproximadamente a `1.05rem`. Los marcos de dashboard conservan borde cian débil, transparencia y profundidad. **Aplicada como propuesta · D-13:** reservar el vidrio para marcos y superficies flotantes. Los paneles y botones anidados prescinden de blur; el diálogo usa una superficie sólida del tema. Así se mantiene la jerarquía sin apilar filtros costosos. `prefers-reduced-transparency` y `prefers-contrast: more` convierten las superficies principales en sólidas.

## Imagen e iconografía

**Logo confirmado · D-05/D-09/D-14.** `LogoDashboardV2.webp` es el símbolo oficial de AutoMicro. Es un vehículo en perspectiva con trazos azules luminosos y transparencia; usarlo sin recolorear, deformar ni eliminar el canal alfa. En cabeceras ocupa `home-brand-glyph` sin recuadro, borde ni fondo propio, con alto de 3.2 rem y ancho adaptable de 4 a 5.25 rem. El login, el estado de carga, la ficha del proyecto y la pantalla 404 reutilizan la misma imagen también sin marco. En modo claro recibe una sombra suave para mantener definición. El favicon deriva del mismo archivo. `LogoMPUIRV2.webp`, `LogoControlV2.webp`, `LogoSeguidorV2.webp` y `LogoWifiAPV2.webp` son ilustraciones de navegación transparentes, no logos alternativos. Se muestran completas sobre fondos de tarjeta definidos por el tema: azul profundo en oscuro y azul pálido en claro. La imagen no se estira ni se recorta; el degradado protege títulos y datos sin tapar el vehículo.

## Movimiento e interacción

**Observada como punto de partida · D-08.** Había navegación con espera entre salida y entrada, blur y una transición nativa adicional; tarjetas de documentación con entradas escalonadas de 400 ms; PIN con sacudida y rebote; modales de 400 ms. Estas observaciones son de código, sin comprobación visual.

**Aplicada como propuesta · D-11.** El movimiento debe comunicar respuesta, relación espacial o cambio de estado. Una pulsación usa escala `0.97` durante 100–120 ms; las acciones frecuentes no esperan una animación para funcionar. Las rutas entran y salen por el mismo eje vertical en 180 ms con `opacity` y `transform`, sin blur ni espera serial. Los modales aparecen en 240 ms y desaparecen por la misma trayectoria; en móvil suben desde el borde inferior. PIN y switch usan transiciones de estado de 140–240 ms sin rebote decorativo. Los datos de telemetría, indicadores de enlace y progreso no se animan para adornar. La entrada del contenido de documentación no se escalona.

**Reglas de implementación · D-11.** Usar `--ease-out`, `--ease-in-out` y `--ease-drawer` para futuras transiciones; nombrar propiedades, evitar `transition: all`, animar `transform`/`opacity` cuando sea posible y permitir interrupción. Solo los gestos con arrastre necesitan resorte con velocidad. Desactivar elevación de hover en puntero táctil. Con movimiento reducido, quitar desplazamiento y mantener un fundido breve en rutas y diálogos. No se midió la fluidez en dispositivos reales.

## Responsive y accesibilidad

**Observada · D-01/D-03.** Bajo 820 px se eliminan bordes laterales del marco, los encabezados pueden partirse y los paneles pasan a columnas únicas; en MPU la escena recibe alto definido y herramientas se reorganizan. WiFi apila columnas de formulario y red; Control combina `sm`, `md` y `xl` para redistribuir grupos. Login mantiene ancho máximo y relleno menor en móvil. Es una lectura de reglas CSS, no una comprobación visual.

**Aplicada como propuesta · D-12.** El contenedor de ruta usa `100dvh` y desplaza su contenido; el dashboard puede crecer más allá de la altura visible. Las cabeceras compartidas envuelven identidad, acciones y estado bajo 820 px. Las tarjetas de navegación pasan a una proporción horizontal en móvil y la escena MPU limita su alto respecto de la ventana. Áreas tocables principales: mínimo 2.75 rem. Mantener botones de precisión más densos solo cuando el contexto lo justifique.

**Observada y aplicada · D-10/D-12.** Hay nombres accesibles en acciones iconográficas, `role="alert"`/`role="status"` y `aria-live` en feedback de PIN. La revisión suma foco visible compartido. Los modales se montan sobre la ventana, llevan el foco a su primer control, lo mantienen dentro y lo devuelven al disparador al cerrar. Bloquean el scroll de la ruta y del documento; el contenido del diálogo conserva scroll propio. El switch utiliza el evento nativo de teclado, sin un segundo manejador que duplique el cambio. Quedan pendientes la comprobación visual de contraste y una comprobación con teclado y dispositivos reales.

## Rendimiento percibido

**Aplicada como propuesta · D-13.** Evitar trabajo que no comunica estado: no duplicar la transición nativa y la de React, no dibujar el fondo de carga completo en cada importación diferida, no desenfocar cada panel anidado ni mantener pulsos decorativos constantes. La carga de ruta usa un indicador compacto; la pantalla de arranque conserva su identidad visual sin pulso ambiental. Son decisiones de código para reducir trabajo de dibujo y latencia percibida, pendientes de medición en dispositivo.

## Antipatrones y gobernanza

- **Propuesta · D-02/D-06:** no agregar colores literales a componentes nuevos cuando exista un rol semántico; si falta un rol, documentar su intención antes de crear el valor.
- **Propuesta · D-01:** no llevar grilla, glow ni 3D a todos los espacios: cada efecto debe ayudar a ubicar una función o reforzar la familia visual.
- **Propuesta · D-03:** no presentar una acción física sin su estado, bloqueo o feedback contextual.
- **Propuesta · D-05/D-09:** no publicar las ilustraciones de navegación como logotipo hasta resolver identidad institucional.

Los cambios de identidad deben registrar decisión, fuente, alcance, token o componente afectado y aprobación en `decisions.md`. Una actualización de las cinco fuentes exige revisar solo las decisiones que dependen de la fuente cambiada. Este manual permanece en `draft` hasta aprobación explícita.

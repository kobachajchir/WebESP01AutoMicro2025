# Registro de decisiones

Las decisiones D-02, D-06, D-09 y D-14 incluyen confirmaciones explícitas del usuario del 2026-09-30. `Observada` significa presente en las fuentes; aprobación de marca y verificación de la interfaz son campos distintos.

| ID | Fecha | Categoría | Evidencia | Regla y razón | Fuente / alcance | Alternativa y consecuencia | Aprobación |
| --- | --- | --- | --- | --- | --- | --- | --- |
| D-01 | 2026-09-29 | Composición | Observada | Superficie legible sobre fondo técnico tenue: mantiene datos y controles por encima de la ambientación. | `src/index.css`: `.home-command-shell`, `.wifi-dashboard-shell`, `.sensor-dashboard-shell`; dashboard, WiFi, MPU | Fondo plano: perdería el carácter actual. | Pendiente |
| D-02 | 2026-09-30 | Color | Confirmada | Azul casi negro, cian y verde azulado son la gama fija. Cian señala títulos, foco e información; verde éxito, rosa error, ámbar advertencia. | Confirmación del usuario; `src/index.css`, `src/utils/theme.ts`; cinco vistas | Cambiar los colores centrales rompería el reconocimiento visual. | Confirmada para la gama; contraste renderizado pendiente |
| D-03 | 2026-09-29 | Información | Inferida | Estado de conexión y acción cerca del área operativa para distinguir sistema real, simulación y ausencia de enlace. | Encabezados, tiras y banners de `/home`, `/control`, `/wifi`, `/statics` | Solo un indicador global ocultaría contexto local. | Pendiente |
| D-04 | 2026-09-29 | Tipografía y voz | Observada | Títulos de alto peso, etiquetas cortas, cifras tabulares cuando corresponda y mensajes de acción en español. | `src/index.css`, `PageHeader.tsx`, cinco vistas | Texto ornamental dificultaría lectura de telemetría. | Pendiente |
| D-05 | 2026-09-29 | Imagen | Observada | Ilustración azul del mismo vehículo con motivos funcionales en tarjetas de navegación; no declararla logo institucional. | Imágenes `Logo*.webp` y tarjetas en `Home.tsx` | Pictogramas genéricos perderían continuidad temática. | Pendiente |
| D-06 | 2026-09-30 | Tema | Confirmada | Los modos claro y oscuro usan variantes fijas de la misma gama y alias semánticos; el modo se puede alternar, la base y el acento no se personalizan. | Confirmación del usuario; `src/utils/theme.ts`, selectores `[data-theme]` | Colores arbitrarios rompen la identidad y pueden reducir contraste. | Confirmada para las gamas; contraste renderizado pendiente |
| D-07 | 2026-09-29 | Forma y profundidad | Observada | Contenedores de 8 px, bordes finos y blur moderado; tarjetas de módulo más redondeadas como excepción de navegación. | `--ui-radius`, `.app-panel`, `.home-module-card` | Un radio único para todo aplanaría la jerarquía de navegación. | Pendiente |
| D-08 | 2026-09-29 | Movimiento | Observada | Transiciones breves de estado y navegación con salida clara; respetar preferencia de movimiento reducido. | `PinScreen.tsx`, `RootLayout.tsx`, `src/index.css` | Movimiento largo entorpece control operativo. | Pendiente |
| D-09 | 2026-09-30 | Marca | Confirmada | El nombre visible es **AutoMicro**, sin año. `LogoDashboardV2.webp` es el logo; ocupa `home-brand-glyph` en todas las cabeceras y origina el favicon. | Confirmación del usuario, PNG entregado y convertido a WebP; `PageHeader`, login, `index.html` | El año y las ilustraciones de módulos crearían nombres o logos alternativos. | Confirmada |
| D-10 | 2026-09-29 | Extensión | Propuesta | Para componentes no observados, usar los mismos tokens, estados y jerarquía; revisar cada propuesta antes de adoptarla. | Huecos de cobertura de `components.md` | Copiar otra página daría autoridad a una fuente no elegida. | Pendiente |
| D-11 | 2026-09-29 | Movimiento | Propuesta aplicada | Respuesta inmediata a presión; ruta y modal entran/salen por trayectoria simétrica en menos de 300 ms, sin blur ni espera serial; movimiento reducido conserva fundido breve. | `RootLayout.tsx`, `modal.tsx`, `PinScreen.tsx`, `ToggleButton.tsx`, `src/index.css`; todas las rutas | Mantener transiciones duplicadas y entradas decorativas aumenta espera y trabajo de dibujo. | Pendiente |
| D-12 | 2026-09-29 | Disposición y accesibilidad | Propuesta aplicada | Usar altura dinámica, cabeceras que envuelven, tarjetas horizontales en móvil, escena MPU adaptable; portal, foco contenido y bloqueo del scroll de fondo en modales. | `src/index.css`, `modal.tsx`, `PinScreenModal.tsx`, `useModalScrollLock.ts`; vistas compartidas | El viewport fijo y el bloqueo de `body` solamente pueden recortar contenido o permitir scroll detrás del modal. | Pendiente |
| D-13 | 2026-09-29 | Rendimiento percibido | Propuesta aplicada | Mantener transparencia en marcos y capas flotantes; quitar blur anidado, pulsos ornamentales y carga gráfica completa en cada ruta. | `src/index.css`, `App.tsx`, `DocsSection.tsx`; todas las rutas | El material repetido aumenta dibujo y el loader pesado oculta el avance de la ruta. | Pendiente |
| D-14 | 2026-09-30 | Marca y lenguaje | Confirmada | Texto visible **WiFi** y **Password**; conservar identificadores técnicos internos. El logo se muestra libre de recuadro; en claro usa una sombra leve para mantener definición. | Instrucciones explícitas del usuario; `WifiSection`, `WifiCredentialsModal`, `BrandMark` | Cambiar identificadores de protocolo por motivos de estilo alteraría el contrato técnico. | Confirmada |

## Contradicciones y excepciones

- El candado dejó de ocupar el lugar de marca en el login; el PIN conserva su propio texto de seguridad. El símbolo de cabecera es común a todas las rutas que usan `PageHeader`.
- `AutoLogo.svg` y las ilustraciones anteriores siguen siendo recursos del proyecto, pero la designación oficial de logo corresponde a `LogoDashboardV2.webp`.
- Las variantes de color se fijaron en CSS y `theme.ts`; la revisión de contraste en una interfaz renderizada sigue pendiente por instrucción del usuario.


## D-15 — Studios: datos legibles y superficies contenidas

- Fecha: 2026-10-02.
- Evidencia: Propuesta aplicada; tokens heredados Observados; alcance y uso de las tres skills Confirmados por solicitud.
- Alcance: /protocol y /protocol?studio=oled; src/features/studio.css y primitivas de ambas herramientas.
- Decisión: etiquetas/offsets/details en el diagrama, tamaños y roles comunes de bytes, salida con copia contextual, navegación compacta, OLED por contenido y controles de capas hermanos.
- Alternativa: mantener bloques con glow, ancho fijo y tooltips recortados conservaría los problemas señalados por el usuario.
- Estado: aplicación autorizada; aceptación estética pendiente; ejecución visual No verificada. Compilación completada; sin tests ni prueba física.
- [Cambios, matriz de cobertura y límites](studio-refinement-2026-10-02.md).

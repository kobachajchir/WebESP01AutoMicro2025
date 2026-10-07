# Aplicación de identidad: emisión e iluminación

Modo APLICAR, manual 0.3.0. Se conserva la autorización explícita para aplicar este borrador, registrada en `index.md`. Objetivo: el nuevo panel de emisores de `/statics`; fuente canónica: Panel MPU + IR y primitivas compartidas documentadas en el manual. También se consultaron tokens, componentes, decisiones y fuentes. Las demás páginas no se toman como fuentes visuales nuevas.

La marca y paleta son **Confirmadas**. Paneles, botones y switches existentes son **Observados**. La disposición de tres filas operativas, el ajuste de apertura y la jerarquía del estado son **Propuestas aplicadas**. Los activos Logo*.webp tienen modificaciones anteriores en este checkout; no se redestilaron ni se modificaron, y las reglas de imágenes D-05/D-14 quedan fuera del objetivo de esta aplicación.

| Familia / estado | Evidencia | Cobertura | Verificación | Aprobación |
| --- | --- | --- | --- | --- |
| Superficie, tipografía y paleta | Confirmada + Observada | Tokens semánticos de tema, borde de 8 px y superficie legible | No verificada | Paleta confirmada |
| Switches de emisores | Observada + Propuesta aplicada | `ToggleButton`, etiqueta accesible, teclado nativo, objetivo de 44 px y reducción de movimiento existente | No verificada | Borrador autorizado; composición pendiente |
| Estado conocido, pendiente, desconectado y error | Propuesta aplicada sobre D-03 | Texto junto a acciones, bloqueo durante solicitud, error con role alert y estado sin actualización optimista | No verificada | Pendiente visual |
| Apertura estimada | Propuesta aplicada | Etiqueta visible, unidad en grados, slider nativo con nombre y ayuda, independiente del comando físico | No verificada | Pendiente visual |
| Temas y disposición móvil | Propuesta aplicada | Alias de tema, filas adaptables y consulta de ancho completo bajo 480 px | No verificada | Pendiente visual |

Se usan `--ui-panel-strong`, `--ui-ring`, `--ui-radius`, `--ui-text`, `--ui-muted`, `--ui-accent`, `--ui-success-text`, `--ui-rose` y `--ui-touch-target`. No se introduce una paleta alternativa. Se corrige el recorrido del thumb en tamaño lg del switch compartido para que quede dentro de su pista.

Las cinco reglas aplicadas son D-01 (superficie legible), D-02 (color semántico), D-03 (estado junto a acción), D-04 (voz breve y datos legibles) y D-07/D-08 (forma compartida y movimiento contenido).

Cobertura real: implementación en fuente. No hubo render, comparación antes/después, comprobaciones de contraste, teclado, viewports, tests ni compilaciones, por instrucción expresa del usuario. La revisión visual y la aprobación de la composición siguen pendientes. La principal deuda es la coexistencia previa de estilos literales en la consola; no se amplió esta tarea al resto de la página. Siguiente paso cuando sea autorizado: observar este panel en ambos temas, móvil/escritorio y estados conectado/desconectado/pendiente.

Actualización posterior del mismo día: el usuario reemplazó el panel independiente por controles distribuidos. La composición y cobertura actuales están en [Reorganización de MPU + IR](sensor-layout-2026-10-05.md): LED blancos y apertura en Herramientas, emisores IR en Control real, estados en Conexión y vistas/paneles colapsables. Este informe conserva la evidencia de la primera aplicación.

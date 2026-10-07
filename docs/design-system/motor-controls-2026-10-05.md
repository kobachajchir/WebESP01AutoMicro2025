# Control de motores y balance — 2026-10-05

Aplicación del manual 0.3.0, cuyo borrador autorizado consta en `index.md`.
Fuentes: manual, tokens, componentes, decisiones y primitivas compartidas.
Objetivo: Control de motores; la interfaz compartida también llega al panel
existente de calibración Balance. No se destiló una nueva identidad.

| Decisión | Evidencia | Implementación | Cobertura | Verificación |
| --- | --- | --- | --- | --- |
| Una acción que alterna activar/desactivar balance | Confirmada por solicitud | Etiqueta y `aria-pressed` según `motionArmed` confirmado por F4 | Fuente | No verificada |
| Un único Detener con símbolo stop | Confirmada por solicitud | `stm.motion.stop` con `disableBalance:true`; también corta simulación local | Fuente | No verificada |
| Acciones junto a los botones inferiores | Confirmada por solicitud | Balance, Detener y Consultar estado integrados en la barra de transporte | Fuente | No verificada |
| Balance plegable, cerrado al entrar | Confirmada por solicitud | Botón con `aria-expanded`, `aria-controls` y cuerpo `hidden` | Fuente | No verificada |
| Indicador rojo/verde en diagnóstico | Confirmada por solicitud | Balance desactivado/activado; estado desconocido neutral | Fuente | No verificada |
| Sliders con entrada numérica y lectura tabular | Propuesta aplicada | Inclinación ±6°, giro ±100 %, ayudas y unidades | Fuente | No verificada |
| Superficies, radios, foco y colores comunes | Observada en el manual | Alias `--ui-*`; estilos de transporte acotados a los grupos de motores | Fuente | No verificada |

Un controlador compartido mantiene ajustes, barra e indicador conectados a la
misma respuesta. Activado corresponde al armado confirmado; `balanceActive`
sigue describiendo compensación efectiva en el texto de estado. Una sesión sin
datos no se presenta como balance desactivado. El color acompaña texto e icono.
Una respuesta de aceptación del ESP no actualiza optimistamente la interfaz.

La prueba de motores TEST permanece dentro de los ajustes. Se conservan límites,
pulsos de 750 ms, permisos, guardas, comandos y formatos de la placa. Detener
ahora elige explícitamente desarmar el balance: para volver a compensar hay que
activarlo. La ejecución de secuencias físicas conserva su bloqueo existente.

Reglas aplicadas: tokens semánticos; una sola acción por operación; estado
confirmado próximo al control; campos etiquetados con unidades; ajustes
plegables sin ocultar acciones ni errores. La disposición se adapta mediante
CSS a columnas menores; su apariencia real sigue pendiente de revisión.

Sin tests, builds, validaciones, revisión visual ni prueba física por instrucción
del usuario. No se regeneró el bundle ni se copió a data ESP. Los cambios previos
del checkout se conservan. Registro de flujo: AMI-20261005-07 en Contracts.

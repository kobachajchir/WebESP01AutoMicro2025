# Modales de motores — 2026-10-07

Aplicación solicitada de la identidad visual AutoMicro, Apple Design, Emil Design Engineering y Animate. Fuente: manual 0.3.0 autorizado; colores y superficies mediante los alias semánticos `--ui-*`. Disposición propuesta aplicada, pendiente de aceptación estética.

## Cobertura

Selector de modo físico; requisitos de balance, MPU, objetos, conexión, alineación y seguridad; calibración de motores dentro de GOTO; preparación del ensayo de un metro; información y ajustes de Control. Los diálogos de calibración del Seguidor que comparten este flujo adoptan la misma estructura.

`MotorDialog` compone el modal existente: icono de función, cabecera con contexto AutoMicro, título y explicación, cuerpo con desplazamiento y pie de acciones. La cabecera y el pie permanecen visibles mientras el contenido se desplaza. Las instrucciones, estados y acciones forman grupos con superficies propias; la confirmación de hardware se conserva junto a la operación.

## Antes / Después / Por qué

| Antes | Después | Por qué |
| --- | --- | --- |
| Título y párrafos sin jerarquía compartida | Cabecera con icono, contexto y descripción | Identificar la tarea al abrir el diálogo |
| Botones mezclados con instrucciones | Grupos y pie de acciones estable | Ubicar la siguiente acción y el cierre |
| Preparación de un metro solo textual | Esquema de franjas, pasos y PWM/rampa/límite | Hacer visible la distancia y la configuración |
| Texto de ayuda centrado en el editor antiguo | Libre, GOTO, calibración y detalle de simulación | Explicar el flujo actual de Control |
| Resetear configuración solo escribía en consola | Ajustes con apariencia y acciones reales del dispositivo | Evitar una acción aparente sin implementación |
| Escape manejado por varios modales abiertos | Solo el diálogo al frente maneja Escape y Tab | Conservar el contexto al cerrar un diálogo anidado |
| Modales condicionales desaparecían sin transición de salida | Contenedores montados con apertura controlada | Permitir el cierre animado de los requisitos |

## Movimiento

- Propósito: comunicar la apertura de una tarea sobre el contexto actual y volver a ese contexto al cerrar.
- Herramienta: Framer Motion ya instalado y modal compartido. Sin nuevas dependencias.
- Escritorio: opacidad y transformación desde 8 px / escala 0.96; móvil: desplazamiento de 32 px.
- Entrada y salida simétricas: 240 ms, curva `[0.23, 1, 0.32, 1]`.
- Movimiento reducido: solo opacidad, 120 ms; botones sin escala ni transiciones.
- Presión de botones: escala 0.98 en 100 ms; no se anima la telemetría, no hay movimiento periódico.
- Durante la aplicación del modo se bloquea también el cierre y se conserva la confirmación de F4.

## Identidad aplicada

1. Contenido sobre superficies legibles; sin brillo ornamental.
2. Cian para identidad, foco y acciones; verde para estado confirmado.
3. Estado de dispositivo junto a sus acciones.
4. Títulos claros, instrucciones breves y números con ancho tabular.
5. Cabecera integrada al contexto AutoMicro; los iconos funcionales representan tareas, sin sustituir el logo del producto.

Los comandos, payloads y rutas existentes se conservan. F4, ESP01 y Qt no necesitan cambios de contrato por este ajuste visual.

## Estado y límites

Fuente implementada. No se ejecutaron tests, compilaciones, validaciones ni revisión en navegador, según instrucción del usuario. Falta compilar y actualizar el paquete Web distribuido por ESP01 para incorporar estos cambios. La apariencia en escritorio/móvil y la interacción con hardware quedan sin comprobar.

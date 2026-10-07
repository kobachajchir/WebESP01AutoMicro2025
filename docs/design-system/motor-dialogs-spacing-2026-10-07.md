# D-20 — Modales cómodos y referencias de calibración

Fecha: 2026-10-07. Confirmado por solicitud: modales más amplios, contenido separado, botones cómodos, selector de modo del Dashboard y checks para blanco/pista. Fuentes observadas: Home.tsx, selector desplegable del Dashboard y manual AutoMicro 0.3.0 ya autorizado. Skills: Visual Identity System, Apple Design y Emil Design Engineering.

| Before | After | Why |
| --- | --- | --- |
| Modal común limitado a 40 rem | Hasta 52 rem; superficie de trabajo hasta 88 rem | Dar espacio real al contenido |
| Botones sin relleno interno explícito | Altura de 48 px, padding propio y separación entre acciones | Evitar texto pegado al borde y mejorar interacción |
| Grupos con separación de 1 rem | Cuerpo de 2 rem y grupos separados por 1.5 rem | Distinguir instrucciones, estado y acciones |
| Selector segmentado en modo físico | Componente desplegable compartido con Dashboard | Usar la referencia que eligió el usuario |
| Blanco/pista expresados como texto suelto | Tarjetas con indicador de condición y estado confirmado | Hacer visible qué referencia falta |
| Acciones duplicadas cuando faltaba calibración | Tarjeta pendiente inicia el procedimiento; botón explícito para recalibrar | Simplificar la siguiente acción |
| Cabecera repetida dentro del modal de línea | Variante integrada de la calibración | Reducir ruido sin perder contexto |

## Cobertura y comportamiento

Los ajustes de tamaño, espaciado y botones se aplican al contenedor común MotorDialog y todos sus consumidores. Se conserva el movimiento de entrada/salida de 240 ms y la variante reducida de 120 ms.

CarModeDropdown reutiliza la presentación del Dashboard y se comparte entre Home y CarModeSelectorModal. Mantiene las opciones IDLE/FOLLOW/TEST/GOTO y ofrece navegación por teclado y cierre del menú con Escape. En Dashboard seleccionar envía el cambio existente; en el modal seleccionar prepara la opción y Aplicar conserva el envío con confirmación de la F4. La etiqueta GOTO deja de caer en Sin sincronizar en Home.

Blanco y Sobre pista utilizan ConditionStatus: check verde confirmado, cruz roja pendiente, estado neutro sin lectura. Son referencias del dispositivo, no marcas manuales. La tarjeta pendiente inicia el mismo procedimiento que el botón anterior; se respetan conexión, sesión, busy y pending. Pista requiere blanco calibrado. Las referencias completas muestran acciones de recalibración. La consulta explícita sigue disponible si falta el estado.

La composición se adapta a una columna en pantallas pequeñas. El modal de sensores elimina su cabecera interior duplicada. Los cambios de la calibración se comparten con su presentación en el banco de IR.

## Identidad y límites

Se conservan superficies legibles, acento semántico, estado junto a la operación, tipografía clara y contexto AutoMicro. Las dimensiones y la organización son propuestas aplicadas, pendientes de aceptación visual. No cambian comandos, payloads, rutas ni permisos de hardware.

No se ejecutaron tests, compilaciones, validaciones ni revisión en navegador, conforme a la instrucción del usuario. Queda pendiente compilar la Web y actualizar el paquete servido por ESP01. No se requieren modificaciones de firmware F4 ni Qt por estos cambios.

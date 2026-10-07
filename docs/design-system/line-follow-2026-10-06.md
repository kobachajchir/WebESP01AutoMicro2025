# Seguimiento y calibración de línea — aplicación 2026-10-06

Modo APLICAR, sobre el manual AutoMicro v0.3.0 draft autorizado en el índice/adopción. Qt adopta la misma identidad mediante Theme.qml y componentes QML. No se ejecutó auditoría ni render visual, por pedido del usuario.

Fuentes: manual.md, tokens.json, components.md y fuentes de login/dashboard/control/WiFi/MPU+IR registradas en sources.md; en Qt, Theme.qml, GlassCard, ActionButton y StatusBadge. No se redefinieron las fuentes canónicas.

Confirmado por el pedido: dos referencias independientes, OK para iniciar, progreso real F4, modal de calibraciones pendientes al intentar seguir, balance previamente equilibrado, botón Seguir línea/Detener seguimiento y balance conservado al detener. Observado: superficies, tipografía, cian de acción/foco, tokens de estado y componentes existentes.

Propuesta: disposición de estados y acciones, preparación/progreso en tarjeta, detalle plegable de valores Web y modal de calibración dentro de FOLLOW. Se conserva el acceso desde calibración IR. Los registros locales anteriores tienen título separado y no habilitan seguimiento.

| Cobertura | Web | Qt | Límite |
| --- | --- | --- | --- |
| Estado sin conexión / sin sesión | Mensaje y acciones deshabilitadas | Estado y acciones según sesión | Sin render |
| Blanco y pista pendientes/listos | Tarjeta y modal al intentar iniciar | Tarjeta y modal al intentar iniciar | Confirmación proviene de F4 |
| Preparación / captura / éxito / error | OK, fases, muestras, cancelación propia | OK, progreso, cancelación propia | Sin dispositivo |
| Balance / seguimiento | Acciones separadas, estado confirmado | Acciones separadas, estado confirmado | Sin prueba física |
| Tema claro/oscuro y tamaño | Tokens CSS y distribución adaptable | Theme y ScrollView | Sin revisión visual |

Reglas aplicadas: superficies legibles; cian para acción/foco; estado de enlace/dispositivo junto a operación; español directo; identidad y componentes compartidos. Pendiente: revisión visual y física cuando se solicite. No se afirma paridad exacta de las nuevas pantallas OLED: los clientes incorporan controles nativos del nuevo contrato.

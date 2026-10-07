# Control Web: consistencia visual y navegación — 2026-10-07

APLICAR sobre el manual AutoMicro0.3.0 autorizado en index.md. Skills: visual-identity-system, apple-design y emil-design-eng. No se encontró una skill instalada con nombre exacto visual consistency; su objetivo se aplica desde Visual Identity. Se conserva la paleta e identidad aprobadas.

## Fuentes y alcance

Confirmado por este pedido: reformar toda la interfaz Web de Control, corregir el cierre de sesión y adoptar el selector de OLED/Protocol Studio. Observado en ProtocolHero.tsx, OledStudioWorkspace.tsx y studio.css: superficie field, borde ring, acento de selección, altura2.75rem, estados discretos. Supporting: index.css, tokens.json, manual.md, components.md y decisiones del manual.

Objetivos directos: ControlSection, MotorCalibrationSection, GotoPanel, MotorCalibration, MotionReadiness y selector de modo. Dependencias: MotionBalancePanel, acciones/estado de motores, Modal, React Router. El Control canónico inicial cambió desde sources.md: esta tarea adopta la versión actual de los Studios solo para su selector, sin redestilar marca ni convertir páginas ajenas en autoridad.

## Before / After

| Before | After | Why |
| --- | --- | --- |
| Calibración ejecutaba window.location.assign y recreaba la aplicación/sesión en memoria | Navegación con React Router entre Libre/GOTO/Calibración | Evita recarga y conserva proveedores/sesión del cliente |
| Selector de botones independientes | Segmentado compartido, patrón Studio, foco y flechas/Home/End | Familiaridad y navegación consistente |
| Estado SIM y diagnóstico del editor junto al control físico | Estado real y acciones generales arriba; simulación plegada en herramientas | Distingue tarea actual y reduce búsqueda |
| Coordenadas, requisitos y métricas apilados | Preparación arriba; destino y estado lado a lado, móvil en una columna | Agrupación y comodidad |
| Configuración, medición y perfiles mezclados | Configurar/preparar/resultado; rampa y tiempo avanzados; perfil e historial debajo | Camino principal claro |
| Modal de Balance sin acciones para activarlo | Acciones dentro del modal; también en resolución de objetos | Permite completar el requisito sin salir |
| Parámetros perdidos al salir a otra calibración | Borrador por sesión de coordenadas y configuración; regreso al modo previo | Mantiene el contexto de trabajo |
| Mensaje de guardado con color de error | Éxito verde semántico, error rojo semántico | Feedback consistente |

## Decisiones y cobertura

Propuesta aplicada D-18: ancho cómodo88rem, superficies sólidas de tarea, espacio escalable, títulos/etiquetas sobrios, acción principal clara, métricas tabulares, scroll local de tablas. SegmentedControl es la primitiva compartida por Control, calibración y modo F4; reproduce el patrón observado en ambos Studios sin modificar sus páginas.

Cobertura en fuente: Libre/GOTO/calibración, modales dependientes, mobile/desktop mediante media queries, claro/oscuro por tokens, foco visible, teclado, deshabilitado, vacío, error y éxito. Colores solo --ui-*; reducción de movimiento/transparencia y mayor contraste. Selección por teclado sin transición; feedback de puntero discreto sin springs ni animaciones ornamentales.

Borradores guardan coordenadas, intensidad, rampa, timeout, notas y progreso de la serie; no contienen PIN/token. No se modifica UserContext ni se inventa autenticación persistente. Inicio/cancelación/guardado mantienen comandos y guardas F4 existentes.

## Cinco reglas y pendientes

1. Paleta y marca comunes; selector familiar.
2. Estado del dispositivo junto a acciones.
3. Preparación, configuración y resultado en grupos claros.
4. Acción principal distinguible y detalles avanzados plegados.
5. Foco/teclado/targets táctiles; feedback semántico sin decoración repetitiva.

No se ejecutaron tests, builds, escáneres, navegación renderizada ni validaciones por instrucción vigente. Cobertura en ejecución: No verificada; aceptación estética: Pendiente. La corrección del logout elimina la recarga identificada en fuente; no se afirma ensayo real de sesión/dispositivo. El bundle ESP anterior permanece sin regenerar. Próximo paso cuando se solicite: compilar Web/copiar gzip y observar sesión/móvil/desktop. Sin cambios F4/ESP/Qt.

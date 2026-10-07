---
product: "AutoMicro"
manualVersion: "0.3.0"
status: "draft"
updatedAt: "2026-09-30"
---

# Identidad visual de AutoMicro

**Estado: identidad base aprobada; manual en revisión visual.** Destilado de login, dashboard, control, WiFi y panel MPU + IR. El usuario confirmó nombre, logo, terminología y paleta fija el 2026-09-30.

## Resumen distintivo

Una consola técnica para un vehículo experimental. El lenguaje principal combina azul casi negro, cian luminoso, grillas discretas, gráficos del vehículo en trazo digital, datos legibles y controles que muestran el estado del enlace. La interfaz prioriza operar y diagnosticar sobre la decoración. Los modos claro y oscuro emplean variantes fijas de la misma gama.

## Fuente de verdad

- [Fuentes, cobertura y límites](sources.md)
- [Manual operativo](manual.md)
- [Tokens](tokens.json)
- [Componentes y recetas](components.md)
- [Decisiones trazables](decisions.md)
- [Adopción futura](adoption.md)
- [Configuración de auditoría](audit.config.json)
- [Auditoría y aplicación sobre el resto de la app](audit-2026-09-29.md)
- [Auditoría de movimiento y modales](motion-audit-2026-09-29.md)

## Cinco reglas que protegen la identidad

1. **D-01:** colocar contenido y estado sobre superficies legibles; la grilla y el brillo son fondo.
2. **D-02:** reservar cian para identidad, foco, información y acciones relevantes; usar colores de estado con significado estable.
3. **D-03:** mostrar el estado del enlace y del dispositivo cerca de cada operación dependiente de hardware.
4. **D-04:** usar títulos contundentes, etiquetas breves y datos alineados; escribir instrucciones en español directo.
5. **D-05/D-14:** usar el nuevo vehículo azul como logo de AutoMicro en todas las cabeceras; las demás ilustraciones representan secciones y capacidades.

## Decisiones pendientes

- Aprobar reglas propuestas para componentes y estados que estas cinco vistas no muestran.
- Revisar visualmente las cinco rutas en escritorio y móvil con una sesión y, para las vistas protegidas, con el dispositivo o un entorno representativo.

## Inconsistencias de mayor impacto

- Coexisten tokens compartidos con numerosos colores literales y reglas locales, sobre todo para cian y estados.

## Estado de aplicación

El usuario autorizó aplicar el borrador a todas las rutas y adoptar principios de respuesta, movimiento y disposición inspirados en Apple Design y Emil Design Engineering. La revisión del código está resumida en [adoption.md](adoption.md). Nombre, logo, terminología y gama de color están **confirmados**; las demás decisiones nuevas siguen como propuestas aplicadas hasta observar la interfaz en escritorio y móvil. No se ejecutaron tests ni validaciones por instrucción del usuario.

2026-10-02: [Protocol Studio y OLED Studio: refinamiento aplicado y cobertura](studio-refinement-2026-10-02.md), D-15. Compilación completada; revisión visual pendiente.

- [Seguimiento y calibración: aplicación, cobertura y límites](line-follow-2026-10-06.md).

2026-10-07: [Control: navegación sin recarga y consistencia con los Studios](control-navigation-2026-10-07.md), D-18. Fuente implementada; ejecución visual y nuevo bundle pendientes.

2026-10-07: [Modales de motores: estructura, preparación y movimiento](motor-dialogs-2026-10-07.md), D-19. Fuente implementada; compilación y revisión visual pendientes.

2026-10-07: [Revisión de modales, botones y referencias de blanco/pista](motor-dialogs-spacing-2026-10-07.md), D-20. Implementación en fuentes; compilación y revisión visual pendientes.

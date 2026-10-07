# Aplicación visual de Control y calibración — 2026-10-07
Manual autorizado v0.3.0. Interacciones confirmadas por solicitud; disposición aplicada sobre componentes y tokens observados.

- Pill Libre/GOTO y acceso a calibración; modal para resolver modo sin interacción con el fondo.
- Tarjeta completa de requisito incumplido: botón, pointer, foco visible y cruz en burbuja circular. Cumplido: check e información, sin acción.
- Tokens Web: --ui-rose y --ui-success-text. Qt: Theme.danger y Theme.success; superficies y radios existentes.
- Misma representación en GOTO, calibración y Seguidor. Valores desconocidos no muestran check de cumplimiento.
- Curva SVG/Canvas expresa velocidad media e historial, sin efectos ornamentales añadidos.

Cobertura: ConditionStatus, MotionReadiness, ControlSection, MotorCalibration, LineFollowPanel; equivalentes QML ConditionCard, MotionRequirements, AutoControlPanel, MotorCalibration y CarModeDialog. Sin revisión visual, tests, builds ni validaciones. Aceptación estética pendiente.

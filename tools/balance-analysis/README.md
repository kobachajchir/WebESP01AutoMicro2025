# Análisis de balance

Motor compartido: `src/features/balanceCalibration/optimizer.ts`. Algoritmo experimental ARX de orden 2 y búsqueda acotada; el informe nunca acredita estabilidad física. No controla motores ni aplica ganancias.

## Servicio HTTP local

Node 22.18 o posterior con soporte nativo para quitar tipos TS:

```powershell
node tools/balance-analysis/server.mjs
```

Escucha en `127.0.0.1:9877`. En la pestaña Balance, abrir **Análisis con servicio externo** y usar `http://127.0.0.1:9877/v1/balance/analyze`. El envío es explícito. El token permanece solo en memoria del navegador.

Variables: `PORT`, `BALANCE_HOST`, `BALANCE_ALLOWED_ORIGIN` (por defecto `http://localhost:5173`) y `BALANCE_API_TOKEN`. Configurar el origen exacto de la web real. Escuchar fuera de localhost requiere token. Para uso remoto, colocar HTTPS, autenticación, límites y control de concurrencia frente al worker; el servicio incluido procesa de forma síncrona y no implementa cola cloud ni recuperación de trabajos.

POST JSON contiene la sesión completa. Devuelve el informe `arx2-grid-v1`, incluso cuando faltan datos. El cliente espera hasta 30 segundos y permite cancelar la espera. Cancelar HTTP no garantiza interrumpir el cálculo en servidor.

## MCP local

```powershell
node tools/balance-analysis/mcp.mjs
```

Configurar ese comando stdio en el cliente MCP deseado, con directorio de trabajo en este repositorio. Expone `analyze_balance_session` con argumento `session`. No se instala automáticamente en Codex ni se inició el servidor en esta tarea. No tiene herramientas de aplicación de PID.

## Sesiones

La captura Web consulta `getTelemetrySnapshot` con una espera de 200 ms entre respuestas y sin superponer requests. Guarda tiempos de llegada, no tiempos físicos; estas sesiones sirven para gráficas y diagnóstico, y el optimizador las rechaza para recomendar ganancias.

Las sesiones `f4-control-cycle` importadas requieren secuencias consecutivas, tiempo monotónico en ms, filtro D, anti-windup, límites y signo. Ver el contrato AMI-20261001-01 en AutoMicroContracts. Actualmente F4/ESP no producen ese formato desde el workspace. No cambiar la etiqueta de una sesión Web para forzar el análisis.

Rechazos: menos de 200 ciclos/2 s, configuración ausente, firmware desconocido, pérdidas, cambios de ganancias/objetivo, período no uniforme, giro/saturación y modelo insuficiente. Separación cronológica 70/30 para ajuste/error de predicción de un paso; no constituye validación física ni una estimación no sesgada garantizada en lazo cerrado.

Objetivo fijo: error angular cuadrático + 0.01 × cambio angular por segundo cuadrático + 0.05 × salida normalizada cuadrática + 2 por ciclo saturado. Escenarios ±1°, variación ±10% de respuesta del actuador y horizonte 5 s; rechazo sobre 10° o residuo final sobre 0.2°. Son límites de simulación, no protecciones firmware. Variación candidata ±20% (I también puede desactivarse); mejora mínima 2%. Una ganancia inicial cero no se explora hacia un valor distinto de cero. La tabla de sensibilidad varía cada ganancia candidata ±10%.

No se ejecutaron tests, compilaciones ni validaciones por instrucción del usuario. Pendientes de implementación en sus repositorios: adquisición sincronizada, ensayo temporal con watchdog y reversión en F4, bridge y capacidades ESP, adaptación Qt si corresponde. Pendientes cloud: infraestructura, cola, autenticación y persistencia remota.

# Motores y balance — 2026-10-03

Implementación local en fuente; sin tests, compilación, validadores, flasheo ni ejecución física.

Contrato AMI-20261003-01: GET_MOTION_STATE 0x7B, SET_BALANCE_ENABLED 0x7C, SET_MOTION 0x7D, STOP_MOTION 0x7E y SET_MOTOR_TEST 0x7F. Respuesta de estado de ocho bytes por el mismo ID. Comandos JSON stm.motion.get, stm.balance.setEnabled, stm.motion.set, stm.motion.stop y stm.motor.test; autenticación STM requerida.

Desarmar mantiene adquisición MPU y apaga motores. Marcha cambia el objetivo de inclinación hasta ±6°; giro usa el margen restante del balance. Detener marcha o vencer su duración vuelve a 0° y conserva la compensación. Parar motores y balance desarma. TEST directo requiere modo TEST y desarmado, con vencimiento local. Duración remota 50–2000 ms; interfaces con pulsos de 750 ms.

Armado: MPU calibrado, muestra de ≤50 ms y pitch dentro de ±10°. Caída >35°, error o MPU vencido enclavan parada; reactivación explícita requerida. No se detecta automáticamente contacto con el piso. 0x64 conserva 92 bytes y devuelve status 3 si orientación no disponible; salidas representan esfuerzo aplicado por el driver, incluido TEST, no RPM físicas.

Web: Control de Motores y Calibración → Balance. Qt: Telemetría y 3D → Balance y motores. La ejecución autónoma de secuencias completas del Studio sigue pendiente.

Los cambios de este checkout no se publican por publicar la central. Pendientes: compilación, instalación de firmware/aplicaciones y ajuste físico de vertical, sentidos, PID y PWM. No se acredita que el vehículo ya mantenga estabilidad física.

[Contrato y flujo](../../../AutoMicroContracts/changes/2026-10-03-01-motor-balance-control.md). [Auditoría](../../../AutoMicroContracts/audits/2026-10-03-mpu-motors-balance.md).

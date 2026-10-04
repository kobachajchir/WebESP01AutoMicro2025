# Implementación coordinada A–F

Desde la raíz del repo: `../../AutoMicroContracts/docs/PROTOCOL_A_F.md`. Manual de transiciones: SCREEN_BEHAVIOR.md de Contracts. Registro AMI-20261002-01 a -04.

A/B: reboot76 y ACK originalCmd. C/D: SameCommand74 y rechazo UI status. E: GET79 vacío→3 bool; SET7A 3 bool→status+3 bool; evento98 3 bool. F: 17 códigos Web, identity-only donde faltan datos y skill central.

Completado en fuente. Sin tests, compilaciones, validaciones ni flasheo por instrucción expresa. Instalar F4 antes de ESP. Pendientes en IMPLEMENTATION.md central.

## Actualización posterior: compilación autorizada

2026-10-02: F4 con empaquetado, ESP01, Web y Qt MSVC compilaron correctamente. Resultados y advertencias en Contracts/docs/BUILD_RESULTS_20261002.md. MinGW necesita Qt6WebSockets. No se ejecutaron tests ni se flasheó hardware.

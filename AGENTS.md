# AGENTS.md

## AutoMicro API Integrity

La central de mensajes del contrato compartido está en `../../AutoMicroContracts/CHANGELOG.md` (ruta relativa a la raíz de este repositorio). La única skill está en `../../AutoMicroContracts/.agents/skills/automicro-api-integrity/SKILL.md`. Abarca FirmwareF4, Firmware ESP01, Web ESP01 y AutoMicroQtDesktop.

- Cuando una tarea consulte o modifique comandos, eventos, screen codes, API WebSocket/UNER/USB, rutas, payloads, formatos, permisos, estados, respuestas o el flujo de un comando, leer la skill y el registro maestro antes de trabajar. Consultar las fichas enlazadas que afecten a este repositorio.
- Si cambia el contrato, crear en la central una ficha fechada y breve según la skill y agregarla al registro maestro en el mismo turno. Hacer commit y publicar ese registro en el remoto privado. Documentar comportamiento anterior y nuevo, identificadores, formato, respuesta o evento, consumidores afectados y pendientes. Una consulta sin cambios no crea ficha.
- El pedido del usuario autoriza escribir y publicar en `AutoMicroContracts` solo para mantener este registro y sus fichas. No autoriza modificar código de otro repositorio por implicación ni afirmar que está sincronizado sin evidencia.
- Si la central o su remoto no están disponibles, informar que el registro quedó pendiente de publicación. No presentar el cambio como comunicado.
- No ejecutar tests, compilaciones ni validaciones salvo pedido expreso del usuario.

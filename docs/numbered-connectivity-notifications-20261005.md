# Página Web cargada y avisos — AMI-20261005-05

WebSocketContext confirma esp.web.page.ready tras hello API v1, carga del
documento y un frame de render, solo si ESP anuncia features.pageReady.
Se permite antes del PIN y no cambia la autenticación. Timeout de 3 s.
pagehide cierra el socket; pageshow persistido vuelve a conectar al recuperar
una página de la caché de navegación. Un fallo durante la carga sin confirmar
la página no debe producir Web conectada ni un falso Web desconectada.

En F4 y visor, Web N conectada/desconectada corresponde a la página; Cliente
N conectado/desconectado corresponde a la red del auto. El visor consume
data.clientNumber de screen.changed/getCurrentScreen. N Web es un slot 1/2;
N Wi-Fi es el AID de la asociación, con numeración independiente. Un número
ausente deja el texto sin número. Códigos de pantalla existentes conservados.

El catálogo de eventos distingue transporte 0x86/0x87 de presencia Web
0x89/0x8A y asociación AP 0x84/0x85. No cambia el límite de dos WebSockets.
Fuentes locales, sin tests/build/validaciones. Los bundles de ESP y Qt se
mantienen como estaban hasta regenerarlos; no se copian artefactos antiguos.

# Protocol Studio y OLED Studio — refinamiento visual

Fecha: 2026-10-02. Modo APLICAR, según manual 0.3.0 y autorización de borrador ya registrada en index.md/adoption.md. Revisión Web base 7aac41c con cambios locales: no representa un HEAD limpio. La solicitud actual autoriza reformar ambas herramientas y aplicar visual-identity-system, Apple Design y Emil Design Engineering.

## Fuentes y alcance

Fuentes canónicas: las cinco vistas previamente declaradas en sources.md y su manual aprobado para aplicación provisional. Soporte operativo inspeccionado: tokens.json, components.md, decisions.md, manual.md y src/index.css. Se reutilizan los tokens de tema existentes; no se adopta Protocol/OLED como nueva fuente canónica.

Objetivos directos: src/pages/ProtocolSection.tsx, src/features/protocolStudio/components, src/features/protocolStudio/ui.tsx, src/features/oledEditor/OledStudioWorkspace.tsx, LopakaLikeEditor.tsx y OledCanvasTransferPanel.tsx. Hoja compartida: src/features/studio.css, importada solo por la ruta Studio.

Confirmada: alcance solicitado, identidad azul/cian y temas fijos de AutoMicro. Observada: tokens de superficie, texto, foco, estado, radio y movimiento. Propuesta aplicada: diagrama, offsets, distribución de paneles, controles segmentados compactos y salidas de código. Aprobación estética de estas propuestas: pendiente. Verificación visual: No verificada.

## Cambios

| Before | After | Why |
| --- | --- | --- |
| Cadena en min-w-max, bloques saturados, sombras por campo y tooltips sobre un área con scroll | Campos con borde de acento, etiquetas, offsets y detalles desplegables nativos; payload y checksum cierran el diagrama | Leer paquetes largos sin forzar un ancho fijo ni depender de hover |
| Byte chips con paletas y tamaños independientes | Roles y tamaños comunes para el diagrama y los bytes del traductor | Mantener jerarquía y correspondencia; no usar color como única información |
| Copias agrupadas lejos del código, cadenas sin contenedor de texto específico | Cada formato tiene Copiar junto a su código, con wrap y scroll propio cuando es necesario | Identificar qué salida se copia y contener arrays largos |
| Selector Studio superpuesto y navegación interior grande con dos tarjetas | Selector en el flujo normal y navegación segmentada compacta | Reducir altura decorativa y choques con títulos en móvil |
| OLED exige 640 px de alto mínimo y scroll interno dentro de la página | Altura por contenido; el scroll local se reserva al lienzo con zoom, capas y bloques de código | Evitar una zona rígida y desplazamientos anidados innecesarios |
| Tres columnas OLED de 280 + flexible + 340 px desde xl | Una columna en pequeño, dos áreas más capas en escritorio intermedio, tres columnas desde 1600 px | Dar espacio útil al lienzo y los campos del inspector |
| Botones de ocultar/bloquear dentro del botón de selección de capa | Selección y acciones hermanas | Evitar controles interactivos anidados y preservar foco separado |
| Pestañas con roving tabIndex sin flechas | Flechas izquierda/derecha, Home y End cambian y enfocan pestañas | Hacer alcanzables las pestañas inactivas mediante teclado |
| Títulos y ayudas mezclan inglés, mayúsculas y frases de implementación | Constructor, Traductor, Pantalla, Capas, Lienzo, Deshacer/Rehacer y Enviar al OLED | Voz en español y explicaciones orientadas a la operación |
| Progreso con transition-all y elevación de tarjetas | Progreso directo; movimiento breve de estado y reducción de movimiento | La actualización frecuente no añade espera ni movimiento decorativo |

## Cobertura

| Área | Cobertura en fuente | Ejecución |
| --- | --- | --- |
| Constructor, diagrama, payload manual, salidas y copia | Cubierta | No verificada visualmente |
| Traductor: bytes, detalle, estados, foco y mapa | Cubierta en primitivas; contenido de capturas depende de entrada | No verificada visualmente |
| OLED: galería, editor, capas, herramientas, inspector y código | Cubierta | No verificada visualmente |
| Envío OLED: cabecera, requisitos y progreso | Cubierta; lógica y permisos preservados | Sin placa ni prueba física |
| Claro/oscuro, móvil/escritorio, movimiento reducido | Reglas basadas en tokens y media queries | Viewports/contraste/teclado no verificados en navegador |

Cinco reglas: superficies legibles; color con significado y etiquetas explícitas; datos en monoespaciado y cifras tabulares; componentes que envuelven contenido largo; feedback inmediato y movimiento reducido. No se cambia marca, paleta global, IDs, payloads, routing ni estados de transferencia.

## Compilación y límites

Por el pedido previo expreso de compilar: npm run build completado (TypeScript y Vite). Postbuild copió solo index.html.gz a ESP/data/dist: 1.761.269 bytes. Conservó modelos/Draco y no flasheó. Advertencia no bloqueante de Browserslist desactualizado. No se ejecutaron tests, escáner de deriva ni una sesión de validación visual.

Siguiente revisión pendiente: abrir /protocol y /protocol?studio=oled, revisar tema claro/oscuro y ancho móvil/escritorio; recorrer campos con teclado, paquetes de 0/255 bytes, nombres largos, galería vacía/con pantallas, código y estados de transferencia con el dispositivo disponible. No se afirma que estos escenarios se hayan ejecutado.

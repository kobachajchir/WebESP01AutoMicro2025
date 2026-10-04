# Fuentes, alcance y vigencia

- Fecha inicial: 2026-09-29. Confirmación de marca: 2026-09-30.
- Revisión Git leída: `7c57ccd`.
- Alcance inicial de escritura: `docs/design-system/`; la aplicación posterior cambió interfaz y manual.
- Producto confirmado por el usuario: **AutoMicro**, sin año en el título visible.
- Activo aprobado: `src/assets/LogoDashboardV2.png`, con canal alfa (rango 0–254), convertido a `LogoDashboardV2.webp` y a favicon WebP derivado. El logo de aplicación pasó de 1.811.735 a 227.250 bytes; el favicon ocupa 9.574 bytes. El nuevo WebP ocupa `home-brand-glyph` en las cabeceras.
- Terminología y color aprobados: **WiFi**, **Password** y variantes fijas de la gama existente para claro y oscuro.
- Autoridad: las cinco secciones solicitadas tienen igual prioridad. Los estilos y componentes compartidos sustentan esas secciones; no son una fuente independiente para agregar otras páginas.

| Entrada directa | Ruta resuelta | Papel visual |
| --- | --- | --- |
| `src/pages/Login.tsx` | `/login` | Acceso mediante `PinScreen` |
| `src/pages/Home.tsx` | `/home` | Dashboard y navegación principal |
| `src/pages/ControlSection.tsx` | `/control` | Simulación, secuencias y estado de motores |
| `src/pages/WifiSection.tsx` | `/wifi` | Conectividad STA/AP y aprovisionamiento |
| `src/pages/EstadoSection.tsx` | `/statics` | Panel MPU + IR, escena 3D y consola de sensores |

## Dependencias visuales relevantes

| Papel | Archivos | Incorporados por |
| --- | --- | --- |
| `dependency` | `src/components/PinScreen.tsx`, `PageHeader.tsx`, `RootLayout.tsx`, `SectionStatusStrip.tsx`, `MotorBlock.tsx`, `TimelineRow.tsx`, `TransportActionButton.tsx`, `MpuIrScene3D.tsx`, `OrientationControls.tsx`, `WifiCredentialsModal.tsx` | Las entradas directas o su layout |
| `dependency` | `src/assets/LogoDashboardV2.webp`, `LogoControlV2.webp`, `LogoWifiAPV2.webp`, `LogoMPUIRV2.webp`, `LogoSeguidorV2.webp` | Logo de marca, dashboard y panel de información |
| `supporting` | `src/App.tsx`, `src/main.tsx`, `src/index.css`, `src/utils/theme.ts`, `index.html` | Router, bootstrap, estilos globales, tema y nombre HTML |

El resolvedor incluido en la skill se ejecutó con las cinco entradas y estilos/tema como `--include`. Su grafo también atravesó `App.tsx` hacia rutas ajenas; esas rutas se excluyeron de la evidencia canónica. Se detuvo la lectura en dominio, protocolo, persistencia y datos sin efecto visual. La familia de ilustraciones se inspeccionó directamente. No se identificó una fuente externa oficial de marca.

## Cobertura observada

- **Código:** las cinco rutas y sus componentes principales; modo oscuro y claro definidos; estados codificados como inactivo, ocupado, error y desconectado en las superficies pertinentes.
- **Imagen:** las ilustraciones `LogoDashboard`, `LogoControl`, `LogoWifiAP` y `LogoMPUIR` se inspeccionaron como archivos.
- **Ejecución visual:** no verificada. Se inició Vite para intentar observar la app, pero el control del navegador falló por un error de permisos del entorno. Un intento de captura con Chrome no produjo una vista utilizable. No se observaron las rutas protegidas ni se simuló una sesión.
- **Responsive:** reglas CSS leídas para ancho menor a 820 px y otros puntos de quiebre; no verificado en un viewport renderizado.
- **Interacciones:** estados y transiciones leídos del código; no verificados visualmente ni con hardware.

## Exclusiones y límites

Quedan fuera las páginas de seguidor, documentación, editor OLED, protocolo, la interfaz del STM32 y los recursos de otras aplicaciones. La tarjeta del seguidor y su imagen aparecen en el dashboard, pero no autorizan a convertir la vista interna de seguidor en fuente canónica. Durante la destilación inicial no se hicieron pruebas ni se ejecutó el escáner de deriva; el escáner se usó después en la [auditoría de rutas](audit-2026-09-29.md). La situación visual descrita puede diferir de una sesión real con datos, permisos y dispositivo conectados.

En una revisión posterior de activos de marca apareció `src/assets/AutoLogo.svg`. El usuario eligió explícitamente `LogoDashboardV2.png` como logo. La versión WebP derivada ocupa la cabecera compartida y el favicon anterior de Vite fue reemplazado por una derivación del mismo logo. Los cuatro PNG V2 de módulos se convirtieron a WebP de hasta 1024 px conservando alfa; el conjunto pasó de 4.876.487 a 852.260 bytes (aproximadamente 83 % menos). Los PNG originales quedan como fuente y la app importa los WebP.


2026-10-02: aplicación D-15 sobre Protocol Studio y OLED Studio, objetivos de reforma, no nuevas fuentes canónicas. Se inspeccionaron el manual vigente y tokens de index.css; checkout Web 7aac41c modificado. No se redestiló la marca. No se capturó una sesión renderizada. [Registro](studio-refinement-2026-10-02.md).

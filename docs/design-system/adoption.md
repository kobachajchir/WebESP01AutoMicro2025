# Mapa de adopción

**Estado al 2026-09-30:** el usuario autorizó aplicar el borrador a toda la web y confirmó **AutoMicro**, el nuevo logo, **WiFi/Password** y las variantes fijas de color para modos claro y oscuro. Las reglas de interacción inspiradas en Apple Design y Emil Design Engineering siguen como propuestas aplicadas. La aplicación del código no equivale a verificación visual o de rendimiento.

## Aplicado en esta revisión

1. Cabecera, botones, switch, foco y tarjetas comparten respuesta táctil y reflujo móvil.
2. Rutas con transición corta, interrumpible y sin blur; importaciones diferidas con carga compacta.
3. Modales comunes y modal de PIN con movimiento simétrico, bloqueo de scroll de ruta/documento y contenido desplazable. El modal común gestiona el foco.
4. Marcos con material translúcido y menos filtros en superficies anidadas; soporte para menos transparencia y más contraste.
5. Dashboard sin recorte a una sola altura de ventana y con tarjetas horizontales en móvil; cabeceras flexibles y escena MPU con alto adaptable.
6. Documentación sin entradas escalonadas ni revelado con blur; pulso decorativo de enlace y carga ambiental desactivados.
7. Control mantiene estables los bloques y la línea de tiempo al hover; el grupo Guardar/Duplicar/Eliminar se redistribuye en móvil sin comprimir la acción destructiva.
8. `BrandMark` coloca el nuevo WebP en `home-brand-glyph` de todas las cabeceras; login, carga, ficha del proyecto y 404 comparten el logo. Título HTML, favicon y textos de WiFi se alinean con la marca.
9. `theme.ts` aplica únicamente los dos pares de color aprobados; el CSS claro parte de esos mismos valores y aumenta contraste de texto tenue, campo y foco.
10. Las cuatro `home-module-card` usan los diseños V2 transparentes en WebP. Las imágenes se muestran completas sobre fondos azul profundo en oscuro y azul pálido en claro; títulos, estados y pie conservan contraste en cada modo.

## Trabajo de marca pendiente

- Definir, si se necesita para soportes pequeños, un isotipo simplificado del vehículo. El favicon actual deriva del logo aprobado.
- Revisar los literales de color que aún existen en módulos especializados antes de declararlos tokens de marca.

## Verificación pendiente

Por instrucción del usuario no se ejecutaron tests ni validaciones. Queda por comprobar visualmente cada ruta en escritorio y móvil, el contraste final de ambas gamas en componentes reales, gestos/foco/scroll en dispositivos reales y métricas de carga y fotogramas. Las decisiones nuevas D-11 a D-13 siguen como propuestas aplicadas en un manual borrador.

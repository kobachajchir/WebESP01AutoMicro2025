# Modelo V2: emisores inferiores, piso y luces blancas

Fecha: 2026-10-06. Implementado en fuente Web; sin tests, compilación, revisión visual, flasheo ni prueba física por instrucción del usuario.

## Medidas del CAD

Fuente: `Exports a Blender/V2/Blender_V2_20261005_013012/AutoMicro_V2_ORIGINAL.blend`. Se cargaron únicamente los cuerpos necesarios, sin vincularlos a la escena visible ni sobrescribir el archivo Blender. Cada malla se separó por componentes conexas para medir las tres lentes o lámparas que contiene.

Las posiciones son el polo exterior de la lente, desde donde se origina el dibujo. TCRT emisor: `V2_RAW_0366_00`, correspondiente al mismo cuerpo de lente azul usado en los emisores delanteros `V2_RAW_0393_00`. Receptor: `V2_RAW_0367_00`. Lámparas blancas: `V2_RAW_0354_00`. Ruedas: aros de goma `0387/0388/0390/0391`, llantas `0389/0392`.

La conversión de Blender milímetros a glTF metros es `[X, Z, -Y] / 1000`. Las coordenadas son locales al GLB, antes de centrarlo, escalarlo o aplicarle la pose MPU. Todos los anclajes reciben las mismas transformaciones del modelo.

| Pieza | X (mm) | Y arriba (mm) | Z (mm) | Altura sobre el piso (mm) |
| --- | ---: | ---: | ---: | ---: |
| Emisor TCRT izquierdo | 120.588669 | -46.215000 | 90.131706 | 7.233910 |
| Emisor TCRT central | 140.592773 | -46.215000 | 90.131706 | 7.233910 |
| Emisor TCRT derecho | 160.598999 | -46.215000 | 90.131706 | 7.233910 |
| Receptor TCRT izquierdo | 120.588669 | -46.215000 | 87.053833 | 7.233910 |
| Receptor TCRT central | 140.592773 | -46.215000 | 87.053833 | 7.233910 |
| Receptor TCRT derecho | 160.598999 | -46.215000 | 87.053833 | 7.233910 |
| LED blanco izquierdo | 120.593674 | -48.695000 | 79.567772 | 4.753910 |
| LED blanco central | 140.592773 | -48.695000 | 79.572769 | 4.753910 |
| LED blanco derecho | 160.593994 | -48.695000 | 79.567772 | 4.753910 |

[Datos con precisión original, centros de ruedas y dirección de los haces](model-v2-underbody-measurements.json).

## Contacto de ruedas y suelo

Piso CAD: glTF Y = **-53.448910 mm**. Centro vertical de ambas ruedas: **-19.999408 mm**. Altura del eje: **33.449502 mm**, diámetro exterior vertical de goma: aproximadamente **66.899003 mm**.

El centro del volumen completo está a **44.140201 mm** sobre ese piso; esta altura, multiplicada por la escala, es el desplazamiento necesario para un modelo centrado. No se debe trasladar ese centro usando el radio de rueda.

En `/statics` el suelo está en Y = 0. En Control y Seguidor se conservan sus planos existentes, Y = -0.025 y -0.012 unidades de escena, respectivamente. El desplazamiento usa `(centroRealDelGLB.y - pisoCAD) * escala + alturaDelPlano`. El apoyo corresponde a una pose nivelada; la visualización MPU conserva su rotación alrededor del centro y no implementa una simulación de contacto dinámico de neumáticos.

## Ángulos y dibujo

Los receptores inferiores están hacia -Z. El eje de cada emisor TCRT es `[0, -cos(13.5°), -sin(13.5°)]`, aproximadamente `[0, -0.972370, -0.233445]`: inclinado **13.5° hacia el receptor**. La apertura es **±16°** a media intensidad, según el [calculador oficial de Vishay](https://www.vishay.com/docs/80393/windowsizecalcultator_tcrt5000_tcrt5000l.pdf). El receptor tiene ±30° de campo a media sensibilidad, inclinado en sentido opuesto; se guarda su centro para futuras representaciones, pero esta entrega dibuja los emisores pedidos.

El límite de representación IR se conserva en **5 cm**. Los conos se recortan contra el piso y su mancha se obtiene intersectando los rayos del borde con el plano del suelo después de aplicar la pose del auto. Se eliminaron las placas de piso que antes reutilizaban posiciones de sensores delanteros. Las manchas tienen un desvanecimiento orientativo; el dibujo no es una simulación fotométrica ni demuestra distancia de detección.

Los tres LED blancos apuntan `[0, -1, 0]`. Por pedido del usuario del 2026-10-06, la iluminación usa **30° desde el eje central del LED**, es decir **±30° y 60° de apertura total**. Es un ángulo fijo de representación para componentes genéricos sin número de parte identificado. El CAD LED D5.0mm Clear no acredita su apertura óptica. No se dibuja un cono blanco ni se ofrece ajuste de opacidad o vista previa.

## Interruptores y estado confirmado

Los emisores IR de objetos y línea se controlan desde «Control real». **LED blancos** tiene un toggle en Herramientas, con la apertura fija informada debajo. Los estados confirmados de los tres grupos aparecen en la franja de conexión. Se reutiliza `IrEmittersContext` y el contrato existente: GET `stm.irEmitters.get`, SET `stm.irEmitters.set` con `{objects,line,lights}` y evento `stm.irEmitters.changed`. El toggle cambia únicamente `lights` y conserva los otros dos estados. No se agregan IDs ni campos de firmware.

Solo se permite operar conectado, con sesión STM autenticada, fuera del modo mock y con un estado conocido. El toggle espera la respuesta y se bloquea mientras hay una operación pendiente. La iluminación blanca aparece únicamente con disponibilidad y `lights=true` confirmado; el apagado o la pérdida de disponibilidad retiran todos los efectos blancos. No hay preview que simule un LED encendido. Con `line=false` se ocultan los emisores inferiores; sin estado disponible se mantiene una guía IR con la opacidad elegida, sin afirmar emisión real. Las casillas «Haz objetos» y «Haz líneas» controlan la visibilidad local sin enviar comandos. Sus sliders ajustan la opacidad del dibujo IR, independiente del ADC y la sensibilidad.

«Vistas» es un bloque colapsable sobre la escena: seis vistas principales y ocho isométricas, con iconos SVG derivados de sus direcciones y filas que ocupan todo el ancho con gaps. Las inferiores permiten observar las lentes hacia el piso. Un cambio manual de OrbitControls (rotación, desplazamiento o zoom) deselecciona el preset y muestra Vista libre; elegir un preset o restablecer cámara conserva la selección programática. «Restablecer cámara» permanece en Herramientas, junto con cuadrícula, origen y MPU Render; se elimina Congelar pose. Limpiar sensores y Calibrar sensores están junto a Sensibilidad IR, con calibración como última acción. Los bloques colapsables inferiores muestran Estado del sistema y Posición estimada en la primera fila, y Seguimiento de línea debajo. Todos los desplegables de la sección empiezan cerrados. Contraer un bloque no detiene streams ni modifica lecturas; Limpiar sensores conserva su alcance local en UI.

F4 aplica `lights` a `Luces_IR_GPIO_Port/Luces_IR_Pin` mediante `APP_SetIrLightsEnabled` y `APP_ApplyIrState`. Se conserva esa implementación. La confirmación es el estado lógico reportado por firmware; no certifica cableado, brillo físico ni que otro modo de firmware no imponga una salida diferente.

Registro compartido: **AMI-20261005-03**. FirmwareF4, ESP y Qt conservan sus formatos actuales; solo se editó código de Web y el registro central.

## Haces IR e iluminación blanca binaria

**Haces** permanece colapsable y cerrado al entrar. Contiene únicamente dos sliders de 0 a 100 %: **Haz objetos** y **Haz líneas**, ambos inicialmente en **2 %**, con casilla **Mostrar** compartida con Herramientas. Contraer el bloque conserva sus ajustes. Son preferencias visuales locales; no modifican el protocolo ni la calibración física.

El LED blanco tiene dos estados: encendido o apagado mediante su toggle. Cuando está encendido, cada emisor conserva brillo en su origen CAD, iluminación hacia abajo, mancha en el suelo y halo de reflexión con ganancia visual fija. Se elimina la malla del cono blanco. El SpotLight usa un semiángulo de 30° y el corte directo sobre el piso se calcula con ese mismo ángulo. Una luz de rebote representa la reflexión sobre la parte inferior del modelo. Los anclajes y efectos siguen la escala y pose del auto.

La mancha directa es pequeña por los 4,753910 mm de altura de los LED. Se conserva un radio mínimo visual de halo de 25 mm y un alcance de rebote de 75 mm, escalados con el modelo. Son efectos de representación, no medidas de potencia ni una simulación fotométrica del componente.

El GLB usa `KHR_materials_transmission` en V2_Clear. El brillo y las manchas mantienen mezcla aditiva en el pase capturado para la transmisión, sin escritura de profundidad y con prueba de profundidad. La textura conserva el desvanecimiento RGB. El modelo GLB y sus materiales se mantienen.

Se retiran el slider blanco, la casilla Mostrar blanca, su estado local de opacidad/visibilidad, el hook y las etiquetas de vista previa. El estado `lights` confirmado es la única condición de encendido de la representación blanca, junto con la disponibilidad del equipo.

## Detección por sensor de objetos

Cada uno de los cinco sensores puede mostrar una burbuja sobre su eje óptico, con un disco tenue y un anillo perpendicular que cortan su propio cono. Su centro local es `[0,0,-distanciaCm/100]` respecto del emisor CAD, antes de aplicar el yaw, la escala del GLB y la pose del auto. El radio de la sección es `distanciaM * tan(16°)`; la burbuja usa una fracción de ese radio con límites visuales pequeños. La distancia parte del frente del emisor, sin el desplazamiento artificial del 22 % que tenía el marcador anterior.

La burbuja y la sección tienen opacidad propia, visible aunque el cono esté al 2 %; no modifican la opacidad configurada del haz. Cambian de posición con cada lectura y desaparecen sin detección válida, al limpiar las lecturas, al detener el stream real, perder disponibilidad o esconder Haz objetos. El estado confirmado `objects=false` también oculta el grupo. La simulación IR alimenta la misma representación con sus lecturas simuladas. Los haces inferiores conservan su composición anterior.

La lectura IR publicada es ADC, no centímetros. El dibujo aplica el umbral compartido `ΔADC >= 130` respecto de la línea base y su polaridad. Con al menos dos puntos de calibración por sensor, invierte sus segmentos de manera lineal sin extrapolar fuera de la curva: solo dibuja la burbuja si hay una distancia única dentro de la sensibilidad actual. Mesetas o múltiples cruces se indican como **Ambigua**; valores no cubiertos, como **Fuera curva**; distancias mayores que la sensibilidad, como **Fuera rango**. Esos casos no reciben una ubicación arbitraria.

Sin curva suficiente se invierte el modelo visual existente de ganancia axial, `d = R * (1 - fuerza^(1/1.6))`, con fuerza normalizada, blanco centrado y reflectividad unitaria asumida. Esto es una aproximación del modelo, no una medición física. La telemetría sobre la escena añade **≈d cm** a cada sensor y declara **cm estimados**; sus valores ADC se conservan. Las superficies y condiciones reales de calibración afectan la interpretación. No se agregan campos de distancia al wire ni se modifica la calibración almacenada.

## Gráfica en tiempo real

Se reemplaza el panel abierto «Lecturas MPU en tiempo real» por **Gráfica en tiempo real**, usando el mismo desplegable compartido y cerrado al entrar. Requiere WebSocket conectado, modo real y sesión STM autenticada para poder abrirse. Sin esa disponibilidad, el botón queda deshabilitado y aparece **No conectada** debajo. Al perder disponibilidad se cierra y se limpia su historial local; reconectar no lo abre automáticamente.

La gráfica consume la orientación Euler real de muestras MPU válidas, sin usar la pose manual, el offset del modelo ni la simulación. Solo agrega un punto cuando existe una muestra nueva; no repite la última orientación como una nueva medición. Abrir o cerrar el panel no envía comandos ni modifica suscripciones. El stream sigue controlado desde Flujo MPU en Control real. Antes de la primera muestra de la conexión no se muestran ceros como lecturas; con el stream detenido se indica cómo activarlo.

## Entrega y límites

Los haces se crean en tiempo de ejecución: el GLB final no cambia y conserva los 883.260 bytes de la entrega anterior. El `.gz` y el firmware no se regeneraron. Cuando se autorice una compilación ESP, el proceso ya configurado de copia incluirá la interfaz compilada y el GLB vigente. No se ejecutaron tests, compilaciones, validaciones de interfaz ni pruebas de hardware.

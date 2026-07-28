# Calibración y localización de objetos con cinco sensores IR

## Objetivo

Obtener desde el auto una tabla repetible `distancia -> ADC` para cada uno de
los cinco sensores de objeto. La Web usa esa tabla para simular lecturas y para
estimar una posición probable. La misma tabla se exporta como C para que el
STM32 use exactamente los mismos puntos.

La primera implementación prioriza funcionamiento y trazabilidad. No agrega un
comando UNER nuevo: captura muestras del evento IR existente `0x91`. Cada prueba
se identifica por `sensor + distancia`; así un blanco alineado con un cono no
contamina las curvas de los otros cuatro.

## Orden espacial obligatorio

El modelo y la tabla C usan este orden:

| Índice | Canal Web | Posición | Dirección |
| ---: | --- | ---: | ---: |
| 0 | `objectLeft45` | -8 cm | -45 grados |
| 1 | `objectLeftCenter` | -3,5 cm | 0 grados |
| 2 | `objectCenter` | 0 cm | 0 grados |
| 3 | `objectRightCenter` | +3,5 cm | 0 grados |
| 4 | `objectRight45` | +8 cm | +45 grados |

Este orden no coincide con posiciones contiguas dentro de `raw[8]`. El payload
UNER conserva el orden físico del ADC documentado en `ir-session-protocol.md`.
La adaptación debe hacerse por ID de sensor, nunca copiando cinco índices
consecutivos.

## Distancias fijas

Se miden estos puntos, en centímetros:

```text
0,2  0,25  0,3  0,5  0,75  1  1,5  2  3  4  6,4  10  15
```

Los siete primeros puntos cubren `2..15 mm`, incluida la zona de máxima
transferencia cercana a 2,5 mm indicada por el fabricante. Los restantes
comprueban el alcance extendido que se está representando en el proyecto.

También se captura un baseline sin objeto dentro del campo de visión. El
baseline toma los cinco canales a la vez porque no requiere alinear un blanco.

Para cada punto se selecciona primero el sensor. La distancia se mide desde el
centro óptico de ese sensor hasta la cara del blanco, siguiendo su propio eje
(incluidos los laterales de 45 grados). El blanco debe quedar centrado y
perpendicular a ese eje. Se mantienen constantes material, tamaño, luces IR,
alimentación y luz ambiente.

La secuencia mínima para comprobar que todo el circuito funciona es:

1. un baseline sin objeto;
2. dos distancias por cada sensor (`10` puntos en total);
3. exportar, volver a importar y verificar una presencia en el simulador.

La caracterización recomendada completa usa las 13 distancias por cada uno de
los cinco sensores: `65` puntos más el baseline. La Web muestra el avance sobre
ese total, pero permite aplicar una curva parcial desde dos puntos por sensor.

## Cantidad de datos por punto

Por cada distancia:

1. Descartar 8 muestras para asentamiento.
2. Conservar 32 muestras del snapshot normalizado.
3. Calcular por sensor mediana, media, mínimo, máximo, percentiles 10/90 y
   desvío estándar.
4. Usar la mediana como valor principal de la LUT.

Cada captura consume `40` snapshots: 8 descartados y 32 útiles. Por lo tanto,
requiere aproximadamente `40 x período_IR`: 800 ms a 50 Hz (20 ms) o 2 s a
20 Hz (50 ms). El tiempo dominante es el reposicionamiento manual del blanco.

No se guardan las 32 muestras crudas en el perfil final. Se guardan los
estadísticos, suficientes para interpolar y detectar una medición inestable.

## Flujo implementado en la Web

1. Conectar la Web al auto por WiFi/WebSocket.
2. Activar el stream IR (`SET_IR_STREAM 0x6B`); las muestras llegan en
   `EVT_APP_GET_IR_READINGS 0x91`.
3. Abrir `Calibrar sensores` y capturar primero `Sin objeto`.
4. Elegir sensor y una de las distancias fijas.
5. Colocar el blanco, mantenerlo quieto y pulsar `Tomar punto`.
6. Repetir el punto si la dispersión `p10..p90` resulta grande.
7. Exportar JSON para conservar el banco de medición y `.h` para el firmware.

La Web bloquea la captura si no existe conexión real, si el stream IR está
detenido o si el emulador IR está activo. El perfil queda además persistido en
el navegador para poder completar las 65 mediciones en más de una sesión.

## Polaridad

El firmware actual documenta los cinco canales de objeto como pull-down:
`norm == raw` y una reflexión mayor produce un ADC mayor. El perfil admite dos
convenciones para comprobar el auto real sin modificar código:

```text
higher-is-closer  -> ADC mayor significa mayor retorno/cercanía
lower-is-closer   -> ADC menor significa mayor retorno/cercanía
```

La polaridad se selecciona una vez por montaje y queda versionada en el JSON.

## Formato del perfil

El JSON usa `schemaVersion: 2` y contiene:

```text
name
createdAt
source
polarity
material
notes
samplesPerPoint
settleSamples
baseline[5]
points[N].distanceCm
points[N].sensors[sensores_medidos].{median,mean,min,max,p10,p90,stdDev,count}
```

Un punto puede contener uno o varios sensores. Esto permite cerrar el modal y
continuar otro día sin inventar datos para los canales todavía no ensayados. La
Web migra perfiles completos de versión 1, valida versión, distancias,
duplicados, límites ADC y estadísticas. Sólo aplica el perfil si existe
baseline y cada sensor tiene al menos dos distancias.

## Uso en el simulador

El simulador conserva dos capas independientes:

1. Geometría: el objeto sólo aporta señal si está dentro del cono del sensor.
2. Fotometría: dentro del cono, la distancia consulta la LUT y la desviación
   angular atenúa la señal.

Entre puntos se interpola linealmente. Antes del primer punto y después del
último se extrapola con el segmento extremo y se satura a `0..4095`. La UI
marca `extrapola` mientras no estén completas las 65 mediciones, porque esa zona
tiene menos respaldo experimental.

Los conos tienen 30 grados de apertura total y crecen con la sensibilidad. Una
intersección de dos o más conos produce varias lecturas y permite estimar una
posición con mayor confianza. Un solo sensor activo informa sector y cercanía,
pero la posición queda marcada como ambigua.

La reflectividad desconocida se estima como una ganancia común al comparar la
firma de cinco canales. Esto reduce el error de posición cuando cambia el color
del objeto, aunque no elimina la necesidad de calibrar distintos materiales.

### Marco móvil del auto

El modelo del auto, los cinco conos, las bandas IR, los sensores de piso, los
ejes locales y el marcador estimado forman un único `VehicleSensorRig`. El rig
recibe la misma pose `YXZ` tanto desde el MPU real como desde el simulador.

El objeto amarillo emulado no pertenece al rig: queda fijo en el mundo. Antes
de cada muestra se aplica la transformación inversa de la pose para expresarlo
en coordenadas locales del auto:

```text
objetivo_local = inversa(pose_auto) * objetivo_mundo
```

La superficie invisible donde se ubica el objeto también permanece en el marco
del mundo. Así, una nueva selección representa una posición del entorno y no
una coordenada que rote accidentalmente con el vehículo.

El cero del MPU se compone como `inversa(q_cero) * q_actual` y recién después
se vuelve a expresar como Euler `YXZ`. Restar yaw, pitch y roll por separado
produciría una orientación incorrecta cuando hay más de un eje inclinado.

Por eso girar el auto sin mover el objetivo modifica los cinco ADC. La captura
se recalcula periódicamente aunque el puntero esté quieto. El cono utiliza
desplazamiento lateral, vertical y frontal; pitch y roll pueden sacar un objeto
del volumen aunque continúe alineado en la proyección superior.

La altura no se estima como una coordenada independiente: cinco sensores
coplanares no alcanzan para resolver una posición 3D única. La componente
vertical se usa para decidir pertenencia al cono y la posición informada sigue
siendo lateral/frontal respecto del auto.

## Implementación C propuesta

### Fase 1: consumir tabla exportada

Crear:

```text
Core/Inc/tcrt5000_object_model.h
Core/Src/tcrt5000_object_model.c
```

Tipos mínimos:

```c
#define TCRT5000_OBJECT_SENSOR_COUNT 5u

typedef struct {
    uint16_t distance_mm;
    uint16_t adc;
} TCRT5000_ObjectCalibrationPoint_t;

typedef struct {
    const TCRT5000_ObjectCalibrationPoint_t *points;
    uint8_t point_count;
} TCRT5000_ObjectCalibrationCurve_t;

typedef struct {
    TCRT5000_ObjectCalibrationCurve_t curves[TCRT5000_OBJECT_SENSOR_COUNT];
    uint16_t baseline_adc[TCRT5000_OBJECT_SENSOR_COUNT];
    uint8_t lower_adc_means_closer;
} TCRT5000_ObjectCalibration_t;

typedef struct {
    float x_mm;
    float forward_mm;
    float bearing_deg;
    float confidence;
    float uncertainty_mm;
    uint8_t active_mask;
    uint8_t support_count;
    uint8_t ambiguous;
    uint8_t detected;
} TCRT5000_ObjectEstimate_t;
```

API mínima:

```c
uint16_t TCRT5000_ObjectInterpolateAdc(
    const TCRT5000_ObjectCalibration_t *cal,
    uint8_t sensor_index,
    uint16_t distance_mm);

bool TCRT5000_ObjectEstimate(
    const TCRT5000_ObjectCalibration_t *cal,
    const uint16_t adc[TCRT5000_OBJECT_SENSOR_COUNT],
    TCRT5000_ObjectEstimate_t *out);
```

### Fase 2: estimación de posición

Usar búsqueda gruesa cada 5 mm y refinamiento local cada 1 mm:

1. Recorrer candidatos dentro de la unión de los cinco conos.
2. Predecir cinco retornos mediante LUT e incidencia angular.
3. Estimar una ganancia común de reflectividad.
4. Calcular error cuadrático entre firma medida y prevista.
5. Elegir el menor error y comparar contra la segunda solución.
6. Marcar ambiguo si hay menos de dos conos activos o dos mínimos similares.

No se requiere memoria dinámica. Una caracterización completa de 13 puntos
independientes por sensor usa:

```text
5 sensores x 13 puntos x (distancia + ADC) x 2 bytes = 260 bytes
baseline = 10 bytes
```

El header exportado por la Web ya incluye `stdint.h`, include guard, polaridad,
baseline y una curva por sensor. La búsqueda usa arrays de cinco elementos y
puede ejecutarse a 20-50 Hz.

### Fase 3 opcional: captura autónoma en firmware

Sólo si la captura Web por stream resulta insuficiente, agregar un comando
versionado para pedir al STM32 que descarte y resuma muestras. No modificar el
payload de 56 bytes del evento `0x91`.

Request sugerido:

```text
sensor_index:u8
distance_mm:u16
settle_samples:u8
sample_count:u8
```

Response sugerido:

```text
status:u8
sensor_index:u8
distance_mm:u16
median_adc:u16
p10_adc:u16
p90_adc:u16
```

## Pruebas compartidas Web/C

Mantener vectores dorados con:

- objeto fuera de cobertura;
- eje de cada sensor;
- borde de 15 grados;
- intersección de dos y tres conos;
- simetría izquierda/derecha;
- polaridad alta y baja;
- interpolación entre dos distancias;
- extrapolación antes y después del tramo medido;
- saturación 0/4095;
- baseline obligatorio antes de aplicar una curva;
- combinación de capturas parciales por sensor y distancia;
- transformación mundo/auto con yaw, pitch y roll;
- objetivo mundial fijo que sale de cobertura al rotar el auto;
- invariancia de lecturas al rotar juntos auto y objetivo;
- apertura vertical de 15 grados;
- un sensor activo, resultado ambiguo;
- misma firma con reflectividades distintas;
- mapeo correcto entre orden espacial y `raw[8]`.

## Limitación física

El TCRT5000 tiene su máxima transferencia cerca de 2,5 mm y el datasheet
caracteriza un rango reflectivo del orden de milímetros, no 15 cm. La escala de
centímetros del simulador es un contrato del montaje del proyecto hasta que las
mediciones del auto demuestren el alcance real. Fuentes:

- Vishay TCRT5000/TCRT5000L: https://www.vishay.com/docs/83760/tcrt5000.pdf
- Vishay, sensores ópticos reflectivos: https://www.vishay.com/docs/80107/80107.pdf
- Pololu QTRSensors, calibración y centroide: https://pololu.github.io/qtr-sensors-arduino/class_q_t_r_sensors.html

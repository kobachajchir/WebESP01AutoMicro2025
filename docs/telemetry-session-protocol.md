# Sesiones de telemetria MPU6050

## Resumen

La pantalla de sensores y visor ahora controla explicitamente la sesion de
telemetria del MPU6050 usando el protocolo UNER ya existente.

Archivo principal:

- `src/pages/EstadoSection.tsx`

## Comando de inicio y actualizacion

Comando:

```text
TELEMETRY_SET_RATE (0x20)
```

Payload:

```text
[periodMsLow][periodMsHigh]
```

Reglas:

- `periodMs > 0` inicia o actualiza el stream
- `periodMs = 0` actua como finalizador y detiene la transmision
- la UI usa como periodo el intervalo configurado en sensores

Ejemplo:

```text
periodMs = 500
Payload = F4 01
```

## ACK esperado del firmware

Comando:

```text
TELEMETRY_ACK (0x21)
```

Payload:

```text
[code][periodMsLow][periodMsHigh]
```

Interpretacion:

- `code = 0` y `periodMs > 0`: telemetria activa
- `code = 0` y `periodMs = 0`: telemetria detenida
- `code != 0`: error de firmware

## Datos de telemetria

Comando:

```text
TELEMETRY_DATA (0x22)
```

Payload:

```text
[schema][seqL][seqH][accX][accY][accZ][gyroX][gyroY][gyroZ][tempRaw]
```

Total esperado:

```text
17 bytes = 1 + 2 + (6 * 2) + 2
```

La UI hoy usa estos paquetes para:

- contar paquetes recibidos
- mostrar el ultimo `seq`
- estimar temperatura a partir de `tempRaw`

## Modos de captura

### Temporizada

- la web envia `TELEMETRY_SET_RATE(periodMs)`
- inicia un timer local entre `1s` y `240s`
- al vencer el tiempo, la web envia automaticamente el finalizador:

```text
TELEMETRY_SET_RATE(0)
```

### Constante

- la web envia `TELEMETRY_SET_RATE(periodMs)`
- el stream queda activo indefinidamente
- al presionar `Detener`, la web envia:

```text
TELEMETRY_SET_RATE(0)
```

## Flujo de prueba recomendado

### Ejemplo 1: telemetria por 2 segundos

1. Configurar el intervalo de sensores, por ejemplo `200 ms`.
2. Dejar `Modo de captura = Temporizada`.
3. Ingresar `2` en el campo de duracion.
4. Presionar `Iniciar`.
5. La web debe emitir:

```text
TELEMETRY_SET_RATE(200)
Payload = C8 00
```

6. El firmware responde `TELEMETRY_ACK(200)`.
7. Durante esos 2 segundos transmite `TELEMETRY_DATA`.
8. Al terminar la ventana, la web emite el finalizador:

```text
TELEMETRY_SET_RATE(0)
Payload = 00 00
```

9. El firmware responde `TELEMETRY_ACK(0)`.

### Ejemplo 2: telemetria constante

1. Configurar el intervalo de sensores, por ejemplo `500 ms`.
2. Activar `Modo de captura = Constante`.
3. Presionar `Iniciar`.
4. La web debe emitir:

```text
TELEMETRY_SET_RATE(500)
Payload = F4 01
```

5. El firmware responde `TELEMETRY_ACK(500)`.
6. La transmision sigue hasta que el usuario presione `Detener`.
7. En ese momento la web emite el mismo finalizador:

```text
TELEMETRY_SET_RATE(0)
Payload = 00 00
```

8. El firmware responde `TELEMETRY_ACK(0)`.

## Limites de UI

- duracion minima: `1s`
- duracion maxima: `240s`
- modo constante: no usa contador de tiempo

## Nota importante

El finalizador siempre es el mismo para ambos casos:

```text
CMD = 0x20
PAYLOAD = 00 00
```

Eso garantiza que, tanto si la sesion termina por tiempo como si se corta
manualmente, el firmware recibe una orden explicita de detener la transmision.

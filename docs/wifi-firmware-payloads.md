# Payloads Wi-Fi esperados por firmware

## Resumen

La app web debe construir los comandos Wi-Fi con el mismo orden de bytes que parsea el firmware.

Archivos alineados con este contrato:

- `src/types/UnerProtocolCMDTypes.ts`
- `src/pages/WifiSection.tsx`

## AP

Comando: `UNER_CMD_WIFI_SET_AP (0x14)`

Payload:

```text
[ssidLen][ssid bytes][passLen][pass bytes][ip0][ip1][ip2][ip3]
```

Reglas:

- `ssidLen <= 32`
- `passLen == 0` para AP abierto, o `passLen >= 8`
- Si IP = `0.0.0.0`, el firmware deja la IP default

Ejemplo:

```text
SSID = "MiAP"
PASS = "12345678"
IP   = 192.168.4.1

Payload:
04 4D 69 41 50 08 31 32 33 34 35 36 37 38 C0 A8 04 01
```

## STA

Comando: `UNER_CMD_WIFI_SET_STA (0x15)`

Payload:

```text
[ssidLen][ssid bytes][passLen][pass bytes][fixedIp][ip0][ip1][ip2][ip3]
```

Reglas:

- `ssidLen` entre `1` y `32`
- `passLen >= 8`
- `fixedIp = 0` para DHCP
- `fixedIp = 1` para IP fija
- Aun con DHCP se envian siempre los 4 bytes de IP, normalmente `0.0.0.0`

Ejemplo con IP fija:

```text
SSID = "CasaWiFi"
PASS = "clave123"
fixedIp = 1
IP = 192.168.1.50

Payload:
08 43 61 73 61 57 69 46 69 08 63 6C 61 76 65 31 32 33 01 C0 A8 01 32
```

Ejemplo con DHCP:

```text
SSID = "CasaWiFi"
PASS = "clave123"
fixedIp = 0
IP = 0.0.0.0

Payload:
08 43 61 73 61 57 69 46 69 08 63 6C 61 76 65 31 32 33 00 00 00 00 00
```

## Nota importante

Estos bytes representan solo el payload. El frame UNER completo agrega:

```text
HEADER + LENGTH + TOKEN ':' + CMD + PAYLOAD + CHECKSUM
```

`WifiSection.tsx` ya no arma estos bytes manualmente: usa `PayloadBuilder` y envia el comando por `UNERProtocol`, que agrega el framing completo.

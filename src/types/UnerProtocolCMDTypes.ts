// src/proto/uner_cmds.ts
export const CMD = {
  // Heartbeat
  HEARTBEAT_SET: 0xa0, // payload: u16 period_ms
  HEARTBEAT_ACK: 0xa1, // payload: u16 period_ms (eco opcional)

  // Wi-Fi
  WIFI_GET_MODE: 0x10, // no payload
  WIFI_MODE: 0x11, // payload: u8 (0=AP, 1=STATION)
  WIFI_GET_SCAN: 0x12, // no payload
  WIFI_SCAN_LIST: 0x13, // payload: [u8 N] + N*( u8 ssidLen, ssid[ssidLen], i8 rssi, u8 sec )
  WIFI_SET_AP: 0x14, // payload: APCreds (ver abajo)
  WIFI_SET_STA: 0x15, // payload: STACreds (ver abajo)
  WIFI_ACK: 0x16, // payload: u8 code (0=OK, !0=err)
} as const;
export type U8 = number;

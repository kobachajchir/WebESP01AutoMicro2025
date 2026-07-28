import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveEspOperatingMode,
  resolveOppositeModeDestination,
} from "../src/utils/wifiModeSwitch.ts";

const baseConfig = {
  apSsid: "AutoMicro-AP",
  apIp: "0.0.0.0",
  stationSsid: "Taller",
  stationIp: "0.0.0.0",
};

test("reconoce AP-only como modo AP y AP+STA como modo RED", () => {
  assert.equal(
    resolveEspOperatingMode({ apActive: true, staConnected: false }),
    "AP",
  );
  assert.equal(
    resolveEspOperatingMode({ apActive: true, staConnected: true }),
    "RED",
  );
});

test("desde RED prepara el reinicio AP con su IP predeterminada", () => {
  assert.deepEqual(resolveOppositeModeDestination("RED", baseConfig), {
    mode: "AP",
    bootMode: "ap",
    ssid: "AutoMicro-AP",
    ip: "192.168.4.1",
    ipSource: "default",
    url: "http://192.168.4.1/",
  });
});

test("desde RED respeta la IP AP fija guardada", () => {
  const destination = resolveOppositeModeDestination("RED", {
    ...baseConfig,
    apIp: "10.10.0.1",
  });
  assert.equal(destination.ip, "10.10.0.1");
  assert.equal(destination.ipSource, "fixed");
  assert.equal(destination.url, "http://10.10.0.1/");
});

test("desde AP informa que una RED con DHCP no tiene IP predecible", () => {
  assert.deepEqual(resolveOppositeModeDestination("AP", baseConfig), {
    mode: "RED",
    bootMode: "normal",
    ssid: "Taller",
    ip: null,
    ipSource: "dhcp",
    url: null,
  });
});

test("desde AP informa la IP fija guardada para RED", () => {
  const destination = resolveOppositeModeDestination("AP", {
    ...baseConfig,
    stationIp: "192.168.1.45",
  });
  assert.equal(destination.ip, "192.168.1.45");
  assert.equal(destination.ipSource, "fixed");
  assert.equal(destination.url, "http://192.168.1.45/");
});

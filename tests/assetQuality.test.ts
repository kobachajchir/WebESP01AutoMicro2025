import assert from "node:assert/strict";
import test from "node:test";
import {
  checkInternetAccess,
  resolvePreferredModelUrl,
} from "../src/utils/assetQuality.ts";

test("no intenta una sonda externa cuando el navegador informa red desconectada", async () => {
  let calls = 0;
  const online = await checkInternetAccess({
    networkOnline: false,
    probeUrl: "https://probe.invalid",
    fetcher: async () => {
      calls += 1;
      return {} as Response;
    },
  });

  assert.equal(online, false);
  assert.equal(calls, 0);
});

test("distingue una red local sin salida a Internet", async () => {
  const online = await checkInternetAccess({
    networkOnline: true,
    probeUrl: "https://probe.invalid",
    fetcher: async () => {
      throw new TypeError("network unreachable");
    },
  });

  assert.equal(online, false);
});

test("usa el modelo HD únicamente con preferencia, fuente e Internet", () => {
  const baseOptions = {
    localUrl: "/models/auto_micro.glb",
    hdUrl: "https://cdn.example/auto_micro_hd.glb",
    hdAssetsEnabled: true,
  };

  assert.equal(
    resolvePreferredModelUrl({
      ...baseOptions,
      internetStatus: "online",
    }),
    baseOptions.hdUrl,
  );
  assert.equal(
    resolvePreferredModelUrl({
      ...baseOptions,
      internetStatus: "offline",
    }),
    baseOptions.localUrl,
  );
  assert.equal(
    resolvePreferredModelUrl({
      ...baseOptions,
      hdUrl: null,
      internetStatus: "online",
    }),
    baseOptions.localUrl,
  );
});

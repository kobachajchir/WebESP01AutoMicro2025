import { useEffect, useMemo, useRef, useState } from "react";
import { useWebSocket } from "./useWebSocket";
import { ESP_COMMANDS } from "../protocol/wsApi";
import { normalizeStreamPeriodMs } from "../protocol/f4Payloads";

type SensorName = "mpu" | "ir";
type SubscriptionState = "idle" | "subscribing" | "active" | "error";

type Consumer = { periodMs: number };
type SensorRegistry = {
  consumers: Map<symbol, Consumer>;
  // `undefined` significa que no conocemos el estado real del F4 (por
  // ejemplo, el SET pudo aplicarse aunque su ACK haya vencido). `null`
  // significa que un STOP fue confirmado.
  appliedPeriodMs: number | null | undefined;
  operation: Promise<unknown> | null;
};

type RequestCommand = <T>(
  command: string,
  args?: Record<string, unknown>,
  options?: { timeoutMs?: number },
) => Promise<T>;

const registries: Record<SensorName, SensorRegistry> = {
  mpu: { consumers: new Map(), appliedPeriodMs: undefined, operation: null },
  ir: { consumers: new Map(), appliedPeriodMs: undefined, operation: null },
};

export function useSensorSubscription(sensor: SensorName, enabled: boolean, requestedPeriodMs: number) {
  const { connected, connectionPhase, request } = useWebSocket();
  const consumerId = useMemo(() => Symbol(sensor), [sensor]);
  const [state, setState] = useState<SubscriptionState>("idle");
  const [error, setError] = useState<Error | null>(null);
  const periodMs = normalizeStreamPeriodMs(requestedPeriodMs);
  const periodRef = useRef(periodMs);
  periodRef.current = periodMs;

  useEffect(() => {
    if (!enabled || !connected || connectionPhase !== "ready") {
      if (!connected || connectionPhase !== "ready") {
        registries[sensor].appliedPeriodMs = undefined;
        registries[sensor].operation = null;
      }
      setState("idle");
      return;
    }

    const registry = registries[sensor];
    registry.consumers.set(consumerId, { periodMs: periodRef.current });
    setState("subscribing");
    setError(null);
    void reconcile(sensor, request)
      .then(() => setState("active"))
      .catch((cause) => {
        setState("error");
        setError(cause instanceof Error ? cause : new Error(String(cause)));
      });

    return () => {
      registry.consumers.delete(consumerId);
      void reconcile(sensor, request).catch(() => undefined);
    };
  }, [connected, connectionPhase, consumerId, enabled, request, sensor]);

  useEffect(() => {
    if (!enabled || !connected || connectionPhase !== "ready") return;
    const registry = registries[sensor];
    const consumer = registry.consumers.get(consumerId);
    if (!consumer || consumer.periodMs === periodMs) return;

    registry.consumers.set(consumerId, { periodMs });
    setState("subscribing");
    setError(null);
    void reconcile(sensor, request)
      .then(() => setState("active"))
      .catch((cause) => {
        setState("error");
        setError(cause instanceof Error ? cause : new Error(String(cause)));
      });
  }, [connected, connectionPhase, consumerId, enabled, periodMs, request, sensor]);

  return { state, active: state === "active", error, periodMs };
}

async function reconcile(
  sensor: SensorName,
  request: RequestCommand,
): Promise<void> {
  const registry = registries[sensor];
  if (registry.operation) await registry.operation.catch(() => undefined);
  const periods = [...registry.consumers.values()].map((consumer) => consumer.periodMs);
  const desiredPeriod = periods.length > 0 ? Math.min(...periods) : null;
  if (desiredPeriod === registry.appliedPeriodMs) return;

  const command = desiredPeriod === null
    ? sensor === "mpu" ? ESP_COMMANDS.UNSUBSCRIBE_MPU : ESP_COMMANDS.UNSUBSCRIBE_IR
    : sensor === "mpu" ? ESP_COMMANDS.SUBSCRIBE_MPU : ESP_COMMANDS.SUBSCRIBE_IR;
  const args = desiredPeriod === null ? {} : { periodMs: desiredPeriod };
  const operation = request<Record<string, unknown>>(command, args, { timeoutMs: 7_000 }).then((data) => {
    assertStreamCommandAccepted(sensor, desiredPeriod, data);
    registry.appliedPeriodMs = desiredPeriod;
  });
  registry.operation = operation;
  try {
    await operation;
  } finally {
    if (registry.operation === operation) registry.operation = null;
  }
}

function assertStreamCommandAccepted(
  sensor: SensorName,
  desiredPeriodMs: number | null,
  data: Record<string, unknown>,
): void {
  const status = typeof data.status === "number" ? data.status : 0;
  if (status !== 0) {
    throw new Error(`${sensor.toUpperCase()}: F4 rechazo el stream (status ${status}).`);
  }

  if (desiredPeriodMs !== null && data.active === false) {
    throw new Error(`${sensor.toUpperCase()}: F4 respondio sin activar el stream.`);
  }
}

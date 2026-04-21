import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import WifiCredentialsModal from "../components/WifiCredentialsModal";
import { useWebSocket } from "../hooks/useWebSocket";
import {
  WIFI_CREDENTIALS_CANCEL_COMMAND,
  WIFI_CREDENTIALS_SUBMIT_COMMAND,
  type WifiCredentialsResultStatus,
  type WifiCredentialsStatus,
} from "../types/WifiTypes";

const WIFI_CREDENTIALS_REQUESTED_EVENT = "wifi.credentials.requested";
const WIFI_CREDENTIALS_RESULT_EVENT = "wifi.credentials.result";
const WIFI_CREDENTIALS_SUBMIT_COMMANDS = new Set([
  WIFI_CREDENTIALS_SUBMIT_COMMAND,
  "esp.wifi.credentials.submit",
]);
const WIFI_CREDENTIALS_CANCEL_COMMANDS = new Set([
  WIFI_CREDENTIALS_CANCEL_COMMAND,
  "esp.wifi.credentials.cancel",
]);
const CANCELLED_CLOSE_DELAY_MS = 700;

interface WifiCredentialsState {
  status: WifiCredentialsStatus;
  ssid: string | null;
  error: string | null;
  reason: string | null;
  ip: string | null;
  timeoutMs: number | null;
  requestId: string | null;
}

interface WifiCredentialsProviderProps {
  children: ReactNode;
}

const INITIAL_STATE: WifiCredentialsState = {
  status: "idle",
  ssid: null,
  error: null,
  reason: null,
  ip: null,
  timeoutMs: null,
  requestId: null,
};

export function WifiCredentialsProvider({
  children,
}: WifiCredentialsProviderProps) {
  const { send, subscribe } = useWebSocket();
  const [state, setState] = useState<WifiCredentialsState>(INITIAL_STATE);
  const closeTimerRef = useRef<number | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const dismiss = useCallback(() => {
    clearCloseTimer();
    setState(INITIAL_STATE);
  }, [clearCloseTimer]);

  const scheduleCancelledClose = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setState(INITIAL_STATE);
      closeTimerRef.current = null;
    }, CANCELLED_CLOSE_DELAY_MS);
  }, [clearCloseTimer]);

  const submitCredentials = useCallback(
    (ssid: string, password: string) => {
      const validationError = validateSubmit(state, ssid, password);
      if (validationError) {
        setState((current) => ({
          ...current,
          error: validationError,
        }));
        return false;
      }

      const requestId = createRequestId("wifi-submit");

      setState((current) => ({
        ...current,
        status: "submitting",
        error: null,
        reason: null,
        requestId,
      }));

      send("device.command", {
        requestId,
        target: "esp",
        command: WIFI_CREDENTIALS_SUBMIT_COMMAND,
        params: {
          ssid,
          password,
        },
      });

      return true;
    },
    [send, state],
  );

  const cancelCredentials = useCallback(() => {
    if (!state.ssid) {
      dismiss();
      return false;
    }

    const requestId = createRequestId("wifi-cancel");

    setState((current) => ({
      ...current,
      status: "cancelling",
      error: null,
      requestId,
    }));

    send("device.command", {
      requestId,
      target: "esp",
      command: WIFI_CREDENTIALS_CANCEL_COMMAND,
      params: {
        ssid: state.ssid,
      },
    });

    return true;
  }, [dismiss, send, state.ssid]);

  useEffect(() => {
    const offDeviceEvent = subscribe("device.event", (message: unknown) => {
      const eventName = getDeviceEventName(message);
      const data = getDeviceEventData(message);

      if (eventName === WIFI_CREDENTIALS_REQUESTED_EVENT) {
        const ssid = readString(data.ssid) ?? readString(message, "ssid");

        if (!ssid) {
          console.warn("[wifi-credentials] solicitud sin SSID", message);
          return;
        }

        clearCloseTimer();
        setState({
          status: "requested",
          ssid,
          error: null,
          reason: null,
          ip: null,
          timeoutMs: null,
          requestId: null,
        });
        return;
      }

      if (eventName === WIFI_CREDENTIALS_RESULT_EVENT) {
        const resultStatus = readResultStatus(data.status);
        if (!resultStatus) {
          return;
        }

        const ssid = readString(data.ssid);
        const ip = readString(data.ip);
        const reason = readString(data.reason);

        setState((current) => {
          if (!current.ssid) {
            return current;
          }

          if (ssid && ssid !== current.ssid) {
            console.info("[wifi-credentials] resultado ignorado por SSID", {
              activeSsid: current.ssid,
              resultSsid: ssid,
              status: resultStatus,
            });
            return current;
          }

          return {
            ...current,
            status: resultStatus,
            error: resultStatusToMessage(resultStatus, reason, ip),
            reason: reason ?? null,
            ip: ip ?? null,
            requestId: null,
          };
        });
      }
    });

    const offDeviceResponse = subscribe("device.response", (message: unknown) => {
      const command = getResponseCommand(message);

      if (
        !WIFI_CREDENTIALS_SUBMIT_COMMANDS.has(command ?? "") &&
        !WIFI_CREDENTIALS_CANCEL_COMMANDS.has(command ?? "")
      ) {
        return;
      }

      const ok = getResponseOk(message);
      const data = getResponseData(message);
      const responseSsid = readString(data.ssid);

      setState((current) => {
        if (!current.ssid) {
          return current;
        }

        if (responseSsid && responseSsid !== current.ssid) {
          return current;
        }

        if (WIFI_CREDENTIALS_SUBMIT_COMMANDS.has(command ?? "")) {
          if (ok) {
            return {
              ...current,
              status: "connecting",
              timeoutMs: readNumber(data.timeoutMs) ?? 15000,
              error: null,
              reason: null,
            };
          }

          const code = getResponseErrorCode(message);
          return {
            ...current,
            status: "failed",
            error: responseErrorToMessage(code),
            reason: code,
            requestId: null,
          };
        }

        if (ok) {
          return {
            ...current,
            status: "cancelled",
            error: "Solicitud cancelada.",
            reason: null,
            requestId: null,
          };
        }

        const code = getResponseErrorCode(message);
        return {
          ...current,
          status: "requested",
          error: `No se pudo cancelar: ${responseErrorToMessage(code)}`,
          reason: code,
          requestId: null,
        };
      });
    });

    return () => {
      offDeviceEvent();
      offDeviceResponse();
    };
  }, [clearCloseTimer, subscribe]);

  useEffect(() => {
    if (state.status === "cancelled") {
      scheduleCancelledClose();
    }
  }, [scheduleCancelledClose, state.status]);

  useEffect(() => {
    return () => {
      clearCloseTimer();
    };
  }, [clearCloseTimer]);

  return (
    <>
      {children}
      <WifiCredentialsModal
        isOpen={state.status !== "idle"}
        status={state.status}
        ssid={state.ssid}
        error={state.error}
        ip={state.ip}
        timeoutMs={state.timeoutMs}
        onSubmit={submitCredentials}
        onCancel={cancelCredentials}
        onDismiss={dismiss}
      />
    </>
  );
}

function validateSubmit(
  state: WifiCredentialsState,
  ssid: string,
  password: string,
) {
  if (!state.ssid || state.status === "idle" || state.status === "cancelled") {
    return "No hay una solicitud WiFi pendiente.";
  }

  if (state.status === "submitting" || state.status === "connecting") {
    return "Ya hay una solicitud WiFi en curso.";
  }

  if (!ssid || ssid.trim().length === 0) {
    return "El SSID no puede estar vacio.";
  }

  if (ssid.length > 32) {
    return "El SSID no puede superar 32 caracteres.";
  }

  if (ssid !== state.ssid) {
    return "El SSID enviado no coincide con la solicitud del ESP.";
  }

  if (password.length < 8) {
    return "La clave WiFi debe tener al menos 8 caracteres.";
  }

  if (password.length > 63) {
    return "La clave WiFi no puede superar 63 caracteres.";
  }

  return null;
}

function getDeviceEventName(message: unknown) {
  if (!isRecord(message)) {
    return undefined;
  }

  return readString(message.event) ?? readString(message.payload, "event");
}

function getDeviceEventData(message: unknown): Record<string, unknown> {
  if (!isRecord(message)) {
    return {};
  }

  const payload = toRecord(message.payload);
  const payloadData = toRecord(payload?.data);
  const directData = toRecord(message.data);

  return payloadData ?? directData ?? message;
}

function getResponseCommand(message: unknown) {
  if (!isRecord(message)) {
    return undefined;
  }

  const payload = toRecord(message.payload);
  return (
    readString(message.command) ??
    readString(message.payloadCommand) ??
    readString(payload?.command)
  );
}

function getResponseOk(message: unknown) {
  if (!isRecord(message)) {
    return false;
  }

  const payload = toRecord(message.payload);
  const ok = message.ok ?? payload?.ok ?? message.success ?? payload?.success;

  return ok === true;
}

function getResponseData(message: unknown): Record<string, unknown> {
  if (!isRecord(message)) {
    return {};
  }

  const payload = toRecord(message.payload);
  return toRecord(message.data) ?? toRecord(payload?.data) ?? {};
}

function getResponseErrorCode(message: unknown) {
  if (!isRecord(message)) {
    return "ERR_INTERNAL";
  }

  const data = getResponseData(message);
  const payload = toRecord(message.payload);

  return (
    readString(message.error) ??
    readString(message.code) ??
    readString(message.reason) ??
    readString(payload?.error) ??
    readString(payload?.code) ??
    readString(data.error) ??
    readString(data.code) ??
    "ERR_INTERNAL"
  );
}

function responseErrorToMessage(code = "ERR_INTERNAL") {
  if (code === "ERR_NO_PENDING_REQUEST") {
    return "El ESP no tiene una solicitud WiFi pendiente.";
  }
  if (code === "ERR_BUSY") {
    return "El ESP ya esta procesando otra solicitud WiFi.";
  }
  if (code === "ERR_BAD_PARAMS") {
    return "Los parametros enviados no son validos.";
  }
  if (code === "ERR_SSID_MISMATCH") {
    return "El SSID enviado no coincide con la solicitud pendiente.";
  }
  return "El ESP no pudo procesar las credenciales.";
}

function resultStatusToMessage(
  status: WifiCredentialsResultStatus,
  reason?: string,
  ip?: string,
) {
  if (status === "success") {
    return ip ? `Conexion lista. IP: ${ip}.` : "Conexion WiFi lista.";
  }
  if (status === "failed") {
    return reason === "auth_failed"
      ? "La autenticacion WiFi fallo. Revisa la clave."
      : "No se pudieron guardar o usar las credenciales.";
  }
  if (status === "timeout") {
    return "El ESP no pudo conectar antes del timeout.";
  }
  return "Solicitud cancelada.";
}

function readResultStatus(value: unknown): WifiCredentialsResultStatus | null {
  if (
    value === "success" ||
    value === "failed" ||
    value === "timeout" ||
    value === "cancelled"
  ) {
    return value;
  }

  return null;
}

function createRequestId(prefix: string) {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.trunc(value)
    : undefined;
}

function readString(value: unknown, key?: string): string | undefined {
  const candidate = key && isRecord(value) ? value[key] : value;
  return typeof candidate === "string" && candidate.length > 0
    ? candidate
    : undefined;
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

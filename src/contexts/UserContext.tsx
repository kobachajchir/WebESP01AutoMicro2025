// src/contexts/UserContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import { useUNERProtocol } from "../hooks/useUnerProtocol";
import {
  APP_PIN_ACTION,
  CMD,
  PayloadBuilder,
  SETTINGS_ACK_CODES,
} from "../types/UnerProtocolCMDTypes";
import {
  getRemoteAuthBridgeMode,
  REMOTE_AUTH_BRIDGE_MODE,
  resolveEspRemoteAuthCommand,
} from "../types/RemoteBridgeTypes";
import type { PinAuthResult } from "../types/PinAuthTypes";

export interface User {
  id: string;
  name: string;
}

interface UserContextType {
  user: User | null;
  loading: boolean;
  remotePinAuthenticated: boolean;
  login: (pin: string) => Promise<PinAuthResult>;
  validatePin: (pin: string) => Promise<PinAuthResult>;
  logout: () => void;
  setUser: (user: User | null) => void;
  devMode: boolean;
  setDevMode: (v: boolean) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const USER_SESSION_KEY = "user";

// Keep disabled by default. Enable only with explicit dev intent.
const DEBUG_ALLOW_DEV_LOGIN = true;
export let externalDevMode: boolean = DEBUG_ALLOW_DEV_LOGIN;
export let externalSetDevMode: ((v: boolean) => void) | null = null;
// !!! END WARNING !!!

interface UserProviderProps {
  children: ReactNode;
}

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const { send, subscribe, connected } = useWebSocket();
  const { send: sendUner, subscribe: subscribeUner } = useUNERProtocol();

  const remoteAuthBridgeMode = getRemoteAuthBridgeMode();
  const [user, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [remotePinAuthenticated, setRemotePinAuthenticated] = useState(false);
  const [devMode, setDevMode] = useState<boolean>(DEBUG_ALLOW_DEV_LOGIN);

  const setUser = useCallback((nextUser: User | null) => {
    setCurrentUser(nextUser);
    setRemotePinAuthenticated(Boolean(nextUser));

    if (nextUser) {
      sessionStorage.setItem(USER_SESSION_KEY, JSON.stringify(nextUser));
      return;
    }

    sessionStorage.removeItem(USER_SESSION_KEY);
  }, []);

  useEffect(() => {
    externalDevMode = devMode;
    externalSetDevMode = setDevMode;

    return () => {
      externalSetDevMode = null;
    };
  }, [devMode]);

  useEffect(() => {
    const initializeUser = async () => {
      try {
        localStorage.removeItem(USER_SESSION_KEY);

        const savedUser = sessionStorage.getItem(USER_SESSION_KEY);
        if (savedUser) {
          const userData = JSON.parse(savedUser) as User;
          setUser(userData);
          setLoading(false);
          return;
        }

        if (connected) {
          const unsubscribe = subscribe(
            "sessionVerifyResponse",
            (payload: unknown) => {
              if (isRecord(payload) && payload.success && payload.user) {
                setUser(payload.user as User);
              } else {
                setUser(null);
              }

              setLoading(false);
              unsubscribe();
            },
          );

          send("verifySession");

          setTimeout(() => {
            setLoading(false);
            unsubscribe();
          }, 3000);
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error("Error initializing user:", error);
        setUser(null);
        setLoading(false);
      }
    };

    initializeUser();
  }, [connected, send, setUser, subscribe]);

  const parsePinAckResult = useCallback(
    (payload: number[], expectedAction: number): PinAuthResult | null => {
      if (payload.length !== 2) {
        return null;
      }

      const [action, code] = payload;
      if (action !== expectedAction) {
        return null;
      }

      return pinResultFromCode(code);
    },
    [],
  );

  const runPinAction = useCallback(
    (
      pin: string,
      action: number,
      options?: {
        createSessionOnSuccess?: boolean;
        devBypassCreatesSession?: boolean;
      },
    ) => {
      const createSessionOnSuccess = options?.createSessionOnSuccess ?? false;
      const devBypassCreatesSession =
        options?.devBypassCreatesSession ?? createSessionOnSuccess;
      const jsonCommand =
        remoteAuthBridgeMode === REMOTE_AUTH_BRIDGE_MODE.JSON
          ? resolveEspRemoteAuthCommand(action)
          : null;

      const devLoginEnabled =
        devMode ||
        import.meta.env.VITE_ALLOW_DEV_LOGIN === "true" ||
        sessionStorage.getItem("ALLOW_DEV_LOGIN") === "true";

      if (!/^\d{4}$/.test(pin)) {
        return Promise.resolve({
          ok: false,
          reason: "bad-request" as const,
          message: "El PIN debe tener 4 digitos.",
        });
      }

      if (devLoginEnabled) {
        try {
          console.log("[PIN] Dev bypass", { action, pin });

          sendUner(
            CMD.APP_PIN_CONFIG,
            PayloadBuilder.appPinConfig(action, pin),
          ).catch(() => {
            /* ignore */
          });
        } catch {
          /* ignore */
        }

        if (devBypassCreatesSession) {
          setUser({
            id: `dev-${Date.now()}`,
            name: "Dev User",
          });
        } else if (action === APP_PIN_ACTION.LOGIN) {
          setRemotePinAuthenticated(true);
        }

        return Promise.resolve({ ok: true });
      }

      return new Promise<PinAuthResult>((resolve) => {
        let settled = false;
        let off = () => {};
        let timeoutId: number | undefined;

        const finish = (result: PinAuthResult) => {
          if (settled) return;
          settled = true;
          if (timeoutId !== undefined) {
            window.clearTimeout(timeoutId);
          }
          off();

          if (result.ok && createSessionOnSuccess) {
            setUser({
              id: `pin-${Date.now()}`,
              name: "Usuario PIN",
            });
          }

          resolve(result);
        };

        if (jsonCommand) {
          const requestId = createPinActionRequestId(action);

          off = subscribe("device.response", (payload: unknown) => {
            const result = parseJsonPinAckResult(payload, jsonCommand, requestId);
            if (result === null) {
              return;
            }
            finish(result);
          });

          try {
            send("device.command", {
              requestId,
              target: "esp",
              command: jsonCommand,
              params: { pin },
            });
          } catch {
            finish({
              ok: false,
              reason: "transport-error",
              message: "No se pudo enviar la validacion a la ESP.",
            });
          }
        } else {
          off = subscribeUner(CMD.APP_PIN_CONFIG, (packet) => {
            const result = parsePinAckResult(Array.from(packet.payload), action);
            if (result === null) {
              return;
            }
            finish(result);
          });

          sendUner(
            CMD.APP_PIN_CONFIG,
            PayloadBuilder.appPinConfig(action, pin),
          ).catch(() =>
            finish({
              ok: false,
              reason: "transport-error",
              message: "No se pudo enviar la validacion a la ESP.",
            }),
          );
        }

        timeoutId = window.setTimeout(
          () =>
            finish({
              ok: false,
              reason: "timeout",
              message: "La ESP no respondio la validacion de PIN.",
            }),
          10000,
        );
      });
    },
    [
      devMode,
      parsePinAckResult,
      remoteAuthBridgeMode,
      send,
      sendUner,
      setUser,
      subscribe,
      subscribeUner,
    ],
  );

  const login = useCallback(
    (pin: string) =>
      runPinAction(pin, APP_PIN_ACTION.LOGIN, {
        createSessionOnSuccess: true,
        devBypassCreatesSession: true,
      }),
    [runPinAction],
  );

  const validatePin = useCallback(
    (pin: string) =>
      runPinAction(pin, APP_PIN_ACTION.VALIDATE_SCREEN, {
        createSessionOnSuccess: false,
        devBypassCreatesSession: false,
      }),
    [runPinAction],
  );

  const logout = useCallback(() => {
    console.log("[auth] Logout - limpiando sesion");
    setUser(null);
    localStorage.removeItem(USER_SESSION_KEY);

    if (connected) {
      send("logout");
    }
  }, [connected, send, setUser]);

  return (
    <UserContext.Provider
      value={{
        user,
        loading,
        remotePinAuthenticated,
        login,
        validatePin,
        logout,
        setUser,
        devMode,
        setDevMode,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error("useUser debe usarse dentro de <UserProvider>");
  }
  return ctx;
}

function createPinActionRequestId(action: number): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `pin-${action}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseJsonPinAckResult(
  payload: unknown,
  expectedCommand: string,
  expectedRequestId: string,
): PinAuthResult | null {
  if (!isRecord(payload)) {
    return null;
  }

  const nestedPayload = isRecord(payload.payload) ? payload.payload : null;
  const nestedData = isRecord(payload.data)
    ? payload.data
    : isRecord(nestedPayload?.data)
      ? nestedPayload.data
      : null;

  const requestId =
    readString(payload.requestId) ?? readString(nestedPayload?.requestId);
  const command =
    readString(payload.command) ??
    readString(payload.payloadCommand) ??
    readString(nestedPayload?.command);

  if (requestId && requestId !== expectedRequestId) {
    return null;
  }

  if (command && command !== expectedCommand) {
    return null;
  }

  if (!requestId && !command) {
    return null;
  }

  const code =
    readNumber(payload.code) ??
    readNumber(nestedPayload?.code) ??
    readNumber(nestedData?.code);
  if (code !== undefined) {
    return pinResultFromCode(code);
  }

  const textStatus =
    readString(payload.status) ??
    readString(payload.error) ??
    readString(payload.reason) ??
    readString(payload.code) ??
    readString(nestedPayload?.status) ??
    readString(nestedPayload?.error) ??
    readString(nestedPayload?.reason) ??
    readString(nestedPayload?.code) ??
    readString(nestedData?.status) ??
    readString(nestedData?.error) ??
    readString(nestedData?.reason) ??
    readString(nestedData?.code);

  if (textStatus) {
    return pinResultFromStatus(textStatus);
  }

  const ok =
    readBoolean(payload.ok) ??
    readBoolean(nestedPayload?.ok) ??
    readBoolean(nestedData?.ok);

  if (ok !== undefined) {
    return ok
      ? { ok: true }
      : {
          ok: false,
          reason: "unknown",
          message: "La ESP rechazo el PIN, pero no informo el motivo.",
        };
  }

  return {
    ok: false,
    reason: "unknown",
    message: "La ESP respondio sin estado de PIN reconocible.",
  };
}

function pinResultFromCode(code: number): PinAuthResult {
  if (code === SETTINGS_ACK_CODES.OK) {
    return { ok: true };
  }

  if (code === SETTINGS_ACK_CODES.INVALID_PIN) {
    return {
      ok: false,
      reason: "invalid-pin",
      code,
      message: "El PIN ingresado es incorrecto.",
    };
  }

  if (code === SETTINGS_ACK_CODES.BUSY) {
    return {
      ok: false,
      reason: "busy",
      code,
      message: "La ESP esta ocupada. Proba nuevamente.",
    };
  }

  return {
    ok: false,
    reason: "bad-request",
    code,
    message: `La ESP rechazo la validacion de PIN (codigo ${code}).`,
  };
}

function pinResultFromStatus(status: string): PinAuthResult {
  const normalized = status.trim().toLowerCase().replace(/[\s-]+/g, "_");

  if (normalized === "ok" || normalized === "success" || normalized === "valid") {
    return { ok: true };
  }

  if (
    normalized.includes("invalid_pin") ||
    normalized.includes("pin_incorrect") ||
    normalized.includes("incorrect_pin") ||
    normalized.includes("bad_pin") ||
    normalized.includes("wrong_pin") ||
    normalized.includes("invalid")
  ) {
    return {
      ok: false,
      reason: "invalid-pin",
      message: "El PIN ingresado es incorrecto.",
    };
  }

  if (normalized.includes("timeout")) {
    return {
      ok: false,
      reason: "timeout",
      message: "La ESP no completo la validacion a tiempo.",
    };
  }

  if (normalized.includes("busy")) {
    return {
      ok: false,
      reason: "busy",
      message: "La ESP esta ocupada. Proba nuevamente.",
    };
  }

  return {
    ok: false,
    reason: "unknown",
    message: `La ESP rechazo el PIN (${status}).`,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const trimmed = value.trim();
    const parsed = trimmed.toLowerCase().startsWith("0x")
      ? Number.parseInt(trimmed.slice(2), 16)
      : Number(trimmed);

    return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined;
  }

  return undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value !== 0;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const normalized = value.trim().toLowerCase();

    if (normalized === "true" || normalized === "1" || normalized === "ok") {
      return true;
    }

    if (normalized === "false" || normalized === "0" || normalized === "error") {
      return false;
    }
  }

  return undefined;
}

export default useUser;

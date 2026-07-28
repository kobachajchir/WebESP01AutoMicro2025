/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import { ESP_COMMANDS } from "../protocol/wsApi";
import { EspApiError } from "../protocol/espClient";
import type { PinAuthResult } from "../types/PinAuthTypes";

export interface User {
  id: string;
  name: string;
}

export interface StmAuthState {
  authenticated: boolean;
  authSource: "stm32" | null;
  ttlMs: number;
  attemptsLeft: number | null;
  blocked: boolean;
}

interface UserContextType {
  user: User | null;
  loading: boolean;
  remotePinAuthenticated: boolean;
  stmAuth: StmAuthState;
  login: (pin: string) => Promise<PinAuthResult>;
  validatePin: (pin: string, screenCode?: number) => Promise<PinAuthResult>;
  changePin: (currentPin: string, newPin: string) => Promise<PinAuthResult>;
  logout: () => void;
  sessionNotice: string | null;
  clearSessionNotice: () => void;
  setUser: (user: User | null) => void;
  devMode: boolean;
  setDevMode: (value: boolean) => void;
}

type AuthResponse = {
  granted?: boolean;
  authenticated?: boolean;
  authSource?: string;
  ttlMs?: number;
  ttlRemainingMs?: number;
  attemptsLeft?: number;
  blocked?: boolean;
};

const EMPTY_STM_AUTH: StmAuthState = {
  authenticated: false,
  authSource: null,
  ttlMs: 0,
  attemptsLeft: null,
  blocked: false,
};

const UserContext = createContext<UserContextType | undefined>(undefined);

const DEV_LOGIN_PIN = "9999";
const SESSION_RECONCILE_DELAYS_MS = [750, 1_500, 3_000, 4_500] as const;
const SESSION_RECONNECT_GRACE_MS = 25_000;

export let externalDevMode = false;
export let externalSetDevMode: ((value: boolean) => void) | null = null;

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { connected, connectionPhase, hello, request, subscribe, subscribeEvent } = useWebSocket();
  const [user, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [stmAuth, setStmAuth] = useState<StmAuthState>(EMPTY_STM_AUTH);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [devMode, setDevMode] = useState(false);
  const reconnectGraceTimerRef = useRef<number | null>(null);

  const setUser = useCallback((nextUser: User | null) => setCurrentUser(nextUser), []);

  useEffect(() => {
    externalDevMode = devMode;
    externalSetDevMode = setDevMode;
    return () => { externalSetDevMode = null; };
  }, [devMode]);

  useEffect(() => subscribeEvent("auth.session.expired", ({ data }) => {
    const reason = typeof data === "object" && data !== null && "reason" in data
      ? String((data as Record<string, unknown>).reason)
      : "ttl_expired";
    setCurrentUser(null);
    setStmAuth(EMPTY_STM_AUTH);
    setSessionNotice(
      reason === "stm_reset"
        ? "El STM32 se reinicio; volve a ingresar el PIN."
        : reason === "pin_changed"
          ? "El PIN fue modificado y las sesiones anteriores se cerraron. Ingresa con el PIN nuevo."
        : reason === "stm_auth_rejected"
          ? "El STM32 rechazo o invalido la sesion; volve a ingresar el PIN."
        : reason === "f4_offline"
          ? "Se perdio el enlace con el STM32; volve a ingresar cuando este disponible."
          : "La sesion PIN vencio; volve a ingresar para continuar.",
    );
  }), [subscribeEvent]);

  useEffect(() => subscribe("device.error", (message) => {
    if (!user || !stmAuth.authenticated || typeof message !== "object" || message === null || !("code" in message)) return;
    const code = String((message as Record<string, unknown>).code);
    if (code !== "ERR_AUTH_REQUIRED" && code !== "unauthorized") return;

    setCurrentUser(null);
    setStmAuth(EMPTY_STM_AUTH);
    setSessionNotice(
      "La sesion PIN ya no es valida o el STM32 no esta disponible. Volve a ingresar.",
    );
  }), [stmAuth.authenticated, subscribe, user]);

  const applyAuthResponse = useCallback((data: AuthResponse): PinAuthResult => {
    const authenticated = data.granted === true || data.authenticated === true;
    const next: StmAuthState = {
      authenticated,
      authSource: data.authSource === "stm32" ? "stm32" : null,
      ttlMs: finiteNumber(data.ttlMs) ?? finiteNumber(data.ttlRemainingMs) ?? 0,
      attemptsLeft: finiteNumber(data.attemptsLeft),
      blocked: data.blocked === true || data.attemptsLeft === 0,
    };
    setStmAuth(next);
    if (!authenticated) {
      return {
        ok: false,
        reason: next.blocked ? "busy" : "invalid-pin",
        message: next.blocked
          ? "El STM32 bloqueó temporalmente el acceso después de agotar los intentos."
          : `El STM32 rechazó el PIN${next.attemptsLeft === null ? "" : `; quedan ${next.attemptsLeft} intentos`}.`,
        attemptsLeft: next.attemptsLeft,
        blocked: next.blocked,
        authSource: next.authSource,
        retryAfterMs: next.blocked ? 60000 : undefined,
      };
    }
    if (next.authSource !== "stm32") {
      setStmAuth(EMPTY_STM_AUTH);
      return {
        ok: false,
        reason: "grant-rejected",
        message: "La respuesta recibida no confirma que el STM32 haya autorizado el acceso.",
        authSource: next.authSource,
      };
    }
    return { ok: true };
  }, []);

  const reconcileStmSession = useCallback(async (): Promise<PinAuthResult | null> => {
    for (const delayMs of SESSION_RECONCILE_DELAYS_MS) {
      await wait(delayMs);

      try {
        const data = await request<AuthResponse>(ESP_COMMANDS.SESSION_GET, {}, { timeoutMs: 2_500 });
        const ttlMs = finiteNumber(data.ttlMs) ?? finiteNumber(data.ttlRemainingMs) ?? 0;

        if (data.authenticated === true && data.authSource === "stm32" && ttlMs > 0) {
          return applyAuthResponse(data);
        }
      } catch {
        // La consulta F4 0x5D también tiene un plazo corto en la ESP. Se
        // reintenta para recuperar la sesión sin convertir un timeout en éxito.
      }
    }

    return null;
  }, [applyAuthResponse, request]);

  useEffect(() => {
    if (user?.id !== "stm-session") {
      if (reconnectGraceTimerRef.current !== null) {
        window.clearTimeout(reconnectGraceTimerRef.current);
        reconnectGraceTimerRef.current = null;
      }
      return;
    }

    if (connectionPhase === "ready") {
      if (reconnectGraceTimerRef.current !== null) {
        window.clearTimeout(reconnectGraceTimerRef.current);
        reconnectGraceTimerRef.current = null;
      }
      // El hello pertenece al ESP que acaba de aceptar este WebSocket. Si
      // confirma autenticacion, la sesion ya fue reanudada y no conviene
      // competir por UART con la descarga inicial del GLB/Draco.
      if (hello?.authenticated === true) {
        setSessionNotice(null);
        return;
      }

      // Si el ESP realmente se reinicio, su RAM ya no conserva la sesion. La
      // F4 puede seguir teniendola asociada al nodo, por eso se reconcilia con
      // reintentos espaciados mientras terminan las descargas HTTP grandes.
      let cancelled = false;
      void reconcileStmSession().then((result) => {
        if (cancelled) return;
        if (result?.ok) {
          setSessionNotice(null);
          return;
        }
        setCurrentUser(null);
        setStmAuth(EMPTY_STM_AUTH);
        setSessionNotice("La reconexion no pudo recuperar la sesion PIN. Volve a ingresar.");
      });
      return () => { cancelled = true; };
    }

    if (connectionPhase === "failed" || connectionPhase === "idle") {
      setCurrentUser(null);
      setStmAuth(EMPTY_STM_AUTH);
      setSessionNotice("El WebSocket se cerro y no pudo reconectar. Volve a ingresar el PIN.");
      return;
    }

    setSessionNotice("Reconectando con el ESP; la sesion PIN se conserva durante unos segundos.");
    if (reconnectGraceTimerRef.current === null) {
      reconnectGraceTimerRef.current = window.setTimeout(() => {
        reconnectGraceTimerRef.current = null;
        setCurrentUser(null);
        setStmAuth(EMPTY_STM_AUTH);
        setSessionNotice("La reconexion demoro demasiado. Volve a ingresar el PIN.");
      }, SESSION_RECONNECT_GRACE_MS);
    }
  }, [connectionPhase, hello?.authenticated, reconcileStmSession, user?.id]);

  const runPinCommand = useCallback(async (
    command: string,
    args: Record<string, unknown>,
    options: { reconcileSessionOnTimeout?: boolean } = {},
  ): Promise<PinAuthResult> => {
    if (!connected) return { ok: false, reason: "transport-error", message: "WebSocket API v1 no esta listo." };
    setLoading(true);
    try {
      const data = await request<AuthResponse>(command, args);
      return applyAuthResponse(data);
    } catch (cause) {
      const failure = pinFailure(cause);
      if (options.reconcileSessionOnTimeout && failure.reason === "timeout") {
        const reconciled = await reconcileStmSession();
        if (reconciled?.ok) return reconciled;

        return {
          ...failure,
          message: "El STM32 pudo haber validado el PIN, pero la ESP agotó el tiempo y no logró confirmar la sesión. El acceso sigue cerrado para evitar una autorización falsa.",
        };
      }
      return failure;
    } finally {
      setLoading(false);
    }
  }, [applyAuthResponse, connected, reconcileStmSession, request]);

  const login = useCallback(async (pin: string) => {
    if (!/^\d{4}$/.test(pin)) return { ok: false, reason: "bad-request" as const, message: "El PIN debe tener 4 digitos." };

    if (import.meta.env.DEV && pin === DEV_LOGIN_PIN) {
      setCurrentUser({ id: "dev-session", name: "Usuario DEV" });
      return { ok: true };
    }

    const result = await runPinCommand(
      ESP_COMMANDS.PIN_LOGIN,
      { pin },
      { reconcileSessionOnTimeout: true },
    );
    if (result.ok) {
      // La respuesta 0x51 confirma que el PIN fue correcto. Antes de abrir las
      // rutas protegidas se consulta 0x5D para comprobar que F4 y ESP conservan
      // la misma sesion; asi la UI nunca entra a Home con un grant ya revocado.
      setLoading(true);
      try {
        const confirmed = await reconcileStmSession();
        if (!confirmed?.ok) {
          setStmAuth(EMPTY_STM_AUTH);
          setSessionNotice(
            "El PIN fue correcto, pero la sesion no permanecio activa entre el STM32 y la ESP. Revisa el enlace F4/ESP e intenta otra vez.",
          );
          return {
            ok: false,
            reason: "grant-rejected" as const,
            message: "El PIN fue aceptado, pero no se pudo confirmar una sesion activa con el STM32.",
            authSource: "stm32" as const,
          };
        }

        setSessionNotice(null);
        setCurrentUser({ id: "stm-session", name: "Usuario STM32" });
      } finally {
        setLoading(false);
      }
    }
    return result;
  }, [reconcileStmSession, runPinCommand]);

  const validatePin = useCallback((pin: string, screenCode?: number) => {
    if (!/^\d{4}$/.test(pin) || !Number.isInteger(screenCode)) {
      return Promise.resolve({ ok: false, reason: "bad-request" as const, message: "PIN y screenCode son obligatorios." });
    }
    return runPinCommand(ESP_COMMANDS.PIN_VALIDATE_SCREEN, { pin, screenCode });
  }, [runPinCommand]);

  const changePin = useCallback((currentPin: string, newPin: string) => {
    if (!/^\d{4}$/.test(currentPin) || !/^\d{4}$/.test(newPin)) {
      return Promise.resolve({ ok: false, reason: "bad-request" as const, message: "Ambos PIN deben tener 4 digitos." });
    }
    return runPinCommand(ESP_COMMANDS.PIN_CHANGE, { currentPin, newPin });
  }, [runPinCommand]);

  const logout = useCallback(() => {
    setCurrentUser(null);
    setStmAuth(EMPTY_STM_AUTH);
    setSessionNotice(null);
    if (connected) void request(ESP_COMMANDS.SESSION_LOGOUT).catch(() => undefined);
  }, [connected, request]);

  const clearSessionNotice = useCallback(() => setSessionNotice(null), []);

  return (
    <UserContext.Provider value={{
      user, loading, remotePinAuthenticated: stmAuth.authenticated, stmAuth,
      login, validatePin, changePin, logout, sessionNotice, clearSessionNotice,
      setUser, devMode, setDevMode,
    }}>
      {children}
    </UserContext.Provider>
  );
};

export function useUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error("useUser debe usarse dentro de <UserProvider>");
  return context;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, delayMs));
}

function pinFailure(cause: unknown): PinAuthResult {
  if (cause instanceof EspApiError) {
    const reason = cause.code === "timeout" ? "timeout" : cause.code === "busy" ? "busy" : cause.code === "invalid_request" ? "bad-request" : "transport-error";
    return { ok: false, reason, message: cause.message };
  }
  return { ok: false, reason: "transport-error", message: cause instanceof Error ? cause.message : "Fallo de autenticacion." };
}

export default useUser;

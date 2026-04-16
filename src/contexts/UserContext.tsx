// src/contexts/UserContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
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

export interface User {
  id: string;
  name: string;
}

interface UserContextType {
  user: User | null;
  loading: boolean;
  /** Login real: valida PIN y crea sesión */
  login: (pin: string) => Promise<boolean>;
  /** Validación puntual: valida PIN pero NO crea sesión */
  validatePin: (pin: string) => Promise<boolean>;
  logout: () => void;
  setUser: (user: User | null) => void;
  devMode: boolean;
  setDevMode: (v: boolean) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const USER_SESSION_KEY = "user";

// !!! WARNING: DEBUG FLAG — REMOVE BEFORE PRODUCTION DEPLOY !!!
const DEBUG_ALLOW_DEV_LOGIN = true;
export let externalDevMode: boolean = DEBUG_ALLOW_DEV_LOGIN;
export let externalSetDevMode: ((v: boolean) => void) | null = null;
// !!! END WARNING !!!

interface UserProviderProps {
  children: ReactNode;
}

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const { send, subscribe, disconnect, connected } = useWebSocket();
  const { send: sendUner, subscribe: subscribeUner } = useUNERProtocol();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [devMode, setDevMode] = useState<boolean>(DEBUG_ALLOW_DEV_LOGIN);

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
          const userData = JSON.parse(savedUser);
          setUser(userData);
          setLoading(false);
          return;
        }

        if (connected) {
          const unsubscribe = subscribe(
            "sessionVerifyResponse",
            (payload: any) => {
              if (payload?.success && payload.user) {
                setUser(payload.user as User);
                sessionStorage.setItem(
                  USER_SESSION_KEY,
                  JSON.stringify(payload.user),
                );
              } else {
                sessionStorage.removeItem(USER_SESSION_KEY);
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
        sessionStorage.removeItem(USER_SESSION_KEY);
        setUser(null);
        setLoading(false);
      }
    };

    initializeUser();
  }, [connected, send, subscribe]);

  const isPinAckOk = useCallback(
    (payload: number[], expectedAction: number): boolean | null => {
      if (payload.length === 2) {
        const [action, code] = payload;
        if (action !== expectedAction) {
          return null;
        }
        return code === SETTINGS_ACK_CODES.OK;
      }

      if (payload.length >= 1 && payload[0] === expectedAction) {
        return true;
      }

      return null;
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

      const devLoginEnabled =
        devMode ||
        import.meta.env.VITE_ALLOW_DEV_LOGIN === "true" ||
        sessionStorage.getItem("ALLOW_DEV_LOGIN") === "true";

      if (!/^\d{4}$/.test(pin)) {
        return Promise.resolve(false);
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
          const userData: User = {
            id: `dev-${Date.now()}`,
            name: "Dev User",
          };
          setUser(userData);
          sessionStorage.setItem(USER_SESSION_KEY, JSON.stringify(userData));
        }

        return Promise.resolve(true);
      }

      return new Promise<boolean>((resolve) => {
        let settled = false;
        let off = () => {};

        const finish = (success: boolean) => {
          if (settled) return;
          settled = true;
          off();

          if (success && createSessionOnSuccess) {
            const userData: User = {
              id: `pin-${Date.now()}`,
              name: "Usuario PIN",
            };
            setUser(userData);
            sessionStorage.setItem(USER_SESSION_KEY, JSON.stringify(userData));
          }

          resolve(success);
        };

        off = subscribeUner(CMD.APP_PIN_CONFIG, (packet) => {
          const result = isPinAckOk(Array.from(packet.payload), action);
          if (result === null) {
            return;
          }
          finish(result);
        });

        sendUner(
          CMD.APP_PIN_CONFIG,
          PayloadBuilder.appPinConfig(action, pin),
        ).catch(() => finish(false));

        setTimeout(() => finish(false), 10000);
      });
    },
    [devMode, isPinAckOk, sendUner, subscribeUner],
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
    console.log("🔧 Logout - Limpiando usuario...");
    setUser(null);
    localStorage.removeItem(USER_SESSION_KEY);
    sessionStorage.removeItem(USER_SESSION_KEY);

    if (connected) {
      send("logout");
      disconnect();
    }
  }, [send, disconnect, connected]);

  return (
    <UserContext.Provider
      value={{
        user,
        loading,
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

export default useUser;

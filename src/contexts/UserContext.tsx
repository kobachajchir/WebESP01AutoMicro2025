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
  // añade aquí más campos si lo necesitas
}

interface UserContextType {
  user: User | null;
  loading: boolean;
  /** Valida el PIN de acceso por WebSocket UNER */
  login: (pin: string) => Promise<boolean>;
  /** Limpia el user y avisa al servidor */
  logout: () => void;
  setUser: (user: User | null) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const USER_SESSION_KEY = "user";

interface UserProviderProps {
  children: ReactNode;
}

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const { send, subscribe, disconnect, connected } = useWebSocket();
  const { send: sendUner, subscribe: subscribeUner } = useUNERProtocol();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Efecto para verificar si hay un usuario guardado al inicializar
  useEffect(() => {
    const initializeUser = async () => {
      try {
        localStorage.removeItem(USER_SESSION_KEY);

        // 1. Verificar si hay usuario en la sesion actual
        const savedUser = sessionStorage.getItem(USER_SESSION_KEY);
        if (savedUser) {
          const userData = JSON.parse(savedUser);
          setUser(userData);
          setLoading(false);
          return;
        }

        // 2. Si hay conexión WebSocket, intentar validar sesión
        if (connected) {
          // Opcional: enviar una verificación de sesión al servidor
          const unsubscribe = subscribe(
            "sessionVerifyResponse",
            (payload: any) => {
              if (payload?.success && payload.user) {
                setUser(payload.user as User);
                sessionStorage.setItem(USER_SESSION_KEY, JSON.stringify(payload.user));
              } else {
                // Sesion invalida, limpiar sesion local
                sessionStorage.removeItem(USER_SESSION_KEY);
                setUser(null);
              }
              setLoading(false);
              unsubscribe();
            }
          );

          // Enviar verificación de sesión
          send("verifySession");

          // Timeout por si no hay respuesta
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

  const login = useCallback(
    (pin: string) => {
      return new Promise<boolean>((resolve) => {
        if (!/^\d{4}$/.test(pin)) {
          resolve(false);
          return;
        }

        let settled = false;
        let off = () => {};
        const finish = (success: boolean) => {
          if (settled) return;
          settled = true;
          off();
          if (success) {
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
          const payload = packet.payload;
          if (payload.length === 2) {
            const [action, code] = payload;
            if (action === APP_PIN_ACTION.VALIDATE) {
              finish(code === SETTINGS_ACK_CODES.OK);
            }
          }

          if (payload.length === 5 && payload[0] === APP_PIN_ACTION.VALIDATE) {
            finish(true);
          }
        });

        sendUner(
          CMD.APP_PIN_CONFIG,
          PayloadBuilder.appPinConfig(APP_PIN_ACTION.VALIDATE, pin)
        ).catch(() => finish(false));

        setTimeout(() => finish(false), 10000);
      });
    },
    [sendUner, subscribeUner]
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
    <UserContext.Provider value={{ user, loading, login, logout, setUser }}>
      {children}
    </UserContext.Provider>
  );
};

/** Hook para usar el contexto de usuario */
export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error("useUser debe usarse dentro de <UserProvider>");
  }
  return ctx;
}

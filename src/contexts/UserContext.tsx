// src/contexts/UserContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
} from "react";
import type { ReactNode } from "react";
import { useWebSocket } from "./WebSocketContext";

export interface User {
  id: string;
  name: string;
  // añade aquí más campos si lo necesitas
}

interface UserContextType {
  user: User | null;
  /** Envía credenciales por WS y espera 'loginResponse' */
  login: (username: string, password: string) => Promise<boolean>;
  /** Limpia el user y avisa al servidor */
  logout: () => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

interface UserProviderProps {
  children: ReactNode;
}

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const { send, subscribe, disconnect } = useWebSocket();
  const [user, setUser] = useState<User | null>(null);

  const login = useCallback(
    (username: string, password: string) => {
      return new Promise<boolean>((resolve) => {
        // 1) Suscribirnos al evento de respuesta
        const unsubscribe = subscribe("loginResponse", (payload: any) => {
          if (payload?.success && payload.user) {
            setUser(payload.user as User);
            resolve(true);
          } else {
            resolve(false);
          }
          unsubscribe();
        });

        // 2) Enviar credenciales al firmware
        send("login", { username, password });
      });
    },
    [send, subscribe]
  );

  const logout = useCallback(() => {
    setUser(null);
    send("logout");
    // opcional: cerrar WS
    disconnect();
  }, [send, disconnect]);

  return (
    <UserContext.Provider value={{ user, login, logout }}>
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

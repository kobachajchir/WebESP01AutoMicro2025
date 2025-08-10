// src/contexts/UserContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
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
  loading: boolean;
  /** Envía credenciales por WS y espera 'loginResponse' */
  login: (username: string, password: string) => Promise<boolean>;
  /** Limpia el user y avisa al servidor */
  logout: () => void;
  setUser: (user: User | null) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

interface UserProviderProps {
  children: ReactNode;
}

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const { send, subscribe, disconnect, connected } = useWebSocket();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Efecto para verificar si hay un usuario guardado al inicializar
  useEffect(() => {
    const initializeUser = async () => {
      try {
        // 1. Verificar si hay usuario en localStorage
        const savedUser = localStorage.getItem("user");
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
                localStorage.setItem("user", JSON.stringify(payload.user));
              } else {
                // Sesión inválida, limpiar localStorage
                localStorage.removeItem("user");
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
          // MOCK: Sin conexión, simular usuario después de 2 segundos
          console.log(
            "🔧 MODO MOCK: Simulando login automático en 2 segundos..."
          );

          setTimeout(() => {
            const mockUser: User = {
              id: "mock-user-123",
              name: "Usuario de Desarrollo",
            };

            setUser(mockUser);
            localStorage.setItem("user", JSON.stringify(mockUser));
            setLoading(false);

            console.log("✅ Usuario mock asignado:", mockUser);
          }, 2000);
        }
      } catch (error) {
        console.error("Error initializing user:", error);
        localStorage.removeItem("user");

        // MOCK: En caso de error, también usar mock después de 2 segundos
        console.log("🔧 ERROR - Usando usuario mock como fallback...");

        setTimeout(() => {
          const mockUser: User = {
            id: "mock-user-error-fallback",
            name: "Usuario Mock (Error Fallback)",
          };

          setUser(mockUser);
          localStorage.setItem("user", JSON.stringify(mockUser));
          setLoading(false);

          console.log("✅ Usuario mock fallback asignado:", mockUser);
        }, 2000);
      }
    };

    initializeUser();
  }, [connected, send, subscribe]);

  const login = useCallback(
    (username: string, password: string) => {
      return new Promise<boolean>((resolve) => {
        // MOCK: Simular login exitoso para desarrollo
        if (!connected) {
          console.log("🔧 MODO MOCK: Simulando login exitoso...");

          setTimeout(() => {
            const mockUser: User = {
              id: `mock-${username}-${Date.now()}`,
              name: username.charAt(0).toUpperCase() + username.slice(1),
            };

            setUser(mockUser);
            localStorage.setItem("user", JSON.stringify(mockUser));
            console.log("✅ Login mock exitoso:", mockUser);
            resolve(true);
          }, 1000);

          return;
        }

        // Lógica real con WebSocket
        const unsubscribe = subscribe("loginResponse", (payload: any) => {
          if (payload?.success && payload.user) {
            const userData = payload.user as User;
            setUser(userData);
            localStorage.setItem("user", JSON.stringify(userData));
            resolve(true);
          } else {
            resolve(false);
          }
          unsubscribe();
        });

        send("login", { username, password });

        setTimeout(() => {
          resolve(false);
          unsubscribe();
        }, 10000);
      });
    },
    [send, subscribe, connected]
  );

  const logout = useCallback(() => {
    console.log("🔧 Logout - Limpiando usuario...");
    setUser(null);
    localStorage.removeItem("user");

    if (connected) {
      send("logout");
      disconnect();
    }
  }, [send, disconnect, connected]);

  return (
    <UserContext.Provider value={{ user, loading, login, logout ,setUser}}>
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

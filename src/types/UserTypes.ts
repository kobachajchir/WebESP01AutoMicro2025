export interface User {
  id: string;
  name: string;
  // añade aquí otros campos que quieras exponer
}

export interface UserContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}
export interface User {
  id: string;
  name: string;
  // añade aquí otros campos que quieras exponer
}

export interface UserContextType {
  user: User | null;
  loading?: boolean;
  remotePinAuthenticated?: boolean;
  login: (pin: string) => Promise<boolean>;
  validatePin?: (pin: string) => Promise<boolean>;
  logout: () => void;
}

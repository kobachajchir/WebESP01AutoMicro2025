// src/api/userRepository.ts

export interface User {
  id: string;
  name: string;
  // añade aquí más campos según tu API
}

interface LoginResponse {
  user: User;
  token: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ""; // p.ej. 'https://api.midominio.com'
const STORAGE_TOKEN_KEY = "authToken";
const STORAGE_USER_KEY = "currentUser";

/**
 * Hace login contra la API, almacena el token y los datos de usuario en localStorage.
 * Lanza un Error si la respuesta no es OK.
 */
export async function login(username: string, password: string): Promise<User> {
  const res = await fetch(`${API_BASE_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.message ?? "Login failed");
  }

  const data = (await res.json()) as LoginResponse;
  localStorage.setItem(STORAGE_TOKEN_KEY, data.token);
  localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(data.user));
  return data.user;
}

/**
 * Borra el token y los datos de usuario del localStorage.
 */
export function logout(): void {
  localStorage.removeItem(STORAGE_TOKEN_KEY);
  localStorage.removeItem(STORAGE_USER_KEY);
}

/**
 * Recupera el usuario almacenado en localStorage (sin contactar a la API).
 * Útil para restaurar sesión al iniciar la app.
 */
export function getCurrentUser(): User | null {
  const json = localStorage.getItem(STORAGE_USER_KEY);
  if (!json) return null;
  try {
    return JSON.parse(json) as User;
  } catch {
    return null;
  }
}

/**
 * Retorna el token de autenticación actual o null si no existe.
 */
export function getAuthToken(): string | null {
  return localStorage.getItem(STORAGE_TOKEN_KEY);
}

/**
 * Wrapper para hacer fetch con el header Authorization si hay token.
 * Lanza Error si la respuesta no es OK.
 */
export async function fetchWithAuth<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.message ?? res.statusText);
  }

  return (await res.json()) as T;
}

/**
 * Ejemplo de llamada autenticada para obtener el perfil del usuario.
 */
export async function getProfile(): Promise<User> {
  return fetchWithAuth<User>("/users/me");
}

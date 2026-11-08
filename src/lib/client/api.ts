const TOKEN_KEY = "nodo-token-v1";

let memoryToken: string | null = null;

export function storedToken(): string | null {
  if (memoryToken) return memoryToken;
  try {
    memoryToken = window.localStorage.getItem(TOKEN_KEY);
  } catch {
    memoryToken = null;
  }
  return memoryToken;
}

export function saveToken(token: string): void {
  memoryToken = token;
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    console.warn("[NODO] localStorage non disponibile: il token vale per questa scheda.");
  }
}

export function clearToken(): void {
  memoryToken = null;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // niente da fare
  }
}

/** fetch con il token condiviso nell'header e i cookie di sessione. */
export function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = storedToken();
  if (token) headers.set("X-Nodo-Token", token);
  return fetch(input, { ...init, headers, credentials: "same-origin" });
}

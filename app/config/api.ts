// ── Configuración centralizada de endpoints API ──

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://localhost:7019";

export const API_ENDPOINTS = {
  // RFID Reader
  generateToken: (dias: number) => `/api/Rfid/generate-token?dias=${dias}`,
  connect: "/api/Rfid/connect",
  disconnect: "/api/Rfid/disconnect",
  listaLecturas: "/api/Rfid/listaActualizaLecturas",

  // Mantenimiento de Tags
  manteRegistroTag: "/api/Rfid/ManteRegistroTag",

  // Validación de Recepción
  validaRecepcion: "/api/Rfid/ValidaRecepcion",
} as const;

export function buildUrl(baseUrl: string, endpoint: string): string {
  return `${baseUrl.replace(/\/$/, "")}${endpoint}`;
}

export const DEFAULT_BASE_URL = API_BASE;

// Headers comunes
export function getHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
  };
  if (token) {
    headers["X-Auth-Token"] = token;
  }
  return headers;
}

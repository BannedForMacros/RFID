// ── Configuración centralizada de endpoints API ──

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://localhost:7019";

export const API_ENDPOINTS = {
  // Conexión y lectura
  generateToken: (dias: number) => `/api/Rfid/generate-token?dias=${dias}`,
  connect: "/api/Rfid/connect_M", // Nuevo método connect para multiinstancias
  disconnect: (ip: string) => `/api/Rfid/disconnect_m?ip=${ip}`, // Nuevo método disconnect para multiinstancias
  status: "/api/Rfid/status", // Nuevo método para listar instancias activas
  listaLecturas: "/api/Rfid/listaActualizaLecturas",

  // Mantenimiento de Tags
  manteRegistroTag: "/api/Rfid/ManteRegistroTag",

  // Mantenedores (CRUD)
  mantenedorReader: "/api/Rfid/MantenedorReader",
  mantenedorAntenas: "/api/Rfid/MantenedorAntenas",

  // Validación de Recepción
  validaRecepcion: "/api/Rfid/ValidaRecepcion",
} as const;

/**
 * Normaliza la URL base del backend. Elimina barras finales y el sufijo
 * `/api/Rfid` si el usuario lo escribió por error, ya que los endpoints ya
 * lo incluyen.
 */
export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl
    .trim()
    .replace(/\/$/, "")
    .replace(/\/api\/Rfid$/i, "");
}

export function buildUrl(baseUrl: string, endpoint: string): string {
  return `${normalizeBaseUrl(baseUrl)}${endpoint}`;
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

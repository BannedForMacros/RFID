import { API_ENDPOINTS, buildUrl, getHeaders } from "../config/api";
import { mockApi } from "../lib/mockApi";
import type { ReaderManteRequest, ReaderManteResponse } from "../../types/rfid";

const EMPTY_RESPONSE: ReaderManteResponse = { codigo: 0, mensaje: "" };

async function readerFetch(
  url: string,
  body: ReaderManteRequest,
  token: string
): Promise<ReaderManteResponse> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...getHeaders(token),
      "ngrok-skip-browser-warning": "true",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  // Handle 204 No Content or empty body
  const text = await res.text();
  if (!text) return EMPTY_RESPONSE;

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Respuesta inválida del servidor: ${text.substring(0, 100)}`);
  }
}

/** CRUD del mantenedor de readers (/api/Rfid/MantenedorReader) */
export const readerManteService = {
  /**
   * Listar readers (op 3).
   * Si `ip` trae valor, filtra por esa IP; si va vacío devuelve todos.
   * En modo simulación devuelve los readers de `mockApi`.
   */
  async list(
    baseUrl: string,
    token: string,
    mockMode: boolean = false,
    ip: string = ""
  ): Promise<ReaderManteResponse> {
    if (mockMode) {
      const listareader = await mockApi.listReaders();
      return { codigo: 1, mensaje: "OK (mock)", listareader };
    }
    return readerFetch(
      buildUrl(baseUrl, API_ENDPOINTS.mantenedorReader),
      { id: 0, ip, descripcion: "", estado: "", id_ope: 3 },
      token
    );
  },

  /** Insertar un nuevo reader (op 1) */
  async insert(
    baseUrl: string,
    token: string,
    reader: { ip: string; descripcion: string; estado?: string }
  ): Promise<ReaderManteResponse> {
    return readerFetch(
      buildUrl(baseUrl, API_ENDPOINTS.mantenedorReader),
      {
        id: 0,
        ip: reader.ip,
        descripcion: reader.descripcion,
        estado: reader.estado ?? "1",
        id_ope: 1,
      },
      token
    );
  },

  /** Actualizar un reader existente (op 2). `id` es la clave autonumérica. */
  async update(
    baseUrl: string,
    token: string,
    reader: { id: number; ip: string; descripcion: string; estado: string }
  ): Promise<ReaderManteResponse> {
    return readerFetch(
      buildUrl(baseUrl, API_ENDPOINTS.mantenedorReader),
      {
        id: reader.id,
        ip: reader.ip,
        descripcion: reader.descripcion,
        estado: reader.estado,
        id_ope: 2,
      },
      token
    );
  },

  /** Eliminar un reader por IP (op 4). */
  async remove(baseUrl: string, token: string, ip: string): Promise<ReaderManteResponse> {
    return readerFetch(
      buildUrl(baseUrl, API_ENDPOINTS.mantenedorReader),
      { id: 0, ip, descripcion: "", estado: "", id_ope: 4 },
      token
    );
  },
};

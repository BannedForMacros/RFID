import { API_ENDPOINTS, buildUrl, getHeaders } from "../config/api";
import type { TagRegistro, TagRegistroResponse } from "../../types/rfid";

const EMPTY_RESPONSE: TagRegistroResponse = { codigo: 0, mensaje: "", registros: [] };

async function tagFetch(url: string, body: object, token: string): Promise<TagRegistroResponse> {
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

export const tagService = {
  /** Listar todos los tags o uno específico */
  async list(baseUrl: string, token: string, idTag: string = ""): Promise<TagRegistroResponse> {
    return tagFetch(buildUrl(baseUrl, API_ENDPOINTS.manteRegistroTag), {
      idope: 1,
      idTag,
      codProducto: "",
      codBarra: "",
      codManual: "",
      descripcion: "",
      estado: "",
    }, token);
  },

  /** Insertar un nuevo tag */
  async insert(baseUrl: string, token: string, tag: Omit<TagRegistro, "estado"> & { estado?: string }): Promise<TagRegistroResponse> {
    return tagFetch(buildUrl(baseUrl, API_ENDPOINTS.manteRegistroTag), {
      idope: 2,
      idTag: tag.idTag,
      codProducto: tag.codProducto,
      codBarra: tag.codBarra,
      codManual: tag.codManual,
      descripcion: tag.descripcion,
      estado: tag.estado || "A",
    }, token);
  },

  /** Actualizar un tag existente (idTag es la clave) */
  async update(baseUrl: string, token: string, tag: TagRegistro): Promise<TagRegistroResponse> {
    return tagFetch(buildUrl(baseUrl, API_ENDPOINTS.manteRegistroTag), {
      idope: 3,
      idTag: tag.idTag,
      codProducto: tag.codProducto,
      codBarra: tag.codBarra,
      codManual: tag.codManual,
      descripcion: tag.descripcion,
      estado: tag.estado,
    }, token);
  },

  /** Eliminar un tag */
  async remove(baseUrl: string, token: string, idTag: string): Promise<TagRegistroResponse> {
    return tagFetch(buildUrl(baseUrl, API_ENDPOINTS.manteRegistroTag), {
      idope: 4,
      idTag,
      codProducto: "",
      codBarra: "",
      codManual: "",
      descripcion: "",
      estado: "",
    }, token);
  },

  /** Cambiar estado de un tag (Activar/Inactivar) */
  async toggleState(baseUrl: string, token: string, idTag: string, nuevoEstado: string): Promise<TagRegistroResponse> {
    return tagFetch(buildUrl(baseUrl, API_ENDPOINTS.manteRegistroTag), {
      idope: 5,
      idTag,
      codProducto: "",
      codBarra: "",
      codManual: "",
      descripcion: "",
      estado: nuevoEstado,
    }, token);
  },
};

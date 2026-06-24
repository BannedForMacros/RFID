import { API_ENDPOINTS, buildUrl, getHeaders } from "../config/api";
import type { AntenaManteRequest, AntenaManteResponse } from "../../types/rfid";

const EMPTY_RESPONSE: AntenaManteResponse = { codigo: 0, mensaje: "" };

async function antenaFetch(
  url: string,
  body: AntenaManteRequest,
  token: string
): Promise<AntenaManteResponse> {
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

/** CRUD del mantenedor de antenas (/api/Rfid/MantenedorAntenas) */
export const antenaManteService = {
  /**
   * Listar antenas (op 3).
   * Si `ipReader` trae valor, filtra por las antenas de ese reader; vacío devuelve todas.
   */
  async list(
    baseUrl: string,
    token: string,
    ipReader: string = ""
  ): Promise<AntenaManteResponse> {
    return antenaFetch(
      buildUrl(baseUrl, API_ENDPOINTS.mantenedorAntenas),
      {
        ip_reader: ipReader,
        num_antena: 0,
        descripcion: "",
        potencia: 0,
        estado: "",
        id_ope: 3,
        id_antena: 0,
      },
      token
    );
  },

  /** Insertar una nueva antena (op 1). `potencia` en % (0–100). */
  async insert(
    baseUrl: string,
    token: string,
    antena: {
      ip_reader: string;
      num_antena: number;
      descripcion: string;
      potencia: number;
      estado?: string;
    }
  ): Promise<AntenaManteResponse> {
    return antenaFetch(
      buildUrl(baseUrl, API_ENDPOINTS.mantenedorAntenas),
      {
        ip_reader: antena.ip_reader,
        num_antena: antena.num_antena,
        descripcion: antena.descripcion,
        potencia: antena.potencia,
        estado: antena.estado ?? "1",
        id_ope: 1,
        id_antena: 0,
      },
      token
    );
  },

  /** Actualizar una antena existente (op 2). `id_antena` es la clave autonumérica. */
  async update(
    baseUrl: string,
    token: string,
    antena: {
      id_antena: number;
      ip_reader: string;
      num_antena: number;
      descripcion: string;
      potencia: number;
      estado: string;
    }
  ): Promise<AntenaManteResponse> {
    return antenaFetch(
      buildUrl(baseUrl, API_ENDPOINTS.mantenedorAntenas),
      {
        ip_reader: antena.ip_reader,
        num_antena: antena.num_antena,
        descripcion: antena.descripcion,
        potencia: antena.potencia,
        estado: antena.estado,
        id_ope: 2,
        id_antena: antena.id_antena,
      },
      token
    );
  },

  /** Eliminar una antena por su id autonumérico (op 4). */
  async remove(
    baseUrl: string,
    token: string,
    idAntena: number
  ): Promise<AntenaManteResponse> {
    return antenaFetch(
      buildUrl(baseUrl, API_ENDPOINTS.mantenedorAntenas),
      {
        ip_reader: "",
        num_antena: 0,
        descripcion: "",
        potencia: 0,
        estado: "",
        id_ope: 4,
        id_antena: idAntena,
      },
      token
    );
  },
};

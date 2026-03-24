import { API_ENDPOINTS, buildUrl, getHeaders } from "../config/api";
import type { TagRegistro, TagRegistroResponse } from "../../types/rfid";

export const tagService = {
  /** Listar todos los tags o uno específico */
  async list(baseUrl: string, token: string, idTag: string = ""): Promise<TagRegistroResponse> {
    const res = await fetch(buildUrl(baseUrl, API_ENDPOINTS.manteRegistroTag), {
      method: "POST",
      headers: getHeaders(token),
      body: JSON.stringify({
        idope: 1,
        idTag,
        codProducto: "",
        codBarra: "",
        codManual: "",
        descripcion: "",
        estado: "",
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    return res.json();
  },

  /** Insertar un nuevo tag */
  async insert(baseUrl: string, token: string, tag: Omit<TagRegistro, "estado"> & { estado?: string }): Promise<TagRegistroResponse> {
    const res = await fetch(buildUrl(baseUrl, API_ENDPOINTS.manteRegistroTag), {
      method: "POST",
      headers: getHeaders(token),
      body: JSON.stringify({
        idope: 2,
        idTag: tag.idTag,
        codProducto: tag.codProducto,
        codBarra: tag.codBarra,
        codManual: tag.codManual,
        descripcion: tag.descripcion,
        estado: tag.estado || "A",
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    return res.json();
  },

  /** Actualizar un tag existente (idTag es la clave) */
  async update(baseUrl: string, token: string, tag: TagRegistro): Promise<TagRegistroResponse> {
    const res = await fetch(buildUrl(baseUrl, API_ENDPOINTS.manteRegistroTag), {
      method: "POST",
      headers: getHeaders(token),
      body: JSON.stringify({
        idope: 3,
        idTag: tag.idTag,
        codProducto: tag.codProducto,
        codBarra: tag.codBarra,
        codManual: tag.codManual,
        descripcion: tag.descripcion,
        estado: tag.estado,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    return res.json();
  },

  /** Eliminar un tag */
  async remove(baseUrl: string, token: string, idTag: string): Promise<TagRegistroResponse> {
    const res = await fetch(buildUrl(baseUrl, API_ENDPOINTS.manteRegistroTag), {
      method: "POST",
      headers: getHeaders(token),
      body: JSON.stringify({
        idope: 4,
        idTag,
        codProducto: "",
        codBarra: "",
        codManual: "",
        descripcion: "",
        estado: "",
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    return res.json();
  },
};

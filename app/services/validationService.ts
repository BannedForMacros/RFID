import { API_ENDPOINTS, buildUrl, getHeaders } from "../config/api";
import type { ValidacionResponse } from "../../types/rfid";

export const validationService = {
  /** Validar recepción de tags contra reader */
  async validate(
    baseUrl: string,
    token: string,
    ipreader: string
  ): Promise<ValidacionResponse> {
    const res = await fetch(buildUrl(baseUrl, API_ENDPOINTS.validaRecepcion), {
      method: "POST",
      headers: getHeaders(token),
      body: JSON.stringify({
        idope: 4,
        ipreader,
      }),
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errorText}`);
    }
    
    const text = await res.text();
    if (!text) {
      return { codigo: 0, mensaje: "Respuesta vacía de la API (204)", lecturas: [], faltantes: [] } as ValidacionResponse;
    }
    
    return JSON.parse(text);
  },
};

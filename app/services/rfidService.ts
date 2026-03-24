import { API_ENDPOINTS, buildUrl, getHeaders } from "../config/api";
import { mockApi } from "../lib/mockApi";
import type { Tag } from "../../types/rfid";

async function apiFetch(url: string, options: RequestInit = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      "ngrok-skip-browser-warning": "true",
      ...(options.headers as Record<string, string>),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  // Handle 204 No Content or empty body
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export const rfidService = {
  async generateToken(baseUrl: string, dias: number, mockMode: boolean): Promise<string> {
    if (mockMode) {
      return mockApi.generateToken(dias);
    }
    const url = buildUrl(baseUrl, API_ENDPOINTS.generateToken(dias));
    const data = await apiFetch(url, { method: "POST" });
    return data.token || data.access_token || JSON.stringify(data);
  },

  async connect(
    baseUrl: string,
    token: string,
    ip: string,
    potenciaDbm: number,
    mockMode: boolean
  ): Promise<void> {
    if (mockMode) {
      await mockApi.connect(ip);
      return;
    }
    await apiFetch(buildUrl(baseUrl, API_ENDPOINTS.connect), {
      method: "POST",
      headers: getHeaders(token),
      body: JSON.stringify({
        ipreader: ip,
        potenciaDbm,
        tlectura: 0,
      }),
    });
  },

  async disconnect(baseUrl: string, token: string, ip: string, mockMode: boolean): Promise<void> {
    if (mockMode) {
      await mockApi.disconnect(ip);
      return;
    }
    await apiFetch(buildUrl(baseUrl, API_ENDPOINTS.disconnect), {
      method: "POST",
      headers: getHeaders(token),
      body: JSON.stringify({ ipreader: ip }),
    });
  },

  async testConnection(
    baseUrl: string,
    ip: string,
    mockMode: boolean
  ): Promise<{ ok: boolean; latencyMs: number }> {
    if (mockMode) {
      return mockApi.testConnection(ip);
    }
    const start = Date.now();
    try {
      await fetch(baseUrl, { method: "HEAD", signal: AbortSignal.timeout(3000) });
      return { ok: true, latencyMs: Date.now() - start };
    } catch {
      return { ok: false, latencyMs: 0 };
    }
  },

  async listReadings(
    baseUrl: string,
    token: string,
    ip: string,
    antenasNums: number[],
    mockMode: boolean
  ): Promise<Tag[]> {
    if (mockMode) {
      return mockApi.listReadings(ip, antenasNums);
    }
    const data = await apiFetch(buildUrl(baseUrl, API_ENDPOINTS.listaLecturas), {
      method: "POST",
      headers: getHeaders(token),
      body: JSON.stringify({ ope: 1, tagid: "", ipreader: ip, antenas: antenasNums }),
    });
    return Array.isArray(data) ? data : data.lecturas ?? [];
  },

  async clearReadings(
    baseUrl: string,
    token: string,
    ip: string,
    mockMode: boolean
  ): Promise<void> {
    if (mockMode) {
      await mockApi.clearReadings(ip);
      return;
    }
    if (token) {
      await apiFetch(buildUrl(baseUrl, API_ENDPOINTS.listaLecturas), {
        method: "POST",
        headers: getHeaders(token),
        body: JSON.stringify({ ope: 3, tagid: "", ipreader: ip }),
      });
    }
  },
};

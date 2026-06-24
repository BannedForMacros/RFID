/**
 * Mock API — simula el backend RFID para pruebas sin hardware real.
 * Reemplazar las llamadas de mockApi por las reales cuando la API esté disponible.
 */
import type { Tag, ReaderMante, AntenaMante } from "../../types/rfid";

// ── Store en memoria por IP de reader ──
const mockStore: Record<string, { tags: Tag[] }> = {};

// ── Datos simulados de los mantenedores (solo modo simulación) ──
const mockReaders: ReaderMante[] = [
  { id: 1, ip: "192.168.10.1", descripcion: "Reader Almacén", estado: "1", fechacrea: "2026-01-01T00:00:00.000Z" },
  { id: 2, ip: "192.168.10.2", descripcion: "Reader Despacho", estado: "1", fechacrea: "2026-01-01T00:00:00.000Z" },
];
const mockAntenas: AntenaMante[] = [
  { id: 1, id_reader: 1, antena_number: 1, descripcion: "Puerta entrada", potencia: 80, estado: "1" },
  { id: 2, id_reader: 1, antena_number: 2, descripcion: "Puerta salida", potencia: 75, estado: "1" },
  { id: 3, id_reader: 2, antena_number: 1, descripcion: "Faja despacho", potencia: 90, estado: "1" },
];

function getStore(ip: string) {
  if (!mockStore[ip]) mockStore[ip] = { tags: [] };
  return mockStore[ip];
}

// EPC de 12 bytes en HEX (formato estándar GS1)
function generateEPC(ip: string): string {
  const suffix = ip.split(".").pop()?.padStart(3, "0") ?? "000";
  const random = Array.from({ length: 9 }, () =>
    Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, "0")
      .toUpperCase()
  ).join("");
  return `E2${suffix}${random}`;
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export const mockApi = {
  /** Genera un token de prueba */
  async generateToken(dias: number): Promise<string> {
    await delay(300 + Math.random() * 200);
    const payload = btoa(`mock:dias=${dias}:ts=${Date.now()}`).slice(0, 32);
    return `MOCK.${payload}.TESTTOKEN`;
  },

  /** Simula la conexión al reader */
  async connect(ip: string): Promise<void> {
    await delay(500 + Math.random() * 300);
    getStore(ip); // inicializa store si no existe
  },

  /** Simula la desconexión */
  async disconnect(_ip: string): Promise<void> {
    await delay(150);
  },

  /** Prueba de comunicación: 85% éxito, latencia aleatoria */
  async testConnection(_ip: string): Promise<{ ok: boolean; latencyMs: number }> {
    const latencyMs = Math.floor(10 + Math.random() * 90);
    await delay(latencyMs + Math.random() * 100);
    const ok = Math.random() > 0.15;
    return { ok, latencyMs: ok ? latencyMs : 0 };
  },

  /** Devuelve lista de tags por antenas activas (con posibles nuevos en cada llamada) */
  async listReadings(ip: string, antenasNums: number[] = [1]): Promise<Tag[]> {
    await delay(80 + Math.random() * 60);
    const store = getStore(ip);
    const now = new Date().toISOString();

    // Agregar nuevos tags aleatoriamente, asignando antena al azar entre las activas
    const addChance = store.tags.length < 5 ? 0.65 : 0.2;
    const toAdd = Math.random() < addChance ? Math.ceil(Math.random() * 2) : 0;
    for (let i = 0; i < toAdd; i++) {
      const antena = antenasNums[Math.floor(Math.random() * antenasNums.length)];
      store.tags.push({
        tagid: generateEPC(ip),
        contador: 1,
        fecini: now,
        fecfin: now,
        ipreader: ip,
        antena,
      });
    }

    // Actualizar contador y fecfin de los existentes
    return store.tags.map((tag) => ({
      ...tag,
      contador: tag.contador + Math.floor(Math.random() * 3),
      fecfin: now,
    }));
  },

  /** Limpia las lecturas del reader */
  async clearReadings(ip: string): Promise<void> {
    await delay(80);
    if (mockStore[ip]) mockStore[ip].tags = [];
  },

  /** Mantenedor de readers simulado (operación 3 — listar) */
  async listReaders(): Promise<ReaderMante[]> {
    await delay(120);
    return mockReaders.map((r) => ({ ...r }));
  },

  /** Mantenedor de antenas simulado (operación 3 — listar) */
  async listAntenas(): Promise<AntenaMante[]> {
    await delay(120);
    return mockAntenas.map((a) => ({ ...a }));
  },
};

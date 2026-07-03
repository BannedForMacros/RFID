"use client";

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { DEFAULT_BASE_URL } from "../config/api";
import { rfidService } from "../services/rfidService";
import { readerManteService } from "../services/readerManteService";
import { antenaManteService } from "../services/antenaManteService";
import type {
  AntennaConfig,
  AntenaMante,
  GlobalConfig,
  LogEntry,
  ReaderConfig,
  ReaderMante,
  ReaderRuntimeState,
} from "../../types/rfid";

// ── Defaults ──

const DEFAULT_READER_STATE: ReaderRuntimeState = {
  status: "disconnected",
  tags: [],
  newTagIds: [],
  scanCount: 0,
  lastUpdate: null,
  antenasState: {},
};

// ── Estado activo ──
function isActivo(estado: string | undefined | null) {
  const e = String(estado ?? "").trim().toUpperCase();
  return e === "1" || e === "A" || e === "ACTIVO";
}

/**
 * Mapea lo que devuelven los mantenedores (ReaderMante + AntenaMante) a la
 * forma interna que usa la app (ReaderConfig). Solo incluye readers y antenas
 * con estado activo — los inactivos quedan fuera de la operación.
 */
function mapToReaderConfigs(readers: ReaderMante[], antenas: AntenaMante[]): ReaderConfig[] {
  return readers
    .filter((r) => isActivo(r.estado))
    .map((r) => {
      const antenasReader: AntennaConfig[] = antenas
        .filter((a) => a.id_reader === r.id && isActivo(a.estado))
        .sort((a, b) => a.antena_number - b.antena_number)
        .map((a) => ({
          numero: a.antena_number,
          nombre: a.descripcion?.trim() || `Antena ${a.antena_number}`,
          potencia: a.potencia, // viene en % desde el mantenedor
        }));
      return {
        id: String(r.id),
        name: r.descripcion?.trim() || r.ip,
        ip: r.ip,
        antenas: antenasReader,
      };
    });
}

// ── Context interface ──

interface AppContextValue {
  // Config
  globalConfig: GlobalConfig;
  setGlobalConfig: React.Dispatch<React.SetStateAction<GlobalConfig>>;
  token: string;
  setToken: React.Dispatch<React.SetStateAction<string>>;

  // Logs
  logs: LogEntry[];
  addLog: (msg: string, type?: LogEntry["type"]) => void;
  clearLogs: () => void;

  // Readers
  readers: ReaderConfig[];
  loadingReaders: boolean;
  reloadReaders: () => Promise<void>;
  readerStates: Record<string, ReaderRuntimeState>;
  activeReaderId: string;
  setActiveReaderId: (id: string) => void;
  activeAntennaNum: number | null;
  setActiveAntennaNum: (num: number | null) => void;
  activeState: ReaderRuntimeState;
  activeReader: ReaderConfig | undefined;
  updateReaderState: (id: string, updater: (prev: ReaderRuntimeState) => Partial<ReaderRuntimeState>) => void;
  setReaderStates: React.Dispatch<React.SetStateAction<Record<string, ReaderRuntimeState>>>;
  handleConnect: (readerId: string) => Promise<void>;
  handleDisconnect: (readerId: string) => Promise<void>;
  handleTestReader: (readerId: string) => Promise<{ ok: boolean; latencyMs: number }>;
  handleGenerateToken: () => Promise<void>;

  // Polling
  polling: boolean;
  startPolling: () => void;
  stopPolling: () => Promise<void>;

  // Refs (for polling internals)
  readersRef: React.RefObject<ReaderConfig[]>;
  readerStatesRef: React.RefObject<Record<string, ReaderRuntimeState>>;
  globalConfigRef: React.RefObject<GlobalConfig>;
  tokenRef: React.RefObject<string>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  // ── Global config ──
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig>({
    baseUrl: DEFAULT_BASE_URL, // viene de NEXT_PUBLIC_API_BASE_URL (.env.local)
    dias: 1,
    mockMode: false, // hay API real disponible
  });
  const [token, setToken] = useState("");

  // ── Logs ──
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const addLog = useCallback((msg: string, type: LogEntry["type"] = "default") => {
    const time = new Date().toLocaleTimeString("es-PE", { hour12: false });
    setLogs((prev) => [{ msg, type, time }, ...prev].slice(0, 80));
  }, []);
  const clearLogs = useCallback(() => setLogs([]), []);
  const addLogRef = useRef(addLog);
  useEffect(() => { addLogRef.current = addLog; }, [addLog]);

  // ── Readers ──
  // Nada hardcodeado: la lista se carga desde los mantenedores (ver loadReaders).
  const [readers, setReaders] = useState<ReaderConfig[]>([]);
  const [readerStates, setReaderStates] = useState<Record<string, ReaderRuntimeState>>({});
  const [activeReaderId, setActiveReaderId] = useState("");
  const [activeAntennaNum, setActiveAntennaNum] = useState<number | null>(null);
  const [loadingReaders, setLoadingReaders] = useState(false);

  // ── Polling State ──
  const [polling, setPolling] = useState(false);
  const pollingRef = useRef(false);
  useEffect(() => { pollingRef.current = polling; }, [polling]);

  // Refs
  const readersRef = useRef(readers);
  const readerStatesRef = useRef(readerStates);
  const globalConfigRef = useRef(globalConfig);
  const tokenRef = useRef(token);

  useEffect(() => { readersRef.current = readers; }, [readers]);
  useEffect(() => { readerStatesRef.current = readerStates; }, [readerStates]);
  useEffect(() => { globalConfigRef.current = globalConfig; }, [globalConfig]);
  useEffect(() => { tokenRef.current = token; }, [token]);
  useEffect(() => { setActiveAntennaNum(null); }, [activeReaderId]);

  const updateReaderState = useCallback(
    (id: string, updater: (prev: ReaderRuntimeState) => Partial<ReaderRuntimeState>) => {
      setReaderStates((prev) => {
        const current = prev[id] ?? DEFAULT_READER_STATE;
        return { ...prev, [id]: { ...current, ...updater(current) } };
      });
    },
    []
  );

  // ── Carga desde los mantenedores (fuente de verdad) ──
  const loadReaders = useCallback(async () => {
    const cfg = globalConfigRef.current;
    const t = tokenRef.current;
    // El listado de los mantenedores no requiere token, así que cargamos siempre.
    setLoadingReaders(true);
    try {
      const [rRes, aRes] = await Promise.all([
        readerManteService.list(cfg.baseUrl, t, cfg.mockMode),
        antenaManteService.list(cfg.baseUrl, t, cfg.mockMode),
      ]);
      if (rRes.codigo !== 1) addLog(`Error listando readers: ${rRes.mensaje}`, "error");
      if (aRes.codigo !== 1) addLog(`Error listando antenas: ${aRes.mensaje}`, "error");
      const mapped = mapToReaderConfigs(rRes.listareader ?? [], aRes.antenas ?? []);
      setReaders(mapped);
      
      // Consultar el estado activo de multiinstancias
      try {
        const activeInstances = await rfidService.getStatus(cfg.baseUrl, t, cfg.mockMode);
        addLog(`Status devuelto: ${JSON.stringify(activeInstances)}`, "info");
        
        // Calculamos synchronously si hay alguna instancia activa
        const anyActive = mapped.some((r) => {
          const instance = activeInstances.find((i: any) => (i.IP || i.ip) === r.ip);
          return instance && String(instance.Activo || instance.activo) === "1";
        });
        
        setReaderStates((prev) => {
          const next = { ...prev };
          mapped.forEach((r) => {
            const instance = activeInstances.find((i: any) => (i.IP || i.ip) === r.ip);
            
            if (instance) {
              const activoValue = String(instance.Activo || instance.activo);
              if (activoValue === "1") {
                next[r.id] = { ...(next[r.id] ?? DEFAULT_READER_STATE), status: "connected" };
              } else {
                next[r.id] = { ...(next[r.id] ?? DEFAULT_READER_STATE), status: "disconnected" };
              }
            } else if (!next[r.id] || next[r.id].status !== "disconnected") {
              next[r.id] = { ...(next[r.id] ?? DEFAULT_READER_STATE), status: "disconnected" };
            }
          });
          return next;
        });
        
        if (anyActive) {
          addLog("Iniciando lectura automática para instancias activas", "success");
          setPolling(true);
        }
      } catch (e: unknown) {
        addLog(`Error consultando estado de instancias: ${(e as Error).message}`, "error");
      }

      setActiveReaderId((prev) =>
        prev && mapped.some((r) => r.id === prev) ? prev : mapped[0]?.id ?? ""
      );
      addLog(
        `${mapped.length} reader(s) cargados desde el mantenedor`,
        mapped.length ? "success" : "info"
      );
    } catch (e: unknown) {
      addLog(`Error cargando configuración: ${(e as Error).message}`, "error");
    } finally {
      setLoadingReaders(false);
    }
  }, [addLog]);

  // Cargar al iniciar y cuando cambian token / modo / URL base.
  useEffect(() => {
    loadReaders();
  }, [loadReaders, token, globalConfig.mockMode, globalConfig.baseUrl]);

  // ── Connect / Disconnect ──

  const handleConnect = useCallback(async (readerId: string) => {
    const reader = readersRef.current.find((r) => r.id === readerId);
    if (!reader) return;
    if (!tokenRef.current && !globalConfigRef.current.mockMode) {
      addLog("Primero genera un token", "error");
      return;
    }
    if (reader.antenas.length === 0) {
      addLog("Agrega al menos una antena al reader", "error");
      return;
    }
    updateReaderState(readerId, () => ({ status: "connecting" }));
    addLog(`Conectando ${reader.name} (${reader.ip})...`, "info");
    try {
      const cfg = globalConfigRef.current;
      await rfidService.connect(cfg.baseUrl, tokenRef.current, reader.ip, 0, cfg.mockMode);
      updateReaderState(readerId, () => ({ status: "connected" }));
      addLog(`${reader.name} conectado`, "success");
      
      // Iniciar lectura automática al conectar un nuevo reader
      setPolling(true);
    } catch (e: unknown) {
      updateReaderState(readerId, () => ({ status: "error" }));
      addLog(`Error conectando ${reader.name}: ${(e as Error).message}`, "error");
    }
  }, [addLog, updateReaderState]);

  const handleDisconnect = useCallback(async (readerId: string) => {
    const reader = readersRef.current.find((r) => r.id === readerId);
    if (!reader) return;
    try {
      const cfg = globalConfigRef.current;
      await rfidService.disconnect(cfg.baseUrl, tokenRef.current, reader.ip, cfg.mockMode);
    } catch { /* ignorar */ }
    
    updateReaderState(readerId, () => ({ status: "disconnected", tags: [], newTagIds: [], scanCount: 0, lastUpdate: null }));
    addLog(`${reader.name} desconectado`, "info");
    
    // Si ya no queda ningún reader activo, apagamos el botón de lectura general
    const anyOtherActive = readersRef.current.some((r) => {
      if (r.id === readerId) return false;
      const s = readerStatesRef.current[r.id]?.status;
      return s === "connected" || s === "reading";
    });
    
    if (!anyOtherActive) {
      setPolling(false);
      addLog("Lectura en tiempo real detenida automáticamente (no hay readers activos)", "info");
    }
  }, [addLog, updateReaderState]);

  const handleTestReader = useCallback(async (readerId: string): Promise<{ ok: boolean; latencyMs: number }> => {
    const reader = readersRef.current.find((r) => r.id === readerId);
    if (!reader) throw new Error("Reader no encontrado");
    addLog(`Probando comunicación con ${reader.name} (${reader.ip})...`, "info");
    try {
      const cfg = globalConfigRef.current;
      const result = await rfidService.testConnection(cfg.baseUrl, reader.ip, cfg.mockMode);
      addLog(result.ok ? `${reader.name}: OK (${result.latencyMs}ms)` : `${reader.name}: Sin respuesta`, result.ok ? "success" : "error");
      return result;
    } catch (e: unknown) {
      addLog(`Error probando ${reader.name}: ${(e as Error).message}`, "error");
      return { ok: false, latencyMs: 0 };
    }
  }, [addLog]);

  const handleGenerateToken = useCallback(async () => {
    try {
      addLog("Generando token...", "info");
      const cfg = globalConfigRef.current;
      const t = await rfidService.generateToken(cfg.baseUrl, cfg.dias, cfg.mockMode);
      setToken(t);
      addLog(`Token generado (${cfg.dias} día${cfg.dias !== 1 ? "s" : ""})`, "success");
    } catch (e: unknown) {
      addLog(`Error token: ${(e as Error).message}`, "error");
    }
  }, [addLog]);

  // ── Polling Actions ──

  const pollAllReaders = useCallback(async () => {
    const currentReaders = readersRef.current;
    const { baseUrl, mockMode } = globalConfigRef.current;
    const t = tokenRef.current;
    const log = addLogRef.current;

    const active = currentReaders.filter((r) => {
      const s = readerStatesRef.current[r.id]?.status;
      return s === "connected" || s === "reading";
    });
    if (active.length === 0) return;

    await Promise.all(
      active.map(async (reader) => {
        try {
          const antenasNums = reader.antenas.map((a) => a.numero);
          const lista = await rfidService.listReadings(baseUrl, t, reader.ip, antenasNums, mockMode);
          const prevTags = readerStatesRef.current[reader.id]?.tags ?? [];
          const prevSet = new Set(prevTags.map((tg) => tg.tagid));
          const newOnes = lista.filter((tg) => !prevSet.has(tg.tagid));
          if (newOnes.length > 0) log(`[${reader.name}] ${newOnes.length} TAG(s) nuevo(s)`, "success");

          setReaderStates((prev) => {
            const cur = prev[reader.id] ?? DEFAULT_READER_STATE;
            
            // Protección contra Race Condition: 
            // Si el usuario desconectó el reader mientras esperábamos el API, abortamos
            if (cur.status === "disconnected" || cur.status === "error") {
              return prev;
            }

            return {
              ...prev,
              [reader.id]: {
                ...cur,
                tags: lista,
                newTagIds: newOnes.map((tg) => tg.tagid),
                scanCount: cur.scanCount + newOnes.length,
                lastUpdate: new Date().toLocaleTimeString("es-PE", { hour12: false }),
                status: "reading",
              },
            };
          });
        } catch (e: unknown) {
          log(`[${reader.name}] Error polling: ${(e as Error).message}`, "error");
        }
      })
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loop() {
      while (!cancelled && pollingRef.current) {
        await pollAllReaders();
        await new Promise((r) => setTimeout(r, 50));
      }
    }
    if (polling) {
      loop();
    } else {
      setReaderStates((prev) => {
        const next = { ...prev };
        let changed = false;
        Object.keys(next).forEach((id) => {
          if (next[id].status === "reading") { next[id] = { ...next[id], status: "connected" }; changed = true; }
        });
        return changed ? next : prev;
      });
    }
    return () => { cancelled = true; };
  }, [polling, pollAllReaders]);

  const startPolling = useCallback(() => {
    const anyConnected = readersRef.current.some((r) => {
      const s = readerStatesRef.current[r.id]?.status;
      return s === "connected" || s === "reading";
    });
    if (!anyConnected) { addLog("Conecta al menos un reader primero", "error"); return; }
    addLog("Lectura en tiempo real iniciada", "success");
    setPolling(true);
  }, [addLog]);

  const stopPolling = useCallback(async () => {
    setPolling(false);
    addLog("Lectura detenida", "info");
    const currentReaders = readersRef.current;
    const states = readerStatesRef.current;
    const { baseUrl, mockMode } = globalConfigRef.current;
    const t = tokenRef.current;
    const activeReaders = currentReaders.filter((r) => { const s = states[r.id]?.status; return s === "connected" || s === "reading"; });
    await Promise.all(activeReaders.map(async (reader) => {
      try { await rfidService.disconnect(baseUrl, t, reader.ip, mockMode); addLog(`${reader.name} desconectado`, "info"); } catch { /* ignorar */ }
    }));
    setReaderStates((prev) => {
      const next = { ...prev };
      activeReaders.forEach((r) => { if (next[r.id]) next[r.id] = { ...next[r.id], status: "disconnected" }; });
      return next;
    });
  }, [addLog]);

  // ── Derived ──
  const activeState = readerStates[activeReaderId] ?? DEFAULT_READER_STATE;
  const activeReader = readers.find((r) => r.id === activeReaderId);

  return (
    <AppContext.Provider value={{
      globalConfig, setGlobalConfig, token, setToken,
      logs, addLog, clearLogs,
      readers, loadingReaders, reloadReaders: loadReaders,
      readerStates, activeReaderId, setActiveReaderId, activeAntennaNum, setActiveAntennaNum,
      activeState, activeReader, updateReaderState, setReaderStates,
      handleConnect, handleDisconnect, handleTestReader, handleGenerateToken,
      polling, startPolling, stopPolling,
      readersRef, readerStatesRef, globalConfigRef, tokenRef,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

"use client";

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { rfidService } from "../services/rfidService";
import type {
  GlobalConfig,
  LogEntry,
  ReaderConfig,
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

function genId() {
  return `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
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
  readerStates: Record<string, ReaderRuntimeState>;
  activeReaderId: string;
  setActiveReaderId: (id: string) => void;
  activeAntennaNum: number | null;
  setActiveAntennaNum: (num: number | null) => void;
  activeState: ReaderRuntimeState;
  activeReader: ReaderConfig | undefined;
  updateReaderState: (id: string, updater: (prev: ReaderRuntimeState) => Partial<ReaderRuntimeState>) => void;
  setReaderStates: React.Dispatch<React.SetStateAction<Record<string, ReaderRuntimeState>>>;
  handleAddReader: () => void;
  handleRemoveReader: (id: string) => void;
  handleUpdateReader: (id: string, updates: Partial<ReaderConfig>) => void;
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
    baseUrl: "https://abc123.ngrok.io",
    dias: 1,
    mockMode: true,
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
  const [readers, setReaders] = useState<ReaderConfig[]>([
    {
      id: "r_default",
      name: "Reader 1",
      ip: "192.168.10.1",
      antenas: [
        { numero: 1, nombre: "Antena 1", potencia: 20 },
        { numero: 2, nombre: "Antena 2", potencia: 20 },
      ],
    },
  ]);
  const [readerStates, setReaderStates] = useState<Record<string, ReaderRuntimeState>>({});
  const [activeReaderId, setActiveReaderId] = useState("r_default");
  const [activeAntennaNum, setActiveAntennaNum] = useState<number | null>(null);

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

  // ── Reader CRUD ──

  const handleAddReader = useCallback(() => {
    const id = genId();
    const num = readersRef.current.length + 1;
    setReaders((prev) => [
      ...prev,
      { id, name: `Reader ${num}`, ip: "192.168.10.1", antenas: [{ numero: 1, nombre: "Antena 1", potencia: 20 }] },
    ]);
    setActiveReaderId(id);
    addLog(`Reader ${num} agregado`, "info");
  }, [addLog]);

  const handleRemoveReader = useCallback((id: string) => {
    setReaders((prev) => prev.filter((r) => r.id !== id));
    setReaderStates((prev) => { const next = { ...prev }; delete next[id]; return next; });
    setActiveReaderId((cur) => {
      if (cur === id) {
        const remaining = readersRef.current.filter((r) => r.id !== id);
        return remaining[0]?.id ?? "";
      }
      return cur;
    });
    addLog("Reader eliminado", "info");
  }, [addLog]);

  const handleUpdateReader = useCallback((id: string, updates: Partial<ReaderConfig>) => {
    setReaders((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  }, []);

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
      const maxPotencia = Math.max(...reader.antenas.map((a) => a.potencia));
      await rfidService.connect(cfg.baseUrl, tokenRef.current, reader.ip, maxPotencia, cfg.mockMode);
      updateReaderState(readerId, () => ({ status: "connected" }));
      addLog(`${reader.name} conectado`, "success");
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

  // ── Polling ──

  const [polling, setPolling] = useState(false);
  const pollingRef = useRef(false);
  useEffect(() => { pollingRef.current = polling; }, [polling]);

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
      readers, readerStates, activeReaderId, setActiveReaderId, activeAntennaNum, setActiveAntennaNum,
      activeState, activeReader, updateReaderState, setReaderStates,
      handleAddReader, handleRemoveReader, handleUpdateReader,
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

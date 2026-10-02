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

// ── Vencimiento del token ──
const TOKEN_KEY = "rfid_token";
const TOKEN_EXP_KEY = "rfid_token_exp";

/** Lee el `exp` del token si es un JWT; devuelve ms epoch o null. */
function jwtExpiration(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof json.exp === "number" ? json.exp * 1000 : null;
  } catch {
    return null;
  }
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
  const [globalConfig, setGlobalConfigState] = useState<GlobalConfig>({
    baseUrl: DEFAULT_BASE_URL,
    dias: 1,
    mockMode: false,
  });
  const [token, setTokenState] = useState("");
  // Momento (ms epoch) en que vence el token; null si no se conoce.
  const [tokenExpiresAt, setTokenExpiresAt] = useState<number | null>(null);
  // true cuando ya se leyó localStorage; hasta entonces no se consulta el backend
  // para no hacerlo sin token tras recargar la página.
  const [storageLoaded, setStorageLoaded] = useState(false);

  // Cargar config y token guardados al iniciar
  useEffect(() => {
    try {
      const savedConfig = localStorage.getItem("rfid_globalConfig");
      if (savedConfig) {
        // El modo simulación no se restaura: si quedó guardado en true, la app
        // mostraría los readers de prueba de mockApi en lugar de los reales.
        setGlobalConfigState({ ...JSON.parse(savedConfig), mockMode: false });
      }
      const savedToken = localStorage.getItem(TOKEN_KEY);
      if (savedToken) {
        const savedExp = Number(localStorage.getItem(TOKEN_EXP_KEY)) || jwtExpiration(savedToken);
        if (savedExp && savedExp <= Date.now()) {
          // Venció mientras la app estaba cerrada: se descarta
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(TOKEN_EXP_KEY);
        } else {
          setTokenState(savedToken);
          setTokenExpiresAt(savedExp || null);
        }
      }
    } catch { /* storage bloqueado o JSON inválido */ }
    setStorageLoaded(true);
  }, []);

  // Envolver setters para guardar siempre en localStorage
  const setGlobalConfig = useCallback((val: React.SetStateAction<GlobalConfig>) => {
    setGlobalConfigState((prev) => {
      const next = typeof val === "function" ? val(prev) : val;
      localStorage.setItem("rfid_globalConfig", JSON.stringify(next));
      return next;
    });
  }, []);

  const setToken = useCallback((val: React.SetStateAction<string>) => {
    setTokenState((prev) => {
      const next = typeof val === "function" ? val(prev) : val;
      try {
        if (next) localStorage.setItem(TOKEN_KEY, next);
        else localStorage.removeItem(TOKEN_KEY);
      } catch { /* storage bloqueado */ }
      return next;
    });
  }, []);

  /** Guarda el token junto con su vencimiento (null = sin vencimiento conocido). */
  const saveToken = useCallback((t: string, expiresAt: number | null) => {
    setToken(t);
    setTokenExpiresAt(t ? expiresAt : null);
    try {
      if (t && expiresAt) localStorage.setItem(TOKEN_EXP_KEY, String(expiresAt));
      else localStorage.removeItem(TOKEN_EXP_KEY);
    } catch { /* storage bloqueado */ }
  }, [setToken]);

  // ── Logs ──
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const addLog = useCallback((msg: string, type: LogEntry["type"] = "default") => {
    const time = new Date().toLocaleTimeString("es-PE", { hour12: false });
    setLogs((prev) => [{ msg, type, time }, ...prev].slice(0, 80));
  }, []);
  const clearLogs = useCallback(() => setLogs([]), []);
  const addLogRef = useRef(addLog);
  useEffect(() => { addLogRef.current = addLog; }, [addLog]);

  // Descarta el token cuando vence con la app abierta. Se revisa cada minuto
  // (en vez de un único setTimeout) para cubrir suspensión del equipo y
  // vencimientos lejanos que exceden el máximo de setTimeout.
  useEffect(() => {
    if (!token || !tokenExpiresAt) return;
    const check = () => {
      if (Date.now() >= tokenExpiresAt) {
        saveToken("", null);
        addLog("El token venció. Genera uno nuevo desde Configuración.", "error");
      }
    };
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [token, tokenExpiresAt, saveToken, addLog]);

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
          const instance: any = activeInstances.find((i: any) => (i.IP || i.ip) === r.ip);
          return instance && String(instance.Activo || instance.activo) === "1";
        });
        
        setReaderStates((prev) => {
          const next = { ...prev };
          mapped.forEach((r) => {
            const instance: any = activeInstances.find((i: any) => (i.IP || i.ip) === r.ip);
            
            if (instance) {
              const activoValue = String(instance.Activo || instance.activo);
              if (activoValue === "1") {
                next[r.id] = { ...(next[r.id] ?? DEFAULT_READER_STATE), status: "connected" };
              } else {
                next[r.id] = { ...(next[r.id] ?? DEFAULT_READER_STATE), status: "disconnected" };
              }
            } else if (activeInstances.length > 0) {
              // Solo marcamos desconectado si el backend respondió con datos pero este reader no está en la lista
              next[r.id] = { ...(next[r.id] ?? DEFAULT_READER_STATE), status: "disconnected" };
            }
            // Si activeInstances está vacío (sin token o sin datos), dejamos el status actual
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

  // Cargar al iniciar y cuando cambian modo / URL base.
  // IMPORTANTE: No dependemos de `token` directamente para evitar
  // doble llamada: primero con token="" (vacío) y después con el real.
  // En su lugar usamos tokenRef que siempre tiene el valor actualizado.
  useEffect(() => {
    if (storageLoaded) loadReaders();
  }, [loadReaders, storageLoaded, globalConfig.mockMode, globalConfig.baseUrl]);

  // ── Lecturas previas del reader seleccionado ──
  // Al cambiar de reader se consultan las lecturas que ya tiene el backend,
  // aunque el reader no esté conectado. Si está leyendo, el polling ya se encarga.
  const loadReaderReadings = useCallback(async (readerId: string) => {
    const reader = readersRef.current.find((r) => r.id === readerId);
    if (!reader) return;
    const { baseUrl, mockMode } = globalConfigRef.current;
    const t = tokenRef.current;
    if (!t && !mockMode) return;
    const s = readerStatesRef.current[readerId]?.status;
    if (s === "reading" || s === "connecting") return;
    try {
      const antenasNums = reader.antenas.map((a) => a.numero);
      const lista = await rfidService.listReadings(baseUrl, t, reader.ip, antenasNums, mockMode);
      setReaderStates((prev) => {
        const cur = prev[readerId] ?? DEFAULT_READER_STATE;
        // Si mientras tanto empezó a leer, manda el polling
        if (cur.status === "reading") return prev;
        return {
          ...prev,
          [readerId]: {
            ...cur,
            tags: lista,
            newTagIds: [],
            lastUpdate: new Date().toLocaleTimeString("es-PE", { hour12: false }),
          },
        };
      });
    } catch (e: unknown) {
      addLog(`[${reader.name}] Error cargando lecturas: ${(e as Error).message}`, "error");
    }
  }, [addLog]);

  useEffect(() => {
    if (activeReaderId) loadReaderReadings(activeReaderId);
  }, [activeReaderId, readers, token, loadReaderReadings]);

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

    // 1. Actualizar la UI inmediatamente a "desconectado" para que no parezca que está "colgado"
    updateReaderState(readerId, () => ({ status: "disconnected", tags: [], newTagIds: [], scanCount: 0, lastUpdate: null }));
    addLog(`${reader.name} desconectado (enviando orden al backend...)`, "info");
    
    // 2. Enviar la petición al backend en segundo plano (sin await) porque el hardware a veces demora 20 segundos en responder si está offline
    const cfg = globalConfigRef.current;
    rfidService.disconnect(cfg.baseUrl, tokenRef.current, reader.ip, cfg.mockMode)
      .then(() => addLog(`${reader.name}: Orden de apagado confirmada por el backend.`, "success"))
      .catch(() => { /* ignorar timeout del backend */ });
    
    
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
      // Preferimos el `exp` del propio token; si no es JWT, lo calculamos por días
      saveToken(t, jwtExpiration(t) ?? Date.now() + cfg.dias * 24 * 60 * 60 * 1000);
      addLog(`Token generado (${cfg.dias} día${cfg.dias !== 1 ? "s" : ""})`, "success");
    } catch (e: unknown) {
      addLog(`Error token: ${(e as Error).message}`, "error");
    }
  }, [addLog, saveToken]);

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

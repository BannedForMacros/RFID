"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Play, Square, Trash2, Settings, ClipboardList,
  Activity, RefreshCw, Zap, Clock, Wifi, WifiOff, X, Download, Loader2,
} from "lucide-react";

import { StatCard } from "../components/StatCard";
import { ConfigModal } from "../components/ConfigModal";
import Modal from "../components/Modal";
import { mockApi } from "../lib/mockApi";

import type {
  Tag,
  ReaderStatus,
  LogEntry,
  ReaderConfig,
  ReaderRuntimeState,
  AntennaStatus,
  GlobalConfig,
} from "../../types/rfid";

// ── Constantes ──────────────────────────────────────────────────────────────

const DEFAULT_READER_STATE: ReaderRuntimeState = {
  status: "disconnected",
  tags: [],
  newTagIds: [],
  scanCount: 0,
  lastUpdate: null,
  antenasState: {},
};

const ANT_DOT: Record<AntennaStatus, string> = {
  disconnected: "bg-slate-300",
  connecting:   "bg-yellow-400 animate-pulse",
  connected:    "bg-blue-500",
  reading:      "bg-emerald-500 animate-pulse",
};

const ANT_COLORS: Record<AntennaStatus, string> = {
  disconnected: "bg-slate-100 text-slate-500 border-slate-200",
  connecting:   "bg-yellow-50 text-yellow-600 border-yellow-200",
  connected:    "bg-blue-50 text-blue-600 border-blue-200",
  reading:      "bg-emerald-50 text-emerald-600 border-emerald-200",
};

const ANT_LABEL: Record<AntennaStatus, string> = {
  disconnected: "DESCONECTADA",
  connecting:   "CONECTANDO...",
  connected:    "CONECTADA",
  reading:      "LEYENDO",
};

const STATUS_DOT: Record<ReaderStatus, string> = {
  disconnected: "bg-slate-300",
  connecting:   "bg-yellow-400 animate-pulse",
  connected:    "bg-blue-500",
  reading:      "bg-emerald-500 animate-pulse",
  error:        "bg-red-500",
  testing:      "bg-violet-500 animate-pulse",
};

function genId() {
  return `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function RFIDMonitor() {

  // ── Config global ──
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig>({
    baseUrl: "https://abc123.ngrok.io",
    dias: 1,
    mockMode: true,
  });

  // ── Lista de readers ──
  const [readers, setReaders] = useState<ReaderConfig[]>([
    {
      id: "r_default",
      name: "Reader 1",
      ip: "192.168.1.100",
      antenas: [
        { numero: 1, nombre: "Antena 1", potencia: 20 },
        { numero: 2, nombre: "Antena 2", potencia: 20 },
      ],
    },
  ]);

  // ── Estado en tiempo real por reader { [id]: ReaderRuntimeState } ──
  const [readerStates, setReaderStates] = useState<Record<string, ReaderRuntimeState>>({});

  // ── Tab activa ──
  const [activeReaderId, setActiveReaderId] = useState<string>("r_default");

  // ── Token y control ──
  const [token, setToken] = useState("");
  const [polling, setPolling] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // ── Refs para evitar closures stale en el polling ──
  const readersRef = useRef(readers);
  const readerStatesRef = useRef(readerStates);
  const globalConfigRef = useRef(globalConfig);
  const tokenRef = useRef(token);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { readersRef.current = readers; },          [readers]);
  useEffect(() => { readerStatesRef.current = readerStates; }, [readerStates]);
  useEffect(() => { globalConfigRef.current = globalConfig; }, [globalConfig]);
  useEffect(() => { tokenRef.current = token; },              [token]);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const addLog = useCallback(
    (msg: string, type: LogEntry["type"] = "default") => {
      const time = new Date().toLocaleTimeString("es-PE", { hour12: false });
      setLogs((prev) => [{ msg, type, time }, ...prev].slice(0, 80));
    },
    []
  );
  const addLogRef = useRef(addLog);
  useEffect(() => { addLogRef.current = addLog; }, [addLog]);

  const updateReader = (
    id: string,
    updater: (prev: ReaderRuntimeState) => Partial<ReaderRuntimeState>
  ) => {
    setReaderStates((prev) => {
      const current = prev[id] ?? DEFAULT_READER_STATE;
      return { ...prev, [id]: { ...current, ...updater(current) } };
    });
  };

  const apiFetch = async (url: string, options: RequestInit = {}) => {
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
    return res.json();
  };

  // ── 1. Generar Token ──────────────────────────────────────────────────────

  const handleGenerateToken = async () => {
    try {
      addLog("Generando token...", "info");
      let t: string;
      if (globalConfig.mockMode) {
        t = await mockApi.generateToken(globalConfig.dias);
      } else {
        const url = `${globalConfig.baseUrl}/api/Rfid/generate-token?dias=${globalConfig.dias}`;
        const data = await apiFetch(url, { method: "POST" });
        t = data.token || data.access_token || JSON.stringify(data);
      }
      setToken(t);
      addLog(`✓ Token generado (${globalConfig.dias} día${globalConfig.dias !== 1 ? "s" : ""})`, "success");
    } catch (e: unknown) {
      addLog(`✗ Error token: ${(e as Error).message}`, "error");
    }
  };

  // ── 2. Conectar un reader ─────────────────────────────────────────────────

  const handleConnect = async (readerId: string) => {
    const reader = readersRef.current.find((r) => r.id === readerId);
    if (!reader) return;
    if (!tokenRef.current && !globalConfigRef.current.mockMode) {
      addLog("✗ Primero genera un token", "error");
      return;
    }
    updateReader(readerId, () => ({ status: "connecting" }));
    addLog(`Conectando a ${reader.name} (${reader.ip})...`, "info");
    try {
      if (globalConfig.mockMode) {
        await mockApi.connect(reader.ip);
      } else {
        await apiFetch(`${globalConfig.baseUrl}/api/Rfid/connect`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Auth-Token": token },
          body: JSON.stringify({
            ipreader: reader.ip,
            antenas: reader.antenas.map((a) => ({
              numero: a.numero,
              potenciaDbm: a.potencia,
            })),
          }),
        });
      }
      updateReader(readerId, () => ({ status: "connected" }));
      addLog(`✓ ${reader.name} conectado`, "success");
    } catch (e: unknown) {
      updateReader(readerId, () => ({ status: "error" }));
      addLog(`✗ Error conectando ${reader.name}: ${(e as Error).message}`, "error");
    }
  };

  // ── 3. Desconectar un reader ──────────────────────────────────────────────

  const handleDisconnect = async (readerId: string) => {
    const reader = readersRef.current.find((r) => r.id === readerId);
    if (!reader) return;
    try {
      if (globalConfig.mockMode) {
        await mockApi.disconnect(reader.ip);
      } else {
        await apiFetch(`${globalConfig.baseUrl}/api/Rfid/disconnect`, {
          method: "POST",
          headers: { "X-Auth-Token": token },
        });
      }
    } catch {
      // ignorar error al desconectar
    }
    updateReader(readerId, () => ({ status: "disconnected", tags: [] }));
    addLog(`✓ ${reader.name} desconectado`, "info");
  };

  // ── 4. Probar conexión ────────────────────────────────────────────────────

  const handleTestReader = async (
    readerId: string
  ): Promise<{ ok: boolean; latencyMs: number }> => {
    const reader = readersRef.current.find((r) => r.id === readerId);
    if (!reader) throw new Error("Reader no encontrado");
    addLog(`Probando comunicación con ${reader.name} (${reader.ip})...`, "info");
    try {
      let result: { ok: boolean; latencyMs: number };
      if (globalConfigRef.current.mockMode) {
        result = await mockApi.testConnection(reader.ip);
      } else {
        const start = Date.now();
        try {
          await fetch(globalConfigRef.current.baseUrl, {
            method: "HEAD",
            signal: AbortSignal.timeout(3000),
          });
          result = { ok: true, latencyMs: Date.now() - start };
        } catch {
          result = { ok: false, latencyMs: 0 };
        }
      }
      if (result.ok) {
        addLog(`✓ ${reader.name}: Comunicación OK (${result.latencyMs}ms)`, "success");
      } else {
        addLog(`✗ ${reader.name}: Sin respuesta`, "error");
      }
      return result;
    } catch (e: unknown) {
      addLog(`✗ Error probando ${reader.name}: ${(e as Error).message}`, "error");
      return { ok: false, latencyMs: 0 };
    }
  };

  // ── 5. Polling (todos los readers conectados) ─────────────────────────────

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
          let lista: Tag[];
          if (mockMode) {
            lista = await mockApi.listReadings(reader.ip);
          } else {
            const data = await apiFetch(`${baseUrl}/api/Rfid/listaActualizaLecturas`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "X-Auth-Token": t },
              body: JSON.stringify({ ope: 1, tagid: "", ipreader: reader.ip }),
            });
            lista = Array.isArray(data) ? data : data.lecturas ?? [];
          }

          // Detectar nuevos tags antes del setState
          const prevTags = readerStatesRef.current[reader.id]?.tags ?? [];
          const prevSet = new Set(prevTags.map((tg) => tg.tagid));
          const newOnes = lista.filter((tg) => !prevSet.has(tg.tagid));

          if (newOnes.length > 0) {
            log(`▶ [${reader.name}] ${newOnes.length} TAG(s) nuevo(s)`, "success");
          }

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
          log(`✗ [${reader.name}] Error polling: ${(e as Error).message}`, "error");
        }
      })
    );
  }, []); // usa refs → sin dependencias

  useEffect(() => {
    if (polling) {
      pollAllReaders();
      pollRef.current = setInterval(pollAllReaders, 2000);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
      // Readers que estaban leyendo pasan a "connected"
      setReaderStates((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((id) => {
          if (next[id].status === "reading") {
            next[id] = { ...next[id], status: "connected" };
          }
        });
        return next;
      });
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [polling, pollAllReaders]);

  const togglePolling = () => {
    const anyConnected = readers.some((r) => {
      const s = readerStates[r.id]?.status;
      return s === "connected" || s === "reading";
    });
    if (!anyConnected) {
      addLog("✗ Conecta al menos un reader antes de iniciar lectura", "error");
      return;
    }
    setPolling((p) => {
      addLog(!p ? "▶ Lectura iniciada (intervalo 2s)" : "⏸ Lectura pausada", !p ? "success" : "info");
      return !p;
    });
  };

  // ── 6. Limpiar vista del reader activo ────────────────────────────────────

  const handleClearView = useCallback(async () => {
    const reader = readersRef.current.find((r) => r.id === activeReaderId);
    if (!reader) return;
    try {
      if (globalConfigRef.current.mockMode) {
        await mockApi.clearReadings(reader.ip);
      } else if (tokenRef.current) {
        await apiFetch(`${globalConfigRef.current.baseUrl}/api/Rfid/listaActualizaLecturas`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Auth-Token": tokenRef.current },
          body: JSON.stringify({ ope: 3, tagid: "", ipreader: reader.ip }),
        });
      }
    } catch {
      // ignorar
    }
    updateReader(activeReaderId, () => ({ tags: [], newTagIds: [], scanCount: 0 }));
    addLog(`Lista de ${reader.name} limpiada`, "info");
  }, [activeReaderId, addLog]);

  // ── 7. Descargar CSV ──────────────────────────────────────────────────────

  const handleDownloadCSV = useCallback(() => {
    const activeTags = readerStates[activeReaderId]?.tags ?? [];
    if (activeTags.length === 0) { addLog("✗ No hay datos para descargar", "error"); return; }

    const fmt = (d: string) =>
      d ? new Date(d).toLocaleString("es-PE", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) : "—";

    const headers = ["#", "EPC / TAG ID", "Contador", "Hora Inicio", "Hora Fin", "IP Reader"];
    const rows = activeTags.map((tag, idx) =>
      [idx + 1, tag.tagid, tag.contador, fmt(tag.fecini), fmt(tag.fecfin), tag.ipreader]
        .map((c) => `"${c}"`)
        .join(",")
    );
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `lecturas_rfid_${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addLog(`✓ ${activeTags.length} registros descargados en CSV`, "success");
  }, [readerStates, activeReaderId, addLog]);

  // ── 8. Descargar TXT ──────────────────────────────────────────────────────

  const handleDownloadTXT = useCallback(() => {
    const activeTags = readerStates[activeReaderId]?.tags ?? [];
    if (activeTags.length === 0) { addLog("✗ No hay datos para descargar", "error"); return; }

    const fmt = (d: string) =>
      d ? new Date(d).toLocaleString("es-PE", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) : "—";

    const lines = activeTags.map((tag, idx) =>
      `${idx + 1}\t${tag.tagid}\t${tag.contador}\t${fmt(tag.fecini)}\t${fmt(tag.fecfin)}\t${tag.ipreader}`
    );
    const blob = new Blob(
      [["#\tEPC / TAG ID\tContador\tHora Inicio\tHora Fin\tIP Reader", ...lines].join("\n")],
      { type: "text/plain;charset=utf-8;" }
    );
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `lecturas_rfid_${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addLog(`✓ ${activeTags.length} registros descargados en TXT`, "success");
  }, [readerStates, activeReaderId, addLog]);

  // ── 9. CRUD de readers ────────────────────────────────────────────────────

  const handleAddReader = () => {
    const id = genId();
    const num = readers.length + 1;
    setReaders((prev) => [
      ...prev,
      {
        id,
        name: `Reader ${num}`,
        ip: "192.168.1.100",
        antenas: [{ numero: 1, nombre: "Antena 1", potencia: 20 }],
      },
    ]);
    setActiveReaderId(id);
    addLog(`Reader ${num} agregado`, "info");
  };

  const handleRemoveReader = (id: string) => {
    setReaders((prev) => prev.filter((r) => r.id !== id));
    setReaderStates((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (activeReaderId === id) {
      const remaining = readers.filter((r) => r.id !== id);
      setActiveReaderId(remaining[0]?.id ?? "");
    }
    addLog("Reader eliminado", "info");
  };

  const handleUpdateReader = (id: string, updates: Partial<ReaderConfig>) => {
    setReaders((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  };

  // ── 10. Control por antena ────────────────────────────────────────────────

  const setAntennaStatus = (readerId: string, antNum: number, status: AntennaStatus) => {
    setReaderStates((prev) => {
      const cur = prev[readerId] ?? DEFAULT_READER_STATE;
      const newAnt = { ...cur.antenasState, [antNum]: { status } };
      // Derivar estado del reader desde las antenas
      const antVals = Object.values(newAnt);
      let readerStatus: ReaderRuntimeState["status"] = cur.status;
      if (antVals.some((a) => a.status === "reading"))        readerStatus = "reading";
      else if (antVals.some((a) => a.status === "connected" || a.status === "connecting")) readerStatus = "connected";
      else if (antVals.every((a) => a.status === "disconnected")) readerStatus = "disconnected";
      return { ...prev, [readerId]: { ...cur, antenasState: newAnt, status: readerStatus } };
    });
  };

  const handleConnectAntenna = async (readerId: string, antNum: number) => {
    const reader = readersRef.current.find((r) => r.id === readerId);
    const ant = reader?.antenas.find((a) => a.numero === antNum);
    if (!reader || !ant) return;
    setAntennaStatus(readerId, antNum, "connecting");
    addLog(`Conectando Antena ${antNum} — ${ant.nombre}...`, "info");
    try {
      if (globalConfigRef.current.mockMode) {
        await mockApi.connect(reader.ip);
      } else {
        await apiFetch(`${globalConfigRef.current.baseUrl}/api/Rfid/connect`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Auth-Token": tokenRef.current },
          body: JSON.stringify({ ipreader: reader.ip, antena: antNum, potenciaDbm: ant.potencia }),
        });
      }
      setAntennaStatus(readerId, antNum, "connected");
      addLog(`✓ Antena ${antNum} — ${ant.nombre} conectada`, "success");
    } catch (e: unknown) {
      setAntennaStatus(readerId, antNum, "disconnected");
      addLog(`✗ Error antena ${antNum}: ${(e as Error).message}`, "error");
    }
  };

  const handleDisconnectAntenna = async (readerId: string, antNum: number) => {
    const reader = readersRef.current.find((r) => r.id === readerId);
    const ant = reader?.antenas.find((a) => a.numero === antNum);
    if (!reader || !ant) return;
    try {
      if (!globalConfigRef.current.mockMode) {
        await apiFetch(`${globalConfigRef.current.baseUrl}/api/Rfid/disconnect`, {
          method: "POST",
          headers: { "X-Auth-Token": tokenRef.current },
          body: JSON.stringify({ ipreader: reader.ip, antena: antNum }),
        });
      }
    } catch { /* ignorar */ }
    setAntennaStatus(readerId, antNum, "disconnected");
    addLog(`Antena ${antNum} — ${ant.nombre} desconectada`, "info");
  };

  const handleStartAntenna = (readerId: string, antNum: number) => {
    const reader = readersRef.current.find((r) => r.id === readerId);
    const ant = reader?.antenas.find((a) => a.numero === antNum);
    if (!ant) return;
    setAntennaStatus(readerId, antNum, "reading");
    if (!polling) setPolling(true);
    addLog(`▶ Antena ${antNum} — ${ant.nombre} iniciando lectura`, "success");
  };

  const handleStopAntenna = (readerId: string, antNum: number) => {
    const reader = readersRef.current.find((r) => r.id === readerId);
    const ant = reader?.antenas.find((a) => a.numero === antNum);
    if (!ant) return;
    setAntennaStatus(readerId, antNum, "connected");
    addLog(`⏸ Antena ${antNum} — ${ant.nombre} detenida`, "info");
  };

  // ── Datos del tab activo ──────────────────────────────────────────────────

  const activeState = readerStates[activeReaderId] ?? DEFAULT_READER_STATE;
  const activeTags  = activeState.tags;

  // Stats globales
  const totalTags   = Object.values(readerStates).reduce((sum, s) => sum + s.tags.length, 0);
  const totalNew    = Object.values(readerStates).reduce((sum, s) => sum + s.scanCount, 0);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a]">

      {/* NAVBAR */}
      <nav className="bg-gradient-to-r from-[#003366] to-[#1e4786] text-white px-8 h-16 flex items-center justify-between shadow-lg sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-[#22c4a1]/20 p-2 rounded-lg border border-[#22c4a1]/50">
            <Activity size={20} className="text-[#22c4a1]" />
          </div>
          <div>
            <h1 className="font-extrabold text-lg tracking-tight">RFID MONITOR</h1>
            <p className="text-[10px] text-[#22c4a1] font-mono tracking-widest">
              DBPERU · REAL TIME · {readers.length} READER{readers.length !== 1 ? "S" : ""}
              {globalConfig.mockMode && " · SIMULACIÓN"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsLogOpen(true)}
            className="p-2 hover:bg-white/10 rounded-full transition-colors relative"
          >
            <ClipboardList size={22} />
            {logs.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-500 rounded-full border border-[#1e4786]" />
            )}
          </button>
          <button
            onClick={() => setIsConfigOpen(true)}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <Settings size={22} />
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 lg:p-8 space-y-6">

        {/* STATS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="TAGs Detectados (total)" value={totalTags}               icon={Activity}   color="#1e4786" />
          <StatCard label="Nuevos (Sesión)"          value={totalNew}                icon={RefreshCw}  color="#22c4a1" />
          <StatCard label="Intervalo"                value="2.0s"                    icon={Clock}      color="#64748b" />
          <StatCard label="Última Sinc"              value={activeState.lastUpdate ?? "--:--"} icon={Zap} color="#f59e0b" />
        </div>

        {/* CONTROLES */}
        <div className="flex flex-col md:flex-row gap-4">
          <button
            onClick={togglePolling}
            className={`flex-[2] py-4 rounded-2xl font-black text-white flex items-center justify-center gap-3 transition-all shadow-lg active:scale-[0.98] ${
              polling
                ? "bg-red-500 shadow-red-200"
                : "bg-[#22c4a1] shadow-emerald-100 hover:brightness-105"
            }`}
          >
            {polling
              ? <><Square fill="white" size={20} /> DETENER LECTURA</>
              : <><Play fill="white" size={20} /> INICIAR LECTURA EN VIVO</>}
          </button>
          <button
            onClick={handleClearView}
            className="flex-1 bg-white border-2 border-slate-200 rounded-2xl font-bold text-slate-500 flex items-center justify-center gap-2 hover:bg-slate-50 transition-all"
          >
            <Trash2 size={20} /> LIMPIAR VISTA
          </button>
        </div>

        {/* TABLA CON TABS DE READERS */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">

          {/* ── TABS ── */}
          <div className="flex items-end gap-0 border-b border-slate-200 px-4 pt-4 overflow-x-auto">
            {readers.map((reader) => {
              const st = readerStates[reader.id]?.status ?? "disconnected";
              const count = readerStates[reader.id]?.tags.length ?? 0;
              const isActive = reader.id === activeReaderId;
              return (
                <button
                  key={reader.id}
                  onClick={() => setActiveReaderId(reader.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-all -mb-px ${
                    isActive
                      ? "border-[#1e4786] text-[#1e4786] bg-white"
                      : "border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[st]}`} />
                  <span>{reader.name}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{reader.ip}</span>
                  {count > 0 && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        isActive
                          ? "bg-[#1e4786] text-white"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}

            {readers.length === 0 && (
              <span className="px-4 py-2.5 text-sm text-slate-400 italic">
                Sin readers — abre Configuración para agregar
              </span>
            )}
          </div>

          {/* ── PANEL DE ANTENAS ── */}
          {(() => {
            const activeReader = readers.find((r) => r.id === activeReaderId);
            if (!activeReader || activeReader.antenas.length === 0) return null;
            return (
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/40">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">
                  Antenas — {activeReader.name}
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {activeReader.antenas.map((ant) => {
                    const antStatus = activeState.antenasState[ant.numero]?.status ?? "disconnected";
                    const isConn    = antStatus === "connected" || antStatus === "reading";
                    const isReading = antStatus === "reading";
                    const isBusy    = antStatus === "connecting";
                    return (
                      <div
                        key={ant.numero}
                        className="shrink-0 border border-slate-200 rounded-xl p-3 bg-white min-w-[190px] space-y-2 shadow-sm"
                      >
                        {/* Nombre y número */}
                        <div className="flex items-start gap-2">
                          <span className={`w-2 h-2 rounded-full shrink-0 mt-1 ${ANT_DOT[antStatus]}`} />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-700 leading-tight truncate">{ant.nombre}</p>
                            <p className="text-[10px] text-slate-400">Ant. #{ant.numero} · {ant.potencia} dBm</p>
                          </div>
                        </div>

                        {/* Badge estado */}
                        <div className={`text-[9px] font-bold px-2 py-0.5 rounded-full border text-center ${ANT_COLORS[antStatus]}`}>
                          {ANT_LABEL[antStatus]}
                        </div>

                        {/* Botones */}
                        <div className="flex gap-1.5">
                          {/* Conectar / Desconectar */}
                          {!isConn ? (
                            <button
                              onClick={() => handleConnectAntenna(activeReaderId, ant.numero)}
                              disabled={isBusy || (!token && !globalConfig.mockMode)}
                              className="flex-1 flex items-center justify-center gap-1 bg-[#22c4a1] text-white text-[10px] font-bold py-1.5 rounded-lg hover:brightness-105 disabled:opacity-50 transition-all"
                            >
                              {isBusy
                                ? <Loader2 size={10} className="animate-spin" />
                                : <Wifi size={10} />}
                              {isBusy ? "..." : "Conectar"}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleDisconnectAntenna(activeReaderId, ant.numero)}
                              disabled={isReading}
                              className="flex-1 flex items-center justify-center gap-1 border border-red-200 text-red-500 text-[10px] font-bold py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-40 transition-all"
                            >
                              <WifiOff size={10} /> Desconectar
                            </button>
                          )}

                          {/* Iniciar / Detener */}
                          {isConn && (
                            !isReading ? (
                              <button
                                onClick={() => handleStartAntenna(activeReaderId, ant.numero)}
                                className="flex-1 flex items-center justify-center gap-1 bg-[#1e4786] text-white text-[10px] font-bold py-1.5 rounded-lg hover:brightness-105 transition-all"
                              >
                                <Play size={10} fill="white" /> Iniciar
                              </button>
                            ) : (
                              <button
                                onClick={() => handleStopAntenna(activeReaderId, ant.numero)}
                                className="flex-1 flex items-center justify-center gap-1 bg-red-500 text-white text-[10px] font-bold py-1.5 rounded-lg hover:brightness-105 transition-all"
                              >
                                <Square size={10} fill="white" /> Detener
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* ── HEADER DE TABLA ── */}
          <div className="px-8 py-4 bg-slate-50/50 flex justify-between items-center flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-bold text-slate-700 flex items-center gap-2">
                🏷 Lecturas —{" "}
                <span className="text-[#1e4786]">
                  {readers.find((r) => r.id === activeReaderId)?.name ?? "—"}
                </span>
              </h2>
              <div
                className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${
                  activeState.status === "reading"
                    ? "bg-emerald-50 text-emerald-600 border-emerald-200 animate-pulse"
                    : "bg-slate-100 text-slate-500 border-slate-200"
                }`}
              >
                {activeState.status.toUpperCase()}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadCSV}
                disabled={activeTags.length === 0}
                className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-100 disabled:opacity-40 transition-all"
              >
                <Download size={13} /> CSV
              </button>
              <button
                onClick={handleDownloadTXT}
                disabled={activeTags.length === 0}
                className="flex items-center gap-1.5 bg-violet-50 border border-violet-200 text-violet-600 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-violet-100 disabled:opacity-40 transition-all"
              >
                <Download size={13} /> TXT
              </button>
              <button
                onClick={handleClearView}
                className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-500 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-all"
              >
                <Trash2 size={13} /> Limpiar
              </button>
            </div>
          </div>

          {/* ── TABLA ── */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[11px] uppercase tracking-widest text-slate-400 font-bold">
                  <th className="px-8 py-4">#</th>
                  <th className="px-8 py-4">EPC / TAG ID</th>
                  <th className="px-8 py-4 text-center">Contador</th>
                  <th className="px-8 py-4">Hora Inicio</th>
                  <th className="px-8 py-4">Hora Fin</th>
                  <th className="px-8 py-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {activeTags.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-20 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2 opacity-40">
                        <WifiOff size={40} />
                        <p className="font-medium">
                          {activeState.status === "disconnected"
                            ? "Reader desconectado — conecta desde Configuración"
                            : "Esperando lecturas..."}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  activeTags.map((tag, idx) => {
                    const isNew = activeState.newTagIds.includes(tag.tagid);
                    return (
                      <tr
                        key={tag.tagid}
                        className={`group transition-colors ${
                          isNew ? "bg-emerald-50/30" : "hover:bg-slate-50/50"
                        }`}
                      >
                        <td className="px-8 py-4 text-xs font-mono text-slate-400">{idx + 1}</td>
                        <td className="px-8 py-4">
                          <span
                            className={`font-mono font-bold text-sm ${
                              isNew ? "text-emerald-600" : "text-[#1e4786]"
                            }`}
                          >
                            {tag.tagid}
                          </span>
                          {isNew && (
                            <span className="ml-2 text-[9px] bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.5 rounded-full uppercase">
                              nuevo
                            </span>
                          )}
                        </td>
                        <td className="px-8 py-4 text-center">
                          <span className="font-mono font-bold text-sm text-slate-600">
                            {tag.contador ?? "—"}
                          </span>
                        </td>
                        <td className="px-8 py-4 text-xs font-mono text-slate-500">
                          {tag.fecini
                            ? new Date(tag.fecini).toLocaleString("es-PE", {
                                year: "numeric", month: "2-digit", day: "2-digit",
                                hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
                              })
                            : "—"}
                        </td>
                        <td className="px-8 py-4 text-xs font-mono text-slate-500">
                          {tag.fecfin
                            ? new Date(tag.fecfin).toLocaleString("es-PE", {
                                year: "numeric", month: "2-digit", day: "2-digit",
                                hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
                              })
                            : "—"}
                        </td>
                        <td className="px-8 py-4 text-center">
                          <button className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                            <X size={18} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* MODAL DE CONFIGURACIÓN */}
      <ConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        globalConfig={globalConfig}
        setGlobalConfig={setGlobalConfig}
        readers={readers}
        readerStates={readerStates}
        onGenerateToken={handleGenerateToken}
        onAddReader={handleAddReader}
        onRemoveReader={handleRemoveReader}
        onUpdateReader={handleUpdateReader}
        onTestReader={handleTestReader}
        token={token}
      />

      {/* MODAL DE LOGS */}
      <Modal isOpen={isLogOpen} onClose={() => setIsLogOpen(false)} title="Log de Eventos">
        <div className="bg-[#0f172a] rounded-xl p-4 h-80 overflow-y-auto font-mono text-[11px] space-y-1.5 border border-slate-800 shadow-inner">
          {logs.length === 0 && (
            <p className="text-slate-600 italic">— Sin eventos —</p>
          )}
          {logs.map((log, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-slate-500 shrink-0">[{log.time}]</span>
              <span
                className={
                  log.type === "error"   ? "text-red-400"    :
                  log.type === "success" ? "text-[#22c4a1]"  :
                  log.type === "info"    ? "text-blue-400"   : "text-slate-400"
                }
              >
                {log.msg}
              </span>
            </div>
          ))}
        </div>
      </Modal>

      <footer className="py-8 text-center text-slate-400 text-[10px] font-mono tracking-[0.2em] uppercase">
        DBPERU RFID Systems · v2.0
      </footer>
    </div>
  );
}

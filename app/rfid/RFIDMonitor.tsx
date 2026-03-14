"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Play, Square, Trash2, Settings, ClipboardList,
  Activity, RefreshCw, Zap, Clock, WifiOff, X, Download
} from "lucide-react";

// Importación de tus componentes estandarizados
import { StatCard } from "../components/StatCard";
import { ConfigModal } from "../components/ConfigModal";
import Modal from "../components/Modal";

// Importación de tipos
import { Tag, ReaderStatus, LogEntry } from "../../types/rfid";

export default function RFIDMonitor() {
  // ── Configuración (Mismos estados que el original) ──
  const [config, setConfig] = useState({
    baseUrl: "https://abc123.ngrok.io",
    dias: 1,
    ipReader: "192.168.1.100",
    potencia: 20,
    tLectura: 10,
  });

  const [token, setToken] = useState("");
  
  // ── Estados de Interfaz y Control ──
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [status, setStatus] = useState<ReaderStatus>("disconnected");
  const [tags, setTags] = useState<Tag[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [polling, setPolling] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [newTagIds, setNewTagIds] = useState<Set<string | number>>(new Set());

  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // ── Helper: Log (Identico a tu lógica) ──
  const addLog = useCallback((msg: string, type: LogEntry["type"] = "default") => {
    const time = new Date().toLocaleTimeString("es-PE", { hour12: false });
    setLogs(prev => [{ msg, type, time }, ...prev].slice(0, 80));
  }, []);

  // ── Fetch Helper ──
  const apiFetch = async (url: string, options: any = {}) => {
    const res = await fetch(url, {
      ...options,
      headers: {
        "ngrok-skip-browser-warning": "true",
        ...options.headers,
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    return res.json();
  };

  // ── 1. Generar Token ──
  const handleGenerateToken = async () => {
    try {
      addLog("Generando token...", "info");
      const url = `${config.baseUrl}/api/Rfid/generate-token?dias=${config.dias}`;
      const data = await apiFetch(url, { method: "POST" });
      const t = data.token || data.access_token || JSON.stringify(data);
      setToken(t);
      addLog(`✓ Token generado (${config.dias} días)`, "success");
    } catch (e: any) {
      addLog(`✗ Error token: ${e.message}`, "error");
    }
  };

  // ── 2. Conectar Reader ──
  const handleConnect = async () => {
    if (!token) return addLog("✗ Primero genera un token", "error");
    setStatus("connecting");
    try {
      addLog(`Conectando a reader ${config.ipReader}...`, "info");
      await apiFetch(`${config.baseUrl}/api/Rfid/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Auth-Token": token },
        body: JSON.stringify({ 
          ipreader: config.ipReader, 
          potenciaDbm: Number(config.potencia), 
          tlectura: Number(config.tLectura) 
        }),
      });
      setStatus("connected");
      addLog(`✓ Conectado a ${config.ipReader}`, "success");
    } catch (e: any) {
      setStatus("error");
      addLog(`✗ Error conectando: ${e.message}`, "error");
    }
  };

  // ── 3. Desconectar Reader ──
  const handleDisconnect = async () => {
    setPolling(false);
    try {
      await apiFetch(`${config.baseUrl}/api/Rfid/disconnect`, {
        method: "POST",
        headers: { "X-Auth-Token": token },
      });
      setStatus("disconnected");
      setTags([]);
      addLog("✓ Reader desconectado correctamente", "info");
    } catch (e: any) {
      setStatus("disconnected");
      addLog(`Desconectado (${e.message})`, "info");
    }
  };

  // ── 4. Polling de lecturas ──
  const fetchTags = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch(`${config.baseUrl}/api/Rfid/listaActualizaLecturas`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Auth-Token": token },
        body: JSON.stringify({ ope: 1, tagid: "", ipreader: config.ipReader }),
      });

      const lista: Tag[] = Array.isArray(data) ? data : (data.lecturas || []);

      setTags(prev => {
        const prevIds = new Set(prev.map(t => t.tagid));
        const incomingIds = new Set(lista.map(t => t.tagid));
        const newOnes = new Set([...incomingIds].filter(x => !prevIds.has(x)));
        
        if (newOnes.size > 0) {
          setNewTagIds(newOnes);
          setScanCount(c => c + newOnes.size);
          addLog(`▶ ${newOnes.size} TAG(s) detectado(s)`, "success");
        }
        return lista;
      });

      setLastUpdate(new Date().toLocaleTimeString("es-PE", { hour12: false }));
      setStatus("reading");
    } catch (e: any) {
      addLog(`✗ Error polling: ${e.message}`, "error");
    }
  }, [config.baseUrl, config.ipReader, token, addLog]);

  useEffect(() => {
    if (polling) {
      fetchTags();
      pollRef.current = setInterval(fetchTags, 2000);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
      if (status === "reading") setStatus("connected");
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [polling, fetchTags, status]);

  const togglePolling = () => {
    if (!token) return addLog("✗ Primero genera token y conecta", "error");
    setPolling(!polling);
    addLog(polling ? "⏸ Lectura pausada" : "▶ Lectura iniciada (2s)", polling ? "info" : "success");
  };

  // ── 5. Limpiar vista (ope: 3) ──
  const handleClearView = useCallback(async () => {
    try {
      if (token) {
        await apiFetch(`${config.baseUrl}/api/Rfid/listaActualizaLecturas`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Auth-Token": token },
          body: JSON.stringify({ ope: 3, tagid: "", ipreader: config.ipReader }),
        });
      }
      setTags([]);
      setScanCount(0);
      addLog("Lista limpiada", "info");
    } catch (e: any) {
      addLog(`✗ Error al limpiar: ${e.message}`, "error");
    }
  }, [config.baseUrl, config.ipReader, token, addLog]);

  // ── 6. Descargar datos en CSV ──
  const handleDownloadCSV = useCallback(() => {
    if (tags.length === 0) {
      addLog("✗ No hay datos para descargar", "error");
      return;
    }

    const headers = ["#", "EPC / TAG ID", "Contador", "Hora Inicio", "Hora Fin", "IP Reader"];
    const rows = tags.map((tag, idx) => [
      idx + 1,
      tag.tagid,
      tag.contador,
      tag.fecini ? new Date(tag.fecini).toLocaleString("es-PE", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) : "—",
      tag.fecfin ? new Date(tag.fecfin).toLocaleString("es-PE", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) : "—",
      tag.ipreader
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute("download", `lecturas_rfid_${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.csv`);
    link.style.visibility = "hidden";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addLog(`✓ ${tags.length} registros descargados en CSV`, "success");
  }, [tags, addLog]);

  // ── 7. Descargar datos en TXT ──
  const handleDownloadTXT = useCallback(() => {
    if (tags.length === 0) {
      addLog("✗ No hay datos para descargar", "error");
      return;
    }

    const lines = tags.map((tag, idx) => {
      const ini = tag.fecini ? new Date(tag.fecini).toLocaleString("es-PE", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) : "—";
      const fin = tag.fecfin ? new Date(tag.fecfin).toLocaleString("es-PE", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) : "—";
      return `${idx + 1}\t${tag.tagid}\t${tag.contador}\t${ini}\t${fin}\t${tag.ipreader}`;
    });

    const txtContent = ["#\tEPC / TAG ID\tContador\tHora Inicio\tHora Fin\tIP Reader", ...lines].join("\n");

    const blob = new Blob([txtContent], { type: "text/plain;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute("download", `lecturas_rfid_${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.txt`);
    link.style.visibility = "hidden";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addLog(`✓ ${tags.length} registros descargados en TXT`, "success");
  }, [tags, addLog]);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a]">
      
      {/* ── NAVBAR DBPERU ── */}
      <nav className="bg-gradient-to-r from-[#003366] to-[#1e4786] text-white px-8 h-16 flex items-center justify-between shadow-lg sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="bg-[#22c4a1]/20 p-2 rounded-lg border border-[#22c4a1]/50">
            <Activity size={20} className="text-[#22c4a1]" />
          </div>
          <div>
            <h1 className="font-extrabold text-lg tracking-tight">RFID MONITOR</h1>
            <p className="text-[10px] text-[#22c4a1] font-mono tracking-widest">DBPERU · REAL TIME</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsLogOpen(true)}
            className="p-2 hover:bg-white/10 rounded-full transition-colors relative"
          >
            <ClipboardList size={22} />
            {logs.length > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-500 rounded-full border border-[#1e4786]" />}
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
        
        {/* ── STATS (Usando StatCard.tsx) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="TAGs Detectados" value={tags.length} icon={Activity} color="#1e4786" />
          <StatCard label="Nuevos (Sesión)" value={scanCount} icon={RefreshCw} color="#22c4a1" />
          <StatCard label="Intervalo" value="2.0s" icon={Clock} color="#64748b" />
          <StatCard label="Última Sinc" value={lastUpdate || "--:--"} icon={Zap} color="#f59e0b" />
        </div>

        {/* ── CONTROLES ── */}
        <div className="flex flex-col md:flex-row gap-4">
          <button 
            onClick={togglePolling}
            disabled={status === "disconnected" || status === "error"}
            className={`flex-[2] py-4 rounded-2xl font-black text-white flex items-center justify-center gap-3 transition-all shadow-lg active:scale-[0.98] disabled:opacity-40 ${
              polling ? 'bg-red-500 shadow-red-200' : 'bg-[#22c4a1] shadow-emerald-100 hover:brightness-105'
            }`}
          >
            {polling ? <><Square fill="white" size={20} /> DETENER LECTURA</> : <><Play fill="white" size={20} /> INICIAR LECTURA EN VIVO</>}
          </button>
          
          <button
            onClick={handleClearView}
            className="flex-1 bg-white border-2 border-slate-200 rounded-2xl font-bold text-slate-500 flex items-center justify-center gap-2 hover:bg-slate-50 transition-all"
          >
            <Trash2 size={20} /> LIMPIAR VISTA
          </button>
        </div>

        {/* ── TABLA DE DATOS ── */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-8 py-5 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
            <h2 className="font-bold text-slate-700 flex items-center gap-2">🏷 Lecturas de Antena</h2>
            <div className="flex items-center gap-2">
              <div className={`px-3 py-1 rounded-full text-[10px] font-bold border ${
                status === 'reading' ? 'bg-emerald-50 text-emerald-600 border-emerald-200 animate-pulse' : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}>
                {status.toUpperCase()}
              </div>
              <button
                onClick={handleDownloadCSV}
                disabled={tags.length === 0}
                className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-100 disabled:opacity-40 transition-all"
              >
                <Download size={14} /> Descargar CSV
              </button>
              <button
                onClick={handleDownloadTXT}
                disabled={tags.length === 0}
                className="flex items-center gap-2 bg-violet-50 border border-violet-200 text-violet-600 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-violet-100 disabled:opacity-40 transition-all"
              >
                <Download size={14} /> Descargar TXT
              </button>
              <button
                onClick={handleClearView}
                className="flex items-center gap-2 bg-white border border-slate-200 text-slate-500 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-all"
              >
                <Trash2 size={14} /> Limpiar
              </button>
            </div>
          </div>

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
                {tags.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-20 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2 opacity-40">
                        <WifiOff size={40} />
                        <p className="font-medium">Esperando lecturas del reader...</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  tags.map((tag, idx) => {
                    const id = tag.tagid;
                    const isNew = newTagIds.has(id);
                    return (
                      <tr key={id} className={`group transition-colors ${isNew ? 'bg-emerald-50/30' : 'hover:bg-slate-50/50'}`}>
                        <td className="px-8 py-4 text-xs font-mono text-slate-400">{idx + 1}</td>
                        <td className="px-8 py-4">
                          <span className={`font-mono font-bold text-sm ${isNew ? 'text-emerald-600' : 'text-[#1e4786]'}`}>
                            {id}
                          </span>
                        </td>
                        <td className="px-8 py-4 text-center">
                          <span className="font-mono font-bold text-sm text-slate-600">{tag.contador ?? "—"}</span>
                        </td>
                        <td className="px-8 py-4 text-xs font-mono text-slate-500">
                          {tag.fecini ? new Date(tag.fecini).toLocaleString("es-PE", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) : "—"}
                        </td>
                        <td className="px-8 py-4 text-xs font-mono text-slate-500">
                          {tag.fecfin ? new Date(tag.fecfin).toLocaleString("es-PE", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) : "—"}
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

      {/* ── MODAL DE CONFIGURACIÓN ── */}
      <ConfigModal 
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        config={config}
        setConfig={setConfig}
        onGenerateToken={handleGenerateToken}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        status={status}
        token={token}
      />

      {/* ── MODAL DE LOGS ── */}
      <Modal isOpen={isLogOpen} onClose={() => setIsLogOpen(false)} title="Log de Eventos">
        <div className="bg-[#0f172a] rounded-xl p-4 h-80 overflow-y-auto font-mono text-[11px] space-y-1.5 border border-slate-800 shadow-inner">
          {logs.length === 0 && <p className="text-slate-600 italic">— Sin eventos —</p>}
          {logs.map((log, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-slate-500 shrink-0">[{log.time}]</span>
              <span className={
                log.type === "error" ? "text-red-400" : 
                log.type === "success" ? "text-[#22c4a1]" : 
                log.type === "info" ? "text-blue-400" : "text-slate-400"
              }>
                {log.msg}
              </span>
            </div>
          ))}
        </div>
      </Modal>

      <footer className="py-8 text-center text-slate-400 text-[10px] font-mono tracking-[0.2em] uppercase">
        DBPERU RFID Systems · v1.0
      </footer>
    </div>
  );
}
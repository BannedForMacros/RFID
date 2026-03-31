"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  CheckSquare,
  Play,
  Square,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  BarChart3,
  Tag,
  Search,
  Radio,
  Ban,
  Trash2,
} from "lucide-react";

import { Navbar } from "../components/rfid/Navbar";
import { LogModal } from "../components/rfid/LogModal";
import { ConfigModal } from "../components/ConfigModal";
import { useApp } from "../context/AppContext";
import { validationService } from "../services/validationService";
import { rfidService } from "../services/rfidService";
import { tagService } from "../services/tagService";
import type { ValidacionLectura } from "../../types/rfid";

export default function ValidationPage() {
  const {
    globalConfig, setGlobalConfig, token, setToken, logs, addLog,
    readers, readerStates,
    handleAddReader, handleRemoveReader, handleUpdateReader, handleTestReader, handleGenerateToken,
  } = useApp();

  // Config
  const [readerIp, setReaderIp] = useState(readers.length > 0 ? readers[0].ip : "");

  // Auto-seleccionar primer reader disponible si no hay uno válido
  useEffect(() => {
    if (readers.length > 0 && (!readerIp || !readers.find(r => r.ip === readerIp))) {
      setReaderIp(readers[0].ip);
    }
  }, [readers, readerIp]);

  // State
  const [validating, setValidating] = useState(false);
  const validatingRef = useRef(false);
  const [results, setResults] = useState<ValidacionLectura[]>([]);
  const [missingResults, setMissingResults] = useState<ValidacionLectura[]>([]);
  const [cantidadRecep, setCantidadRecep] = useState<string>("0");
  const [hasValidated, setHasValidated] = useState(false);
  const [search, setSearch] = useState("");
  const [cardFilter, setCardFilter] = useState<"encontrados" | "no_encontrados" | "leidos" | "no_pertenece">("encontrados");

  // Refs for polling loop
  const readerIpRef = useRef(readerIp);
  const tokenRef = useRef(token);
  const globalConfigRef = useRef(globalConfig);
  const addLogRef = useRef(addLog);

  useEffect(() => { readerIpRef.current = readerIp; }, [readerIp]);
  useEffect(() => { tokenRef.current = token; }, [token]);
  useEffect(() => { globalConfigRef.current = globalConfig; }, [globalConfig]);
  useEffect(() => { addLogRef.current = addLog; }, [addLog]);
  useEffect(() => { validatingRef.current = validating; }, [validating]);

  // Modals
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isLogOpen, setIsLogOpen] = useState(false);

  // ── Pre-fetch de esperados ──
  useEffect(() => {
    async function fetchInitial() {
      if (!globalConfig.baseUrl || !token || globalConfig.mockMode) return;
      try {
        const res = await tagService.list(globalConfig.baseUrl, token);
        if (res.codigo === 1 && res.registros) {
          const actives = res.registros.filter((t) => {
            const e = String(t.estado).trim().toUpperCase();
            return e === "A" || e === "1" || e === "ACTIVO";
          }).length;
          setCantidadRecep(String(actives));
        }
      } catch (e) {
        // Ignorar
      }
    }
    fetchInitial();
  }, [globalConfig.baseUrl, token, globalConfig.mockMode]);

  // ── Poll validation (one iteration) ──
  const pollValidation = useCallback(async () => {
    const ip = readerIpRef.current;
    const t = tokenRef.current;
    const cfg = globalConfigRef.current;
    const log = addLogRef.current;

    try {
      const res = await validationService.validate(cfg.baseUrl, t, ip);
      if (res.codigo === 1 || res.codigo === 0) {
        const cant = res.cantidadrecep ?? (res as any).cantidadRecep ?? (res as any).CantidadRecep;
        if (cant !== undefined && cant !== null) setCantidadRecep(String(cant));
        if (res.faltantes) setMissingResults(res.faltantes);

        setResults((prev) => {
          const prevSet = new Set(prev.map((r) => r.tagid));
          const newOnes = (res.lecturas ?? []).filter((r) => !prevSet.has(r.tagid));
          if (newOnes.length > 0) {
            log(`${newOnes.length} tag(s) nuevo(s) validado(s)`, "success");
          }
          return res.lecturas ?? [];
        });
        setHasValidated(true);
      }
    } catch (e: unknown) {
      log(`Error validación: ${(e as Error).message}`, "error");
    }
  }, []);

  // ── Continuous polling loop ──
  useEffect(() => {
    let cancelled = false;

    async function loop() {
      while (!cancelled && validatingRef.current) {
        await pollValidation();
        await new Promise((r) => setTimeout(r, 50));
      }
    }

    if (validating) {
      loop();
    }

    return () => { cancelled = true; };
  }, [validating, pollValidation]);

  // ── Start validation (connect + read) ──
  const [connecting, setConnecting] = useState(false);
  const handleStartValidation = async () => {
    if (globalConfig.mockMode) {
      addLog("La validación requiere conexión a la API real", "error");
      return;
    }
    if (!readerIp.trim()) {
      addLog("Ingresa la IP del reader", "error");
      return;
    }
    setConnecting(true);
    addLog(`Conectando reader ${readerIp}...`, "info");
    try {
      await rfidService.connect(globalConfig.baseUrl, token, readerIp, 20, globalConfig.mockMode);
      addLog(`Reader ${readerIp} conectado`, "success");
    } catch (e: unknown) {
      addLog(`Error conectando: ${(e as Error).message}`, "error");
      setConnecting(false);
      return;
    }
    setConnecting(false);
    setResults([]);
    setHasValidated(true);
    addLog(`Validación en tiempo real iniciada (${readerIp})`, "success");
    setValidating(true);
  };

  // ── Stop validation (+ disconnect) ──
  const handleStopValidation = async () => {
    setValidating(false);
    addLog("Validación detenida", "info");
    try {
      await rfidService.disconnect(globalConfig.baseUrl, token, readerIp, globalConfig.mockMode);
      addLog(`Reader ${readerIp} desconectado`, "info");
    } catch { /* ignorar */ }
  };

  // ── Clear view (ope 3 + limpiar vista) ──
  const handleClearView = async () => {
    try {
      await rfidService.clearReadings(globalConfig.baseUrl, token, readerIp, globalConfig.mockMode);
    } catch { /* ignorar */ }
    setResults([]);
    setMissingResults([]); // <-- Ahora se limpia el estado faltante
    setHasValidated(false);
    setSearch("");
    addLog("Lista de lecturas limpiada", "info");
  };

  // ── Stats ──
  const totalEsperados = parseInt(cantidadRecep) || 0;
  const totalLeidos = results.length;
  const encontrados = results.filter((r) => isTagFound(r)).length;
  const noEncontradosCalculados = Math.max(0, totalEsperados - encontrados);
  const noPertenece = Math.max(0, totalLeidos - encontrados);
  const inactivos = results.filter((r) => isTagInactive(r)).length;

  // ── Filter Logic ──
  const getFilteredData = () => {
    switch (cardFilter) {
      case "encontrados":
        return results.filter(r => isTagFound(r));
      case "no_encontrados":
        return missingResults;
      case "leidos":
        return results;
      case "no_pertenece":
        return results.filter(r => !isTagFound(r));
      default:
        return results;
    }
  };

  const filteredResults = getFilteredData().filter(
    (r) =>
      r.tagid?.toLowerCase().includes(search.toLowerCase()) ||
      r.descripcion?.toLowerCase().includes(search.toLowerCase()) ||
      r.codarticulo?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a]">
      <Navbar
        readersCount={readers.length}
        mockMode={globalConfig.mockMode}
        logsCount={logs.length}
        onOpenLogs={() => setIsLogOpen(true)}
        onOpenConfig={() => setIsConfigOpen(true)}
      />

      <main className="max-w-7xl mx-auto p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-col">
            <h2 className="text-2xl font-extrabold text-[#1e4786] flex items-center gap-2">
              <CheckSquare size={24} /> Validación de Recepción
            </h2>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-sm text-slate-500">
                Verifica la presencia de tags registrados mediante lectura RFID
              </p>
              {validating && (
                <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-600 border border-emerald-200 px-2.5 py-1 rounded-full text-[10px] font-bold">
                  <Radio size={10} className="animate-pulse" /> EN VIVO
                </span>
              )}
            </div>
          </div>

          {/* Moved Controls to Top Right */}
          <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex flex-col">
              <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-1">Reader</label>
              <select
                className="p-1.5 border-none text-xs font-bold text-slate-700 bg-transparent focus:ring-0 outline-none transition-all disabled:text-slate-400 min-w-[140px]"
                value={readerIp}
                onChange={(e) => setReaderIp(e.target.value)}
                disabled={validating || readers.length === 0}
              >
                {readers.length === 0 ? (
                  <option value="">Sin Readers</option>
                ) : (
                  readers.map((r) => (
                    <option key={r.id} value={r.ip}>
                      {r.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="h-8 w-px bg-slate-100 mx-1" />

            <div className="flex gap-2">
              {!validating ? (
                <button
                  onClick={handleStartValidation}
                  disabled={connecting || globalConfig.mockMode || !readerIp.trim()}
                  className="flex items-center justify-center gap-2 bg-[#1e4786] text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-[#14325e] disabled:opacity-50 transition-all shadow-sm"
                >
                  {connecting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Play size={14} fill="currentColor" />
                  )}
                  {connecting ? "Conectando..." : "Iniciar"}
                </button>
              ) : (
                <button
                  onClick={handleStopValidation}
                  className="flex items-center justify-center gap-2 bg-red-500 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-600 transition-all shadow-sm"
                >
                  <Square size={14} fill="currentColor" /> Detener
                </button>
              )}
              <button
                onClick={handleClearView}
                disabled={validating || results.length === 0}
                className="flex items-center justify-center p-2 border border-slate-200 text-slate-500 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-all"
                title="Limpiar vista"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Mock warning */}
        {globalConfig.mockMode && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <AlertCircle size={20} className="text-amber-500 shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-800">Modo Simulación</p>
              <p className="text-xs text-amber-600">
                La validación requiere conexión a la API real.
              </p>
            </div>
          </div>
        )}



        {/* Stats Cards / Filters */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatBox
            label="Activos Esperados"
            value={totalEsperados}
            icon={<Tag size={18} className="text-[#22c4a1]" />}
            color="#22c4a1"
            isReference={true}
          />
          <StatBox
            label="Encontrados"
            value={encontrados}
            icon={<CheckCircle size={18} className="text-emerald-500" />}
            color="#22c4a1"
            onClick={() => setCardFilter("encontrados")}
            isSelected={cardFilter === "encontrados"}
          />
          <StatBox
            label="No Encontrados"
            value={noEncontradosCalculados}
            icon={<XCircle size={18} className="text-red-500" />}
            color="#ef4444"
            alert={noEncontradosCalculados > 0}
            onClick={() => setCardFilter("no_encontrados")}
            isSelected={cardFilter === "no_encontrados"}
          />
          <StatBox
            label="Total Leídos"
            value={totalLeidos}
            icon={<Tag size={18} className="text-[#1e4786]" />}
            color="#1e4786"
            onClick={() => setCardFilter("leidos")}
            isSelected={cardFilter === "leidos"}
          />
          <StatBox
            label="No Pertenece"
            value={noPertenece}
            icon={<Ban size={18} className="text-amber-500" />}
            color="#f59e0b"
            onClick={() => setCardFilter("no_pertenece")}
            isSelected={cardFilter === "no_pertenece"}
          />
        </div>

        {/* Results Table Area */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100">
            <div className="flex items-center gap-4">
              <span className="font-bold text-sm text-[#1e4786] flex items-center gap-2">
                {cardFilter === "encontrados" && <CheckCircle size={18} className="text-emerald-500" />}
                {cardFilter === "no_encontrados" && <AlertCircle size={18} className="text-red-500" />}
                {cardFilter === "leidos" && <BarChart3 size={18} className="text-[#1e4786]" />}
                {cardFilter === "no_pertenece" && <Ban size={18} className="text-amber-500" />}
                Mostrando: {
                  cardFilter === "encontrados" ? "Tags Encontrados" :
                  cardFilter === "no_encontrados" ? "Tags No Encontrados (Faltantes)" :
                  cardFilter === "leidos" ? "Total de Tags Leídos" :
                  "Tags que No Pertenecen"
                }
              </span>
              {validating && (
                <span className="flex items-center gap-1.5 text-[10px] text-emerald-600 font-semibold bg-emerald-50/50 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Actualizando
                </span>
              )}
            </div>
            <div className="relative w-full md:w-80">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs focus:border-[#22c4a1] outline-none transition-all"
                placeholder="Buscar tag..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[11px] uppercase tracking-widest text-slate-400 font-bold">
                  <th className="px-6 py-4">#</th>
                  <th className="px-6 py-4">Tag ID</th>
                  <th className="px-6 py-4">Cód. Artículo</th>
                  <th className="px-6 py-4">Cód. Barra</th>
                  <th className="px-6 py-4">Cód. Manual</th>
                  <th className="px-6 py-4">Descripción</th>
                  <th className="px-6 py-4 text-center">Estado</th>
                  <th className="px-6 py-4 text-center">Encontrado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredResults.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2 opacity-40">
                        {validating ? (
                          <>
                            <Loader2 size={40} className="animate-spin text-[#22c4a1]" />
                            <p className="font-medium">Esperando lecturas...</p>
                          </>
                        ) : (
                          <>
                            <CheckSquare size={40} />
                            <p className="font-medium">Sin resultados de validación</p>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredResults.map((r, idx) => {
                    const inactive = isTagInactive(r);
                    const found = isTagFound(r);

                    return (
                      <tr
                        key={`${r.tagid}-${idx}`}
                        className={`group transition-colors ${inactive
                          ? "bg-red-50/50"
                          : found
                            ? "hover:bg-slate-50/50"
                            : "bg-amber-50/30"
                          }`}
                      >
                        <td className="px-6 py-4 text-xs font-mono text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`font-mono font-bold text-sm ${inactive ? "text-red-500" : "text-[#1e4786]"
                              }`}
                          >
                            {r.tagid}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {r.codarticulo || "\u2014"}
                        </td>
                        <td className="px-6 py-4 text-sm font-mono text-slate-600">
                          {r.codbarra || "\u2014"}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {r.codmanual || "\u2014"}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600 max-w-[180px] truncate">
                          {r.descripcion || "\u2014"}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {inactive ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold border bg-red-100 text-red-600 border-red-300">
                              <Ban size={10} /> INACTIVO
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold border bg-emerald-50 text-emerald-600 border-emerald-200">
                              ACTIVO
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {found ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold border bg-emerald-50 text-emerald-600 border-emerald-200">
                              <CheckCircle size={10} /> S\u00cd
                            </span>
                          ) : inactive ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold border bg-red-50 text-red-500 border-red-200">
                              <Ban size={10} /> NO (INACTIVO)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold border bg-amber-50 text-amber-600 border-amber-200">
                              <XCircle size={10} /> NO
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {filteredResults.length > 0 && (
            <div className="px-6 py-3 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-mono">
                {filteredResults.length} fila(s) visible(s)
              </span>
              <div className="flex items-center gap-3">
                {inactivos > 0 && (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-red-500">
                    <Ban size={12} /> {inactivos} inactivo(s)
                  </span>
                )}
                {validating && (
                  <span className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Actualizando en tiempo real
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      <LogModal isOpen={isLogOpen} onClose={() => setIsLogOpen(false)} logs={logs} />

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

      <footer className="py-8 text-center text-slate-400 text-[10px] font-mono tracking-[0.2em] uppercase">
        DBPERU RFID Systems · v2.0
      </footer>
    </div>
  );
}

// ── Helpers ──

function isTagInactive(r: ValidacionLectura) {
  return r.estado === "I" || r.estado === "0" || r.estado === "E" || r.estado === "ELIMINADO" || r.estado === "INACTIVO";
}

function isTagFound(r: ValidacionLectura) {
  return r.encontrado === "S" || r.encontrado === "1";
}

// ── Stat Box Component ──
function StatBox({
  label,
  value,
  icon,
  color,
  alert,
  onClick,
  isSelected,
  isReference,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  alert?: boolean;
  onClick?: () => void;
  isSelected?: boolean;
  isReference?: boolean;
}) {
  const bgStyle = isReference 
    ? { backgroundColor: "#1e4786", borderColor: "#14325e", color: "white" }
    : {
        backgroundColor: alert && !isSelected ? "rgba(254, 242, 242, 0.5)" : "white",
        borderColor: isSelected ? color : alert ? "rgb(252, 165, 165)" : "rgb(226, 232, 240)",
        color: "inherit"
      };

  return (
    <div
      onClick={onClick}
      className={`p-5 rounded-xl border transition-all duration-200 ${
        onClick ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5" : "shadow-sm"
      }`}
      style={{
        ...bgStyle,
        boxShadow: isSelected ? `0 0 0 1px ${color}` : undefined,
      }}
    >
      <div 
        className="flex items-center gap-2 text-[10px] uppercase tracking-wider mb-2 font-mono" 
        style={{ 
          color: isReference ? "rgba(255,255,255,0.7)" : (isSelected ? color : "rgb(100, 116, 139)"),
        }}
      >
        {icon} {label}
      </div>
      <div className="text-3xl font-extrabold font-mono" style={{ color: isReference ? "white" : color }}>
        {value}
      </div>
    </div>
  );
}

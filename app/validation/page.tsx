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
} from "lucide-react";

import { Navbar } from "../components/rfid/Navbar";
import { LogModal } from "../components/rfid/LogModal";
import { ConfigModal } from "../components/ConfigModal";
import { useApp } from "../context/AppContext";
import { validationService } from "../services/validationService";
import type { ValidacionLectura } from "../../types/rfid";

export default function ValidationPage() {
  const {
    globalConfig, setGlobalConfig, token, setToken, logs, addLog,
    readers, readerStates,
    handleAddReader, handleRemoveReader, handleUpdateReader, handleTestReader, handleGenerateToken,
  } = useApp();

  // Config
  const [readerIp, setReaderIp] = useState("192.168.10.1");

  // State
  const [validating, setValidating] = useState(false);
  const validatingRef = useRef(false);
  const [results, setResults] = useState<ValidacionLectura[]>([]);
  const [hasValidated, setHasValidated] = useState(false);
  const [search, setSearch] = useState("");

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

  // ── Poll validation (one iteration) ──
  const pollValidation = useCallback(async () => {
    const ip = readerIpRef.current;
    const t = tokenRef.current;
    const cfg = globalConfigRef.current;
    const log = addLogRef.current;

    try {
      const res = await validationService.validate(cfg.baseUrl, t, ip);
      if (res.codigo === 1) {
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

  // ── Start validation ──
  const handleStartValidation = () => {
    if (globalConfig.mockMode) {
      addLog("La validación requiere conexión a la API real", "error");
      return;
    }
    if (!readerIp.trim()) {
      addLog("Ingresa la IP del reader", "error");
      return;
    }
    setResults([]);
    setHasValidated(true);
    addLog(`Validación en tiempo real iniciada (${readerIp})`, "success");
    setValidating(true);
  };

  // ── Stop validation ──
  const handleStopValidation = () => {
    setValidating(false);
    addLog("Validación detenida", "info");
  };

  // ── Stats ──
  const totalLeidos = results.length;
  const encontrados = results.filter((r) => isTagFound(r)).length;
  const noEncontrados = results.filter((r) => !isTagFound(r)).length;
  const inactivos = results.filter((r) => isTagInactive(r)).length;

  // ── Filter ──
  const filteredResults = results.filter(
    (r) =>
      r.tagid.toLowerCase().includes(search.toLowerCase()) ||
      r.descripcion.toLowerCase().includes(search.toLowerCase()) ||
      r.codarticulo.toLowerCase().includes(search.toLowerCase())
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
          <div>
            <h2 className="text-2xl font-extrabold text-[#1e4786] flex items-center gap-2">
              <CheckSquare size={24} /> Validación de Recepción
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Verifica la presencia de tags registrados mediante lectura RFID en tiempo real
            </p>
          </div>
          {validating && (
            <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-600 border border-emerald-200 px-3 py-1.5 rounded-full text-[11px] font-bold">
              <Radio size={12} className="animate-pulse" /> VALIDANDO EN VIVO
            </span>
          )}
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

        {/* Config Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
            Configuración de Validación
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-1 md:col-span-2">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                IP del Reader
              </label>
              <input
                className="w-full p-2.5 border border-slate-200 rounded-lg text-sm font-mono focus:border-[#22c4a1] outline-none transition-all disabled:bg-slate-50 disabled:text-slate-400"
                value={readerIp}
                onChange={(e) => setReaderIp(e.target.value)}
                placeholder="192.168.10.1"
                disabled={validating}
              />
            </div>
            {!validating ? (
              <button
                onClick={handleStartValidation}
                disabled={globalConfig.mockMode || !readerIp.trim()}
                className="flex items-center justify-center gap-2 bg-[#1e4786] text-white px-6 py-2.5 rounded-lg text-sm font-bold hover:brightness-110 disabled:opacity-50 transition-all"
              >
                <Play size={16} fill="white" /> Iniciar Validación
              </button>
            ) : (
              <button
                onClick={handleStopValidation}
                className="flex items-center justify-center gap-2 bg-red-500 text-white px-6 py-2.5 rounded-lg text-sm font-bold hover:brightness-110 transition-all"
              >
                <Square size={16} fill="white" /> Detener Validación
              </button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        {hasValidated && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatBox
              label="Total Leídos"
              value={totalLeidos}
              icon={<Tag size={18} className="text-[#1e4786]" />}
              color="#1e4786"
            />
            <StatBox
              label="Encontrados"
              value={encontrados}
              icon={<CheckCircle size={18} className="text-emerald-500" />}
              color="#22c4a1"
            />
            <StatBox
              label="No Encontrados"
              value={noEncontrados}
              icon={<XCircle size={18} className="text-amber-500" />}
              color="#f59e0b"
            />
            <StatBox
              label="Inactivos"
              value={inactivos}
              icon={<Ban size={18} className="text-red-500" />}
              color="#ef4444"
              alert={inactivos > 0}
            />
          </div>
        )}

        {/* Results Table */}
        {hasValidated && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                <BarChart3 size={18} /> Resultados de Validación
                {validating && (
                  <span className="flex items-center gap-1.5 ml-2 text-[10px] text-emerald-600 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    En vivo
                  </span>
                )}
              </h3>
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
                          className={`group transition-colors ${
                            inactive
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
                              className={`font-mono font-bold text-sm ${
                                inactive ? "text-red-500" : "text-[#1e4786]"
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
                  {filteredResults.length} de {results.length} resultado(s)
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
        )}
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
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`bg-white p-5 rounded-xl border shadow-sm ${
        alert ? "border-red-300 bg-red-50/30" : "border-slate-200"
      }`}
    >
      <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-mono">
        {icon} {label}
      </div>
      <div className="text-3xl font-extrabold font-mono" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

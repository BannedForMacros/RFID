"use client";

import { useState } from "react";
import {
  CheckSquare,
  Play,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  BarChart3,
  Tag,
  Search,
  Settings,
  ClipboardList,
} from "lucide-react";

import { Navbar } from "../components/rfid/Navbar";
import { LogModal } from "../components/rfid/LogModal";
import { ConfigModal } from "../components/ConfigModal";
import { useApp } from "../context/AppContext";
import { useReaderManager } from "../hooks/useReaderManager";
import { validationService } from "../services/validationService";
import { rfidService } from "../services/rfidService";
import type { ValidacionLectura } from "../../types/rfid";

export default function ValidationPage() {
  const { globalConfig, setGlobalConfig, token, setToken, logs, addLog } = useApp();
  const manager = useReaderManager();

  // Config
  const [readerIp, setReaderIp] = useState("192.168.10.1");
  const [tagsToRead, setTagsToRead] = useState(50);

  // State
  const [validating, setValidating] = useState(false);
  const [results, setResults] = useState<ValidacionLectura[]>([]);
  const [hasValidated, setHasValidated] = useState(false);
  const [search, setSearch] = useState("");

  // Modals
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isLogOpen, setIsLogOpen] = useState(false);

  // Token generation
  const handleGenerateToken = async () => {
    try {
      addLog("Generando token...", "info");
      const t = await rfidService.generateToken(
        globalConfig.baseUrl,
        globalConfig.dias,
        globalConfig.mockMode
      );
      setToken(t);
      addLog(`Token generado`, "success");
    } catch (e: unknown) {
      addLog(`Error token: ${(e as Error).message}`, "error");
    }
  };

  // ── Validate ──
  const handleValidate = async () => {
    if (globalConfig.mockMode) {
      addLog("La validación requiere conexión a la API real", "error");
      return;
    }
    if (!readerIp.trim()) {
      addLog("Ingresa la IP del reader", "error");
      return;
    }

    setValidating(true);
    setResults([]);
    addLog(`Iniciando validación en ${readerIp}...`, "info");

    try {
      const res = await validationService.validate(globalConfig.baseUrl, token, readerIp);

      if (res.codigo === 1) {
        setResults(res.lecturas ?? []);
        setHasValidated(true);
        addLog(
          `Validación completada: ${res.lecturas?.length ?? 0} tags leídos`,
          "success"
        );
      } else if (res.codigo === 0) {
        addLog(`Sin resultados: ${res.mensaje}`, "info");
        setHasValidated(true);
      } else {
        addLog(`Error en validación: ${res.mensaje}`, "error");
      }
    } catch (e: unknown) {
      addLog(`Error: ${(e as Error).message}`, "error");
    } finally {
      setValidating(false);
    }
  };

  // ── Stats ──
  const totalLeidos = results.length;
  const encontrados = results.filter((r) => r.encontrado === "S" || r.encontrado === "1").length;
  const noEncontrados = results.filter((r) => r.encontrado !== "S" && r.encontrado !== "1").length;
  const eliminados = results.filter(
    (r) => r.estado === "I" || r.estado === "E" || r.estado === "ELIMINADO"
  ).length;

  // ── Filter ──
  const filteredResults = results.filter(
    (r) =>
      r.tagid.toLowerCase().includes(search.toLowerCase()) ||
      r.descripcion.toLowerCase().includes(search.toLowerCase()) ||
      r.codarticulo.toLowerCase().includes(search.toLowerCase())
  );

  const isTagDeleted = (r: ValidacionLectura) =>
    r.estado === "I" || r.estado === "E" || r.estado === "ELIMINADO";

  const isTagFound = (r: ValidacionLectura) =>
    r.encontrado === "S" || r.encontrado === "1";

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a]">
      <Navbar
        readersCount={manager.readers.length}
        mockMode={globalConfig.mockMode}
        logsCount={logs.length}
        onOpenLogs={() => setIsLogOpen(true)}
        onOpenConfig={() => setIsConfigOpen(true)}
      />

      <main className="max-w-7xl mx-auto p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-extrabold text-[#1e4786] flex items-center gap-2">
            <CheckSquare size={24} /> Validación de Recepción
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Verifica la presencia de tags registrados mediante lectura RFID
          </p>
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
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                IP del Reader
              </label>
              <input
                className="w-full p-2.5 border border-slate-200 rounded-lg text-sm font-mono focus:border-[#22c4a1] outline-none transition-all"
                value={readerIp}
                onChange={(e) => setReaderIp(e.target.value)}
                placeholder="192.168.10.1"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Tags a leer (referencia)
              </label>
              <input
                type="number"
                className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:border-[#22c4a1] outline-none transition-all"
                value={tagsToRead}
                min={1}
                onChange={(e) => setTagsToRead(Number(e.target.value))}
              />
            </div>
            <button
              onClick={handleValidate}
              disabled={validating || globalConfig.mockMode || !readerIp.trim()}
              className="flex items-center justify-center gap-2 bg-[#1e4786] text-white px-6 py-2.5 rounded-lg text-sm font-bold hover:brightness-110 disabled:opacity-50 transition-all"
            >
              {validating ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Validando...
                </>
              ) : (
                <>
                  <Play size={16} fill="white" /> Iniciar Validación
                </>
              )}
            </button>
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
              label="Eliminados / Inactivos"
              value={eliminados}
              icon={<AlertCircle size={18} className="text-red-500" />}
              color="#ef4444"
              alert={eliminados > 0}
            />
          </div>
        )}

        {/* Results Table */}
        {hasValidated && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                <BarChart3 size={18} /> Historial de Validación
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
                          <CheckSquare size={40} />
                          <p className="font-medium">Sin resultados de validación</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredResults.map((r, idx) => {
                      const deleted = isTagDeleted(r);
                      const found = isTagFound(r);

                      return (
                        <tr
                          key={`${r.tagid}-${idx}`}
                          className={`group transition-colors ${
                            deleted
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
                                deleted ? "text-red-500" : "text-[#1e4786]"
                              }`}
                            >
                              {r.tagid}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {r.codarticulo || "—"}
                          </td>
                          <td className="px-6 py-4 text-sm font-mono text-slate-600">
                            {r.codbarra || "—"}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {r.codmanual || "—"}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600 max-w-[180px] truncate">
                            {r.descripcion || "—"}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {deleted ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold border bg-red-100 text-red-600 border-red-300">
                                <XCircle size={10} /> ELIMINADO
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
                                <CheckCircle size={10} /> SÍ
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold border bg-red-50 text-red-500 border-red-200">
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
                {eliminados > 0 && (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-red-500">
                    <AlertCircle size={12} /> {eliminados} tag(s) eliminado(s) detectado(s)
                  </span>
                )}
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
        readers={manager.readers}
        readerStates={manager.readerStates}
        onGenerateToken={handleGenerateToken}
        onAddReader={manager.handleAddReader}
        onRemoveReader={manager.handleRemoveReader}
        onUpdateReader={manager.handleUpdateReader}
        onTestReader={manager.handleTestReader}
        token={token}
      />

      <footer className="py-8 text-center text-slate-400 text-[10px] font-mono tracking-[0.2em] uppercase">
        DBPERU RFID Systems · v2.0
      </footer>
    </div>
  );
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

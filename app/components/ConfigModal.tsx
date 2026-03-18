"use client";

import React, { useState } from "react";
import Modal from "./Modal";
import {
  Monitor, Key, Globe, Plus, Trash2,
  CheckCircle, AlertCircle, Loader2,
  FlaskConical, ToggleLeft, ToggleRight, Radio, Zap,
} from "lucide-react";
import type {
  GlobalConfig,
  ReaderConfig,
  ReaderRuntimeState,
  ReaderStatus,
  AntennaConfig,
} from "../../types/rfid";

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  globalConfig: GlobalConfig;
  setGlobalConfig: (c: GlobalConfig) => void;
  readers: ReaderConfig[];
  readerStates: Record<string, ReaderRuntimeState>;
  onGenerateToken: () => void;
  onAddReader: () => void;
  onRemoveReader: (id: string) => void;
  onUpdateReader: (id: string, updates: Partial<ReaderConfig>) => void;
  onTestReader: (id: string) => Promise<{ ok: boolean; latencyMs: number }>;
  token: string;
}

type TestResult = { ok: boolean; latencyMs: number } | null;

const STATUS_LABEL: Record<ReaderStatus, string> = {
  disconnected: "DESCONECTADO",
  connecting:   "CONECTANDO...",
  connected:    "CONECTADO",
  reading:      "LEYENDO",
  error:        "ERROR",
  testing:      "PROBANDO...",
};

const STATUS_COLORS: Record<ReaderStatus, string> = {
  disconnected: "bg-slate-100 text-slate-500 border-slate-200",
  connecting:   "bg-yellow-50 text-yellow-600 border-yellow-200",
  connected:    "bg-blue-50 text-blue-600 border-blue-200",
  reading:      "bg-emerald-50 text-emerald-600 border-emerald-200",
  error:        "bg-red-50 text-red-500 border-red-200",
  testing:      "bg-violet-50 text-violet-600 border-violet-200",
};

const DOT_COLORS: Record<ReaderStatus, string> = {
  disconnected: "bg-slate-300",
  connecting:   "bg-yellow-400 animate-pulse",
  connected:    "bg-blue-500",
  reading:      "bg-emerald-500 animate-pulse",
  error:        "bg-red-500",
  testing:      "bg-violet-500 animate-pulse",
};

export const ConfigModal = ({
  isOpen,
  onClose,
  globalConfig,
  setGlobalConfig,
  readers,
  readerStates,
  onGenerateToken,
  onAddReader,
  onRemoveReader,
  onUpdateReader,
  onTestReader,
  token,
}: ConfigModalProps) => {
  const [testingIds, setTestingIds] = useState<Set<string>>(new Set());
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});

  const handleTest = async (id: string) => {
    setTestingIds((prev) => new Set([...prev, id]));
    setTestResults((prev) => ({ ...prev, [id]: null }));
    try {
      const result = await onTestReader(id);
      setTestResults((prev) => ({ ...prev, [id]: result }));
    } catch {
      setTestResults((prev) => ({ ...prev, [id]: { ok: false, latencyMs: 0 } }));
    } finally {
      setTestingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleClose = () => {
    setTestResults({});
    onClose();
  };

  const addAntenna = (reader: ReaderConfig) => {
    const next: AntennaConfig[] = [
      ...reader.antenas,
      {
        numero: reader.antenas.length + 1,
        nombre: `Antena ${reader.antenas.length + 1}`,
        potencia: 20,
      },
    ];
    onUpdateReader(reader.id, { antenas: next });
  };

  const removeAntenna = (reader: ReaderConfig, idx: number) => {
    const next = reader.antenas
      .filter((_, i) => i !== idx)
      .map((a, i) => ({ ...a, numero: i + 1 }));
    onUpdateReader(reader.id, { antenas: next });
  };

  const updateAntenna = (
    reader: ReaderConfig,
    idx: number,
    patch: Partial<AntennaConfig>
  ) => {
    const next = reader.antenas.map((a, i) => (i === idx ? { ...a, ...patch } : a));
    onUpdateReader(reader.id, { antenas: next });
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Configuración del Sistema" size="lg">
      <div className="flex flex-col gap-5">

        {/* ── SECCIÓN GLOBAL ── */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Configuración Global
          </h4>

          {/* Modo Mock */}
          <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <div>
              <p className="text-sm font-bold text-amber-800">Modo Simulación</p>
              <p className="text-[11px] text-amber-600">
                {globalConfig.mockMode
                  ? "Usando datos simulados — sin hardware real"
                  : "Conectado a API real"}
              </p>
            </div>
            <button
              onClick={() => setGlobalConfig({ ...globalConfig, mockMode: !globalConfig.mockMode })}
              className="text-amber-600 hover:text-amber-800 transition-colors"
            >
              {globalConfig.mockMode
                ? <ToggleRight size={32} className="text-amber-500" />
                : <ToggleLeft size={32} className="text-slate-400" />}
            </button>
          </div>

          {/* URL Base */}
          {!globalConfig.mockMode && (
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Globe size={11} /> URL Base (ngrok / local)
              </label>
              <input
                className="w-full p-2 border border-slate-200 rounded-lg text-sm font-mono focus:border-[#22c4a1] outline-none transition-all"
                value={globalConfig.baseUrl}
                onChange={(e) =>
                  setGlobalConfig({ ...globalConfig, baseUrl: e.target.value.replace(/\/$/, "") })
                }
                placeholder="https://abc123.ngrok.io"
              />
            </div>
          )}

          {/* Token */}
          <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Key size={11} /> Días de validez del token
              </label>
              <input
                type="number"
                className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                value={globalConfig.dias}
                min={1}
                max={30}
                onChange={(e) =>
                  setGlobalConfig({ ...globalConfig, dias: Number(e.target.value) })
                }
              />
            </div>
            <button
              onClick={onGenerateToken}
              className="bg-[#1e4786] text-white px-4 py-2 rounded-lg text-xs font-bold hover:opacity-85 transition-opacity h-[38px]"
            >
              🔑 Generar
            </button>
          </div>

          {token && (
            <div className="bg-[#22c4a1]/10 border border-[#22c4a1]/40 rounded-lg p-3">
              <label className="text-[10px] font-bold text-[#22c4a1] uppercase tracking-wider">
                Token activo
              </label>
              <div className="font-mono text-[11px] text-[#22c4a1] break-all leading-tight mt-1">
                {token.substring(0, 65)}...
              </div>
            </div>
          )}
        </div>

        {/* ── SECCIÓN READERS ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Readers ({readers.length})
            </h4>
            <button
              onClick={onAddReader}
              className="flex items-center gap-1.5 bg-[#1e4786] text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:opacity-85 transition-opacity"
            >
              <Plus size={13} /> Agregar Reader
            </button>
          </div>

          {readers.length === 0 && (
            <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
              <Monitor size={28} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No hay readers configurados</p>
              <p className="text-xs mt-1">Haz clic en "Agregar Reader" para comenzar</p>
            </div>
          )}

          {readers.map((reader) => {
            const state   = readerStates[reader.id];
            const status: ReaderStatus = state?.status ?? "disconnected";
            const isTesting   = testingIds.has(reader.id);
            const testResult  = testResults[reader.id];
            const isConnected = status === "connected" || status === "reading";
            const isBusy      = status === "connecting" || status === "testing";

            return (
              <div
                key={reader.id}
                className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/50"
              >
                {/* Fila 1: nombre, status badge, eliminar */}
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${DOT_COLORS[status]}`} />
                  <input
                    className="flex-1 min-w-0 p-1.5 border border-slate-200 rounded-lg text-sm font-bold bg-white focus:border-[#1e4786] outline-none"
                    value={reader.name}
                    onChange={(e) => onUpdateReader(reader.id, { name: e.target.value })}
                    placeholder="Nombre del reader (ej. Cuarto de servidores)"
                  />
                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${STATUS_COLORS[status]}`}
                  >
                    {STATUS_LABEL[status]}
                  </span>
                  <button
                    onClick={() => onRemoveReader(reader.id)}
                    disabled={isConnected || isBusy}
                    className="p-1.5 text-slate-300 hover:text-red-500 disabled:opacity-30 transition-colors"
                    title="Eliminar reader"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                {/* Fila 2: IP */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tight flex items-center gap-1">
                    <Monitor size={10} /> IP del Reader
                  </label>
                  <input
                    className="w-full p-1.5 border border-slate-200 rounded-lg text-xs font-mono bg-white focus:border-[#22c4a1] outline-none"
                    value={reader.ip}
                    onChange={(e) => onUpdateReader(reader.id, { ip: e.target.value })}
                    placeholder="192.168.1.100"
                  />
                </div>

                {/* Antenas */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight flex items-center gap-1">
                      <Radio size={10} /> Antenas ({reader.antenas.length})
                    </span>
                    <button
                      onClick={() => addAntenna(reader)}
                      className="flex items-center gap-1 text-[10px] font-bold text-[#1e4786] hover:text-[#22c4a1] transition-colors"
                    >
                      <Plus size={11} /> Agregar antena
                    </button>
                  </div>

                  {reader.antenas.length === 0 && (
                    <p className="text-[11px] text-slate-400 italic px-1">
                      Sin antenas — agrega al menos una para conectar
                    </p>
                  )}

                  <div className="space-y-1.5">
                    {reader.antenas.map((ant, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2"
                      >
                        {/* Número */}
                        <span className="text-[10px] font-bold text-slate-400 shrink-0 w-7 text-center">
                          #{ant.numero}
                        </span>

                        {/* Nombre / ubicación */}
                        <input
                          className="flex-1 min-w-0 p-1 text-xs border border-slate-200 rounded-md focus:border-[#22c4a1] outline-none bg-slate-50"
                          value={ant.nombre}
                          placeholder="Ubicación (ej. Puerta entrada)"
                          onChange={(e) => updateAntenna(reader, idx, { nombre: e.target.value })}
                        />

                        {/* Potencia */}
                        <div className="flex items-center gap-1 shrink-0">
                          <Zap size={10} className="text-slate-400" />
                          <input
                            type="number"
                            className="w-14 p-1 text-xs font-mono border border-slate-200 rounded-md focus:border-[#22c4a1] outline-none bg-slate-50 text-center"
                            value={ant.potencia}
                            min={10}
                            max={30}
                            onChange={(e) =>
                              updateAntenna(reader, idx, { potencia: Number(e.target.value) })
                            }
                          />
                          <span className="text-[10px] text-slate-400">dBm</span>
                        </div>

                        {/* Eliminar antena */}
                        <button
                          onClick={() => removeAntenna(reader, idx)}
                          className="p-1 text-slate-300 hover:text-red-500 transition-colors shrink-0"
                          title="Eliminar antena"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Acciones: solo test de comunicación */}
                <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                  <button
                    onClick={() => handleTest(reader.id)}
                    disabled={isTesting || isBusy}
                    className="flex items-center gap-1.5 bg-violet-50 border border-violet-200 text-violet-700 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-violet-100 disabled:opacity-50 transition-all"
                  >
                    {isTesting
                      ? <Loader2 size={12} className="animate-spin" />
                      : <FlaskConical size={12} />}
                    {isTesting ? "Probando..." : "Probar conexión"}
                  </button>

                  {testResult !== undefined && testResult !== null && (
                    <span
                      className={`flex items-center gap-1 text-[11px] font-semibold ${
                        testResult.ok ? "text-emerald-600" : "text-red-500"
                      }`}
                    >
                      {testResult.ok ? (
                        <><CheckCircle size={12} /> OK {testResult.latencyMs}ms</>
                      ) : (
                        <><AlertCircle size={12} /> Sin respuesta</>
                      )}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
};

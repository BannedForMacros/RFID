"use client";

import { Download, Trash2, WifiOff, Save, Radio } from "lucide-react";
import type {
  Tag,
  ReaderConfig,
  ReaderRuntimeState,
  AntennaConfig,
} from "../../../types/rfid";

function formatDate(d: string) {
  return d
    ? new Date(d).toLocaleString("es-PE", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
    : "—";
}

interface TagTableProps {
  tags: Tag[];
  reader?: ReaderConfig;
  readerState: ReaderRuntimeState;
  activeAntennaNum: number | null;
  activeAntennaCfg?: AntennaConfig;
  onDownloadCSV: () => void;
  onDownloadTXT: () => void;
  onClear: () => void;
  onRegisterTag?: (tagId: string) => void;
}

export function TagTable({
  tags,
  reader,
  readerState,
  activeAntennaNum,
  activeAntennaCfg,
  onDownloadCSV,
  onDownloadTXT,
  onClear,
  onRegisterTag,
}: TagTableProps) {
  const isReading = readerState.status === "reading";

  return (
    <>
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-slate-50/80 to-white flex justify-between items-center flex-wrap gap-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <h2 className="font-bold text-slate-700 flex items-center gap-2 text-[15px]">
            Lecturas —{" "}
            <span className="text-[#1e4786]">{reader?.name ?? "—"}</span>
            {activeAntennaCfg ? (
              <>
                <span className="text-slate-300 font-light">/</span>
                <span className="text-[#22c4a1]">{activeAntennaCfg.nombre}</span>
              </>
            ) : (
              <span className="text-slate-400 text-xs font-normal ml-1">todas las antenas</span>
            )}
          </h2>
          {isReading && (
            <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-600 border border-emerald-200 px-2.5 py-1 rounded-full text-[10px] font-bold">
              <Radio size={10} className="animate-pulse" /> EN VIVO
            </span>
          )}
          {!isReading && readerState.status !== "disconnected" && (
            <span className="flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-200">
              {readerState.status.toUpperCase()}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onDownloadCSV}
            disabled={tags.length === 0}
            className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-100 disabled:opacity-40 transition-all"
          >
            <Download size={13} /> CSV
          </button>
          <button
            onClick={onDownloadTXT}
            disabled={tags.length === 0}
            className="flex items-center gap-1.5 bg-violet-50 border border-violet-200 text-violet-600 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-violet-100 disabled:opacity-40 transition-all"
          >
            <Download size={13} /> TXT
          </button>
          <button
            onClick={onClear}
            className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-500 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-all"
          >
            <Trash2 size={13} /> Limpiar
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-slate-400 font-bold bg-slate-50/50">
              <th className="px-6 py-3.5">#</th>
              <th className="px-6 py-3.5">EPC / TAG ID</th>
              <th className="px-5 py-3.5 text-center">Antena</th>
              <th className="px-6 py-3.5 text-center">Lecturas</th>
              <th className="px-6 py-3.5">Primera Lectura</th>
              <th className="px-6 py-3.5">Última Lectura</th>
              <th className="px-6 py-3.5 text-center">Registrar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80">
            {tags.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-24 text-center text-slate-400">
                  <div className="flex flex-col items-center gap-3">
                    <div className="p-4 bg-slate-100 rounded-2xl">
                      <WifiOff size={32} className="text-slate-300" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-500">
                        {readerState.status === "disconnected"
                          ? "Reader desconectado"
                          : activeAntennaNum !== null
                            ? `Sin lecturas en ${activeAntennaCfg?.nombre ?? `Antena ${activeAntennaNum}`}`
                            : "Esperando lecturas..."}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {readerState.status === "disconnected"
                          ? "Conecta el reader e inicia la lectura en tiempo real"
                          : "Las lecturas aparecerán aquí en tiempo real"}
                      </p>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              tags.map((tag, idx) => {
                const isNew = readerState.newTagIds.includes(tag.tagid);
                const antCfg = reader?.antenas.find((a) => a.numero === tag.antena);
                return (
                  <tr
                    key={tag.tagid}
                    className={`group transition-all duration-300 ${
                      isNew
                        ? "bg-emerald-50/40 border-l-2 border-l-emerald-400"
                        : "hover:bg-slate-50/60 border-l-2 border-l-transparent"
                    }`}
                  >
                    <td className="px-6 py-3.5 text-xs font-mono text-slate-400">{idx + 1}</td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono font-bold text-sm tracking-wide ${
                            isNew ? "text-emerald-600" : "text-[#1e4786]"
                          }`}
                        >
                          {tag.tagid}
                        </span>
                        {isNew && (
                          <span className="text-[8px] bg-emerald-500 text-white font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                            nuevo
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg">
                        <span className="font-mono font-bold text-[11px] text-[#1e4786]">
                          {antCfg?.nombre ?? `Ant. ${tag.antena}`}
                        </span>
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      <span className="font-mono font-bold text-sm text-slate-600 bg-slate-50 px-2 py-0.5 rounded">
                        {tag.contador ?? "—"}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-[11px] font-mono text-slate-500">
                      {formatDate(tag.fecini)}
                    </td>
                    <td className="px-6 py-3.5 text-[11px] font-mono text-slate-500">
                      {formatDate(tag.fecfin)}
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      {onRegisterTag && (
                        <button
                          onClick={() => onRegisterTag(tag.tagid)}
                          className="p-2 text-slate-300 hover:text-[#22c4a1] hover:bg-emerald-50 rounded-lg transition-all"
                          title="Registrar tag"
                        >
                          <Save size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer count */}
      {tags.length > 0 && (
        <div className="px-6 py-3 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-mono">
            {tags.length} tag{tags.length !== 1 ? "s" : ""} detectado{tags.length !== 1 ? "s" : ""}
          </span>
          {isReading && (
            <span className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Actualizando en tiempo real
            </span>
          )}
        </div>
      )}
    </>
  );
}

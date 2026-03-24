"use client";

import { Download, Trash2, WifiOff, Save } from "lucide-react";
import type {
  Tag,
  ReaderConfig,
  ReaderRuntimeState,
  AntennaConfig,
} from "../../../types/rfid";
import { Badge } from "../ui/Badge";

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
  return (
    <>
      {/* Header */}
      <div className="px-8 py-4 bg-slate-50/50 flex justify-between items-center flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="font-bold text-slate-700 flex items-center gap-2">
            Lecturas —{" "}
            <span className="text-[#1e4786]">{reader?.name ?? "—"}</span>
            {activeAntennaCfg ? (
              <>
                <span className="text-slate-300">/</span>
                <span className="text-[#22c4a1]">{activeAntennaCfg.nombre}</span>
              </>
            ) : (
              <span className="text-slate-400 text-xs font-normal">· todas las antenas</span>
            )}
          </h2>
          <Badge
            variant={readerState.status === "reading" ? "reading" : "neutral"}
            pulse={readerState.status === "reading"}
          >
            {readerState.status.toUpperCase()}
          </Badge>
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
            <tr className="text-[11px] uppercase tracking-widest text-slate-400 font-bold">
              <th className="px-8 py-4">#</th>
              <th className="px-8 py-4">EPC / TAG ID</th>
              <th className="px-6 py-4 text-center">Antena</th>
              <th className="px-8 py-4 text-center">Contador</th>
              <th className="px-8 py-4">Hora Inicio</th>
              <th className="px-8 py-4">Hora Fin</th>
              <th className="px-8 py-4 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {tags.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-20 text-center text-slate-400">
                  <div className="flex flex-col items-center gap-2 opacity-40">
                    <WifiOff size={40} />
                    <p className="font-medium">
                      {readerState.status === "disconnected"
                        ? "Reader desconectado — conecta una antena desde arriba"
                        : activeAntennaNum !== null
                          ? `Sin lecturas en ${activeAntennaCfg?.nombre ?? `Antena ${activeAntennaNum}`}`
                          : "Esperando lecturas..."}
                    </p>
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
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex flex-col items-center">
                        <span className="font-mono font-bold text-xs text-[#1e4786]">
                          {antCfg?.nombre ?? `Ant. ${tag.antena}`}
                        </span>
                        <span className="text-[9px] text-slate-400">#{tag.antena}</span>
                      </span>
                    </td>
                    <td className="px-8 py-4 text-center">
                      <span className="font-mono font-bold text-sm text-slate-600">
                        {tag.contador ?? "—"}
                      </span>
                    </td>
                    <td className="px-8 py-4 text-xs font-mono text-slate-500">
                      {formatDate(tag.fecini)}
                    </td>
                    <td className="px-8 py-4 text-xs font-mono text-slate-500">
                      {formatDate(tag.fecfin)}
                    </td>
                    <td className="px-8 py-4 text-center">
                      {onRegisterTag && (
                        <button
                          onClick={() => onRegisterTag(tag.tagid)}
                          className="p-2 text-slate-300 hover:text-[#22c4a1] transition-colors"
                          title="Registrar tag"
                        >
                          <Save size={16} />
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
    </>
  );
}

"use client";

import { Radio } from "lucide-react";
import type {
  ReaderConfig,
  ReaderRuntimeState,
} from "../../../types/rfid";

interface AntennaPanelProps {
  reader: ReaderConfig;
  readerState: ReaderRuntimeState;
  activeAntennaNum: number | null;
  onSelectAntenna: (num: number | null) => void;
}

export function AntennaPanel({
  reader,
  readerState,
  activeAntennaNum,
  onSelectAntenna,
}: AntennaPanelProps) {
  if (!reader || reader.antenas.length === 0) return null;

  const isReading = readerState.status === "reading";

  return (
    <div className="px-5 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-white">
      <div className="flex items-center justify-between mb-2.5 px-0.5">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
          <Radio size={11} className="text-[#1e4786]" />
          Filtrar por antena — {reader.name}
        </p>
        <p className="text-[10px] text-slate-400">
          Selecciona una antena para filtrar lecturas
        </p>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {/* Chip "Todas" */}
        <button
          onClick={() => onSelectAntenna(null)}
          className={`shrink-0 px-4 py-2 rounded-xl text-[11px] font-bold border-2 transition-all ${
            activeAntennaNum === null
              ? "bg-[#1e4786] text-white border-[#1e4786] shadow-md shadow-[#1e4786]/15"
              : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
          }`}
        >
          Todas ({readerState.tags.length})
        </button>

        {reader.antenas.map((ant) => {
          const isSelected = activeAntennaNum === ant.numero;
          const tagCount = readerState.tags.filter((t) => t.antena === ant.numero).length;

          return (
            <button
              key={ant.numero}
              onClick={() => onSelectAntenna(ant.numero)}
              className={`shrink-0 flex items-center gap-2.5 px-4 py-2 rounded-xl border-2 transition-all ${
                isSelected
                  ? "bg-[#1e4786]/5 text-[#1e4786] border-[#1e4786] shadow-md shadow-[#1e4786]/10"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 shadow-sm"
              }`}
            >
              <div className="flex items-center gap-1.5">
                {isReading && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                )}
                <span className="text-[11px] font-bold">{ant.nombre}</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">#{ant.numero}</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center ${
                isSelected
                  ? "bg-[#1e4786] text-white"
                  : tagCount > 0
                    ? "bg-slate-100 text-slate-600"
                    : "bg-slate-50 text-slate-400"
              }`}>
                {tagCount}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { Play, Square, Trash2, Radio } from "lucide-react";

interface ControlBarProps {
  polling: boolean;
  onTogglePolling: () => void;
  onClear: () => void;
}

export function ControlBar({ polling, onTogglePolling, onClear }: ControlBarProps) {
  return (
    <div className="flex flex-col md:flex-row gap-3">
      <button
        onClick={onTogglePolling}
        className={`flex-[2] py-4 rounded-2xl font-black text-white flex items-center justify-center gap-3 transition-all shadow-lg active:scale-[0.98] ${
          polling
            ? "bg-gradient-to-r from-red-500 to-red-600 shadow-red-200/50"
            : "bg-gradient-to-r from-[#22c4a1] to-[#1db892] shadow-emerald-200/50 hover:shadow-emerald-300/50"
        }`}
      >
        {polling ? (
          <>
            <div className="relative">
              <Square fill="white" size={18} />
            </div>
            DETENER LECTURA
            <span className="ml-1 flex items-center gap-1.5 bg-white/20 px-2 py-0.5 rounded-full text-[10px] font-bold">
              <Radio size={10} className="animate-pulse" /> EN VIVO
            </span>
          </>
        ) : (
          <>
            <Play fill="white" size={20} />
            INICIAR LECTURA EN TIEMPO REAL
          </>
        )}
      </button>
      <button
        onClick={onClear}
        className="flex-1 bg-white border-2 border-slate-200 rounded-2xl font-bold text-slate-500 flex items-center justify-center gap-2 hover:bg-slate-50 hover:border-slate-300 transition-all py-4"
      >
        <Trash2 size={18} /> LIMPIAR
      </button>
    </div>
  );
}

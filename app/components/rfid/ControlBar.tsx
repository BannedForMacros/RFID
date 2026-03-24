"use client";

import { Play, Square, Trash2 } from "lucide-react";

interface ControlBarProps {
  polling: boolean;
  onTogglePolling: () => void;
  onClear: () => void;
}

export function ControlBar({ polling, onTogglePolling, onClear }: ControlBarProps) {
  return (
    <div className="flex flex-col md:flex-row gap-4">
      <button
        onClick={onTogglePolling}
        className={`flex-[2] py-4 rounded-2xl font-black text-white flex items-center justify-center gap-3 transition-all shadow-lg active:scale-[0.98] ${
          polling
            ? "bg-red-500 shadow-red-200"
            : "bg-[#22c4a1] shadow-emerald-100 hover:brightness-105"
        }`}
      >
        {polling ? (
          <>
            <Square fill="white" size={20} /> DETENER LECTURA
          </>
        ) : (
          <>
            <Play fill="white" size={20} /> INICIAR LECTURA EN VIVO
          </>
        )}
      </button>
      <button
        onClick={onClear}
        className="flex-1 bg-white border-2 border-slate-200 rounded-2xl font-bold text-slate-500 flex items-center justify-center gap-2 hover:bg-slate-50 transition-all py-4"
      >
        <Trash2 size={20} /> LIMPIAR VISTA
      </button>
    </div>
  );
}

"use client";

import type { ReaderConfig, ReaderRuntimeState, ReaderStatus } from "../../../types/rfid";

const STATUS_DOT: Record<ReaderStatus, string> = {
  disconnected: "bg-slate-300",
  connecting: "bg-yellow-400 animate-pulse",
  connected: "bg-blue-500",
  reading: "bg-emerald-500 animate-pulse",
  error: "bg-red-500",
  testing: "bg-violet-500 animate-pulse",
};

interface ReaderTabsProps {
  readers: ReaderConfig[];
  readerStates: Record<string, ReaderRuntimeState>;
  activeReaderId: string;
  onSelectReader: (id: string) => void;
}

export function ReaderTabs({
  readers,
  readerStates,
  activeReaderId,
  onSelectReader,
}: ReaderTabsProps) {
  return (
    <div className="flex items-end gap-0 border-b border-slate-200 px-4 pt-4 overflow-x-auto">
      {readers.map((reader) => {
        const st = (readerStates[reader.id]?.status ?? "disconnected") as ReaderStatus;
        const count = readerStates[reader.id]?.tags.length ?? 0;
        const isActive = reader.id === activeReaderId;
        return (
          <button
            key={reader.id}
            onClick={() => onSelectReader(reader.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-all -mb-px ${
              isActive
                ? "border-[#1e4786] text-[#1e4786] bg-white"
                : "border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300"
            }`}
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[st]}`} />
            <span>{reader.name}</span>
            <span className="text-[10px] text-slate-400 font-mono">{reader.ip}</span>
            {count > 0 && (
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  isActive ? "bg-[#1e4786] text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}

      {readers.length === 0 && (
        <span className="px-4 py-2.5 text-sm text-slate-400 italic">
          Sin readers — abre Configuración para agregar
        </span>
      )}
    </div>
  );
}

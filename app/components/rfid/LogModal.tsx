"use client";

import Modal from "../Modal";
import type { LogEntry } from "../../../types/rfid";

interface LogModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: LogEntry[];
}

const LOG_COLORS: Record<string, string> = {
  error: "text-red-400",
  success: "text-[#22c4a1]",
  info: "text-blue-400",
  default: "text-slate-400",
};

export function LogModal({ isOpen, onClose, logs }: LogModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Log de Eventos">
      <div className="bg-[#0f172a] rounded-xl p-4 h-80 overflow-y-auto font-mono text-[11px] space-y-1.5 border border-slate-800 shadow-inner">
        {logs.length === 0 && (
          <p className="text-slate-600 italic">— Sin eventos —</p>
        )}
        {logs.map((log, i) => (
          <div key={i} className="flex gap-2">
            <span className="text-slate-500 shrink-0">[{log.time}]</span>
            <span className={LOG_COLORS[log.type] ?? "text-slate-400"}>
              {log.msg}
            </span>
          </div>
        ))}
      </div>
    </Modal>
  );
}

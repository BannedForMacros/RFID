"use client";

import { Wifi, WifiOff, Loader2 } from "lucide-react";
import type { ReaderConfig, ReaderRuntimeState, ReaderStatus } from "../../../types/rfid";

const STATUS_DOT: Record<ReaderStatus, string> = {
  disconnected: "bg-slate-300",
  connecting: "bg-yellow-400 animate-pulse",
  connected: "bg-blue-500",
  reading: "bg-emerald-500 animate-pulse",
  error: "bg-red-500",
  testing: "bg-violet-500 animate-pulse",
};

const STATUS_LABEL: Record<ReaderStatus, string> = {
  disconnected: "Desconectado",
  connecting: "Conectando...",
  connected: "Conectado",
  reading: "Leyendo",
  error: "Error",
  testing: "Probando...",
};

interface ReaderTabsProps {
  readers: ReaderConfig[];
  readerStates: Record<string, ReaderRuntimeState>;
  activeReaderId: string;
  onSelectReader: (id: string) => void;
  onConnect: (id: string) => void;
  onDisconnect: (id: string) => void;
  token: string;
  mockMode: boolean;
}

export function ReaderTabs({
  readers,
  readerStates,
  activeReaderId,
  onSelectReader,
  onConnect,
  onDisconnect,
  token,
  mockMode,
}: ReaderTabsProps) {
  return (
    <div className="border-b border-slate-200">
      {/* Tabs */}
      <div className="flex items-end gap-0 px-5 pt-4 overflow-x-auto">
        {readers.map((reader) => {
          const st = (readerStates[reader.id]?.status ?? "disconnected") as ReaderStatus;
          const count = readerStates[reader.id]?.tags.length ?? 0;
          const isActive = reader.id === activeReaderId;
          return (
            <button
              key={reader.id}
              onClick={() => onSelectReader(reader.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold whitespace-nowrap border-b-[3px] transition-all -mb-px ${
                isActive
                  ? "border-[#1e4786] text-[#1e4786] bg-white"
                  : "border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-200"
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
          <span className="px-4 py-3 text-sm text-slate-400 italic">
            Sin readers — abre Configuración para agregar
          </span>
        )}
      </div>

      {/* Active reader connection bar */}
      {readers.length > 0 && (() => {
        const reader = readers.find((r) => r.id === activeReaderId);
        if (!reader) return null;
        const st = (readerStates[reader.id]?.status ?? "disconnected") as ReaderStatus;
        const isConnected = st === "connected" || st === "reading";
        const isConnecting = st === "connecting";
        const isError = st === "error";

        return (
          <div className="px-5 py-3 flex items-center justify-between bg-slate-50/60">
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold ${
                isConnected
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : isConnecting
                    ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                    : isError
                      ? "bg-red-50 text-red-600 border-red-200"
                      : "bg-slate-100 text-slate-500 border-slate-200"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[st]}`} />
                {STATUS_LABEL[st]}
              </div>
              <span className="text-[11px] text-slate-400">
                {reader.antenas.length} antena{reader.antenas.length !== 1 ? "s" : ""} configurada{reader.antenas.length !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {!isConnected && !isConnecting ? (
                <button
                  onClick={() => onConnect(reader.id)}
                  disabled={isConnecting || (!token && !mockMode) || reader.antenas.length === 0}
                  className="flex items-center gap-2 bg-[#22c4a1] text-white px-5 py-2 rounded-xl text-xs font-bold hover:brightness-105 disabled:opacity-50 transition-all shadow-sm shadow-emerald-200"
                >
                  {isConnecting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Wifi size={14} />
                  )}
                  Conectar Reader
                </button>
              ) : isConnected ? (
                <button
                  onClick={() => onDisconnect(reader.id)}
                  className="flex items-center gap-2 border-2 border-red-200 text-red-500 px-5 py-2 rounded-xl text-xs font-bold hover:bg-red-50 transition-all"
                >
                  <WifiOff size={14} /> Desconectar
                </button>
              ) : null}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

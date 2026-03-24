"use client";

import { Play, Square, Wifi, WifiOff, Loader2 } from "lucide-react";
import type {
  ReaderConfig,
  ReaderRuntimeState,
  AntennaStatus,
} from "../../../types/rfid";

const ANT_DOT: Record<AntennaStatus, string> = {
  disconnected: "bg-slate-300",
  connecting: "bg-yellow-400 animate-pulse",
  connected: "bg-blue-500",
  reading: "bg-emerald-500 animate-pulse",
};

const ANT_COLORS: Record<AntennaStatus, string> = {
  disconnected: "bg-slate-100 text-slate-500 border-slate-200",
  connecting: "bg-yellow-50 text-yellow-600 border-yellow-200",
  connected: "bg-blue-50 text-blue-600 border-blue-200",
  reading: "bg-emerald-50 text-emerald-600 border-emerald-200",
};

const ANT_LABEL: Record<AntennaStatus, string> = {
  disconnected: "DESCONECTADA",
  connecting: "CONECTANDO...",
  connected: "CONECTADA",
  reading: "LEYENDO",
};

interface AntennaPanelProps {
  reader: ReaderConfig;
  readerState: ReaderRuntimeState;
  activeAntennaNum: number | null;
  onSelectAntenna: (num: number | null) => void;
  onConnectAntenna: (readerId: string, antNum: number) => void;
  onDisconnectAntenna: (readerId: string, antNum: number) => void;
  onStartAntenna: (readerId: string, antNum: number) => void;
  onStopAntenna: (readerId: string, antNum: number) => void;
  token: string;
  mockMode: boolean;
}

export function AntennaPanel({
  reader,
  readerState,
  activeAntennaNum,
  onSelectAntenna,
  onConnectAntenna,
  onDisconnectAntenna,
  onStartAntenna,
  onStopAntenna,
  token,
  mockMode,
}: AntennaPanelProps) {
  if (!reader || reader.antenas.length === 0) return null;

  return (
    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/40">
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
          Antenas — {reader.name}
        </p>
        <p className="text-[9px] text-slate-400 italic">
          Haz clic en una antena para filtrar sus lecturas
        </p>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {/* Chip "Todas" */}
        <button
          onClick={() => onSelectAntenna(null)}
          className={`shrink-0 self-start px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
            activeAntennaNum === null
              ? "bg-[#1e4786] text-white border-[#1e4786] shadow"
              : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
          }`}
        >
          Todas
        </button>

        {reader.antenas.map((ant) => {
          const antStatus = (readerState.antenasState[ant.numero]?.status ?? "disconnected") as AntennaStatus;
          const isConn = antStatus === "connected" || antStatus === "reading";
          const isReading = antStatus === "reading";
          const isBusy = antStatus === "connecting";
          const isSelected = activeAntennaNum === ant.numero;
          const tagCount = readerState.tags.filter((t) => t.antena === ant.numero).length;

          return (
            <div
              key={ant.numero}
              onClick={() => onSelectAntenna(ant.numero)}
              className={`shrink-0 border-2 rounded-xl p-3 bg-white min-w-[200px] space-y-2 cursor-pointer transition-all ${
                isSelected
                  ? "border-[#1e4786] shadow-md shadow-[#1e4786]/10"
                  : "border-slate-200 hover:border-slate-300 shadow-sm"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 mt-1 ${ANT_DOT[antStatus]}`} />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-700 leading-tight truncate">
                      {ant.nombre}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Ant. #{ant.numero} · {ant.potencia} dBm
                    </p>
                  </div>
                </div>
                {tagCount > 0 && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                      isSelected ? "bg-[#1e4786] text-white" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {tagCount}
                  </span>
                )}
              </div>

              <div
                className={`text-[9px] font-bold px-2 py-0.5 rounded-full border text-center ${ANT_COLORS[antStatus]}`}
              >
                {ANT_LABEL[antStatus]}
              </div>

              <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                {!isConn ? (
                  <button
                    onClick={() => onConnectAntenna(reader.id, ant.numero)}
                    disabled={isBusy || (!token && !mockMode)}
                    className="flex-1 flex items-center justify-center gap-1 bg-[#22c4a1] text-white text-[10px] font-bold py-1.5 rounded-lg hover:brightness-105 disabled:opacity-50 transition-all"
                  >
                    {isBusy ? (
                      <Loader2 size={10} className="animate-spin" />
                    ) : (
                      <Wifi size={10} />
                    )}
                    {isBusy ? "..." : "Conectar"}
                  </button>
                ) : (
                  <button
                    onClick={() => onDisconnectAntenna(reader.id, ant.numero)}
                    disabled={isReading}
                    className="flex-1 flex items-center justify-center gap-1 border border-red-200 text-red-500 text-[10px] font-bold py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-40 transition-all"
                  >
                    <WifiOff size={10} /> Desconectar
                  </button>
                )}

                {isConn &&
                  (!isReading ? (
                    <button
                      onClick={() => onStartAntenna(reader.id, ant.numero)}
                      className="flex-1 flex items-center justify-center gap-1 bg-[#1e4786] text-white text-[10px] font-bold py-1.5 rounded-lg hover:brightness-105 transition-all"
                    >
                      <Play size={10} fill="white" /> Iniciar
                    </button>
                  ) : (
                    <button
                      onClick={() => onStopAntenna(reader.id, ant.numero)}
                      className="flex-1 flex items-center justify-center gap-1 bg-red-500 text-white text-[10px] font-bold py-1.5 rounded-lg hover:brightness-105 transition-all"
                    >
                      <Square size={10} fill="white" /> Detener
                    </button>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

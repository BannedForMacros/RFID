import React from "react";
import Modal from "./Modal";
import { Monitor, Zap, Clock, Key, Globe, Wifi } from "lucide-react";

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: any;
  setConfig: (config: any) => void;
  onGenerateToken: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  status: string;
  token: string;
}

export const ConfigModal = ({
  isOpen,
  onClose,
  config,
  setConfig,
  onGenerateToken,
  onConnect,
  onDisconnect,
  status,
  token
}: ConfigModalProps) => {
  
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Configuración del Sistema">
      <div className="flex flex-col gap-4">
        
        {/* URL Base */}
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <Globe size={12} /> URL Base (ngrok / local)
          </label>
          <input
            className="w-full p-2 border border-slate-200 rounded-lg text-sm font-sans focus:border-[#22c4a1] outline-none transition-all"
            value={config.baseUrl}
            onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
            placeholder="https://abc123.ngrok.io"
          />
        </div>

        {/* Token Section - Grid idéntico al original */}
        <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <Key size={12} /> Días de validez del token
            </label>
            <input
              type="number"
              className="w-full p-2 border border-slate-200 rounded-lg text-sm"
              value={config.dias}
              min={1}
              max={30}
              onChange={(e) => setConfig({ ...config, dias: Number(e.target.value) })}
            />
          </div>
          <button
            onClick={onGenerateToken}
            className="bg-[#1e4786] text-white px-4 py-2 rounded-lg text-xs font-bold hover:opacity-85 transition-opacity h-[38px]"
          >
            🔑 Generar
          </button>
        </div>

        {/* Token Activo (Si existe) */}
        {token && (
          <div className="bg-[#22c4a1]/10 border border-[#22c4a1]/40 rounded-lg p-3">
            <label className="text-[10px] font-bold text-[#22c4a1] uppercase tracking-wider">Token activo</label>
            <div className="font-mono text-[11px] text-[#22c4a1] break-all leading-tight mt-1">
              {token.substring(0, 65)}...
            </div>
          </div>
        )}

        {/* Separador y Parámetros del Reader */}
        <div className="border-t border-slate-100 pt-4 mt-2">
          <h4 className="text-sm font-bold text-slate-800 mb-4">Parámetros del Reader</h4>
          
          {/* Grid de 3 columnas para IP, Potencia y Tiempo */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight flex items-center gap-1">
                <Monitor size={10} /> IP Reader
              </label>
              <input
                className="w-full p-2 border border-slate-200 rounded-lg text-xs font-mono"
                value={config.ipReader}
                onChange={(e) => setConfig({ ...config, ipReader: e.target.value })}
                placeholder="192.168.1.100"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight flex items-center gap-1">
                <Zap size={10} /> Potencia
              </label>
              <input
                type="number"
                className="w-full p-2 border border-slate-200 rounded-lg text-xs font-mono"
                value={config.potencia}
                min={10}
                max={30}
                onChange={(e) => setConfig({ ...config, potencia: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-tight flex items-center gap-1">
                <Clock size={10} /> T. Lectura
              </label>
              <input
                type="number"
                className="w-full p-2 border border-slate-200 rounded-lg text-xs font-mono"
                value={config.tLectura}
                min={1}
                max={60}
                onChange={(e) => setConfig({ ...config, tLectura: Number(e.target.value) })}
              />
            </div>
          </div>

          {/* Botones de Conexión/Desconexión */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={onConnect}
              disabled={!token || status === "connecting"}
              className="flex-1 bg-[#22c4a1] text-white py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:brightness-105 disabled:opacity-50 transition-all shadow-md shadow-[#22c4a1]/20"
            >
              <Wifi size={16} /> Conectar Reader
            </button>
            <button
              onClick={onDisconnect}
              disabled={status === "disconnected"}
              className="flex-1 border border-red-200 text-red-500 py-2.5 rounded-lg text-sm font-bold hover:bg-red-50 disabled:opacity-30 transition-all"
            >
              ⏹ Desconectar
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
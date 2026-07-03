"use client";

import { AlertTriangle, WifiOff } from "lucide-react";
import Modal from "../Modal";

interface DisconnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  readerName: string;
}

export function DisconnectModal({
  isOpen,
  onClose,
  onConfirm,
  readerName,
}: DisconnectModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Confirmar Desconexión"
      size="sm"
      footer={
        <>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white text-sm font-bold rounded-lg hover:bg-red-600 transition-all shadow-sm"
          >
            <WifiOff size={16} />
            Desconectar
          </button>
        </>
      }
    >
      <div className="flex flex-col items-center text-center p-2">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
          <AlertTriangle size={32} className="text-red-500" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-2">Desconectar Reader</h3>
        <p className="text-sm text-slate-500 leading-relaxed">
          ¿Estás seguro de que deseas desconectar el <span className="font-bold text-slate-700">{readerName}</span>?
        </p>
        <p className="text-xs text-red-500 mt-4 font-semibold">
          Esto detendrá la lectura de tags de este equipo.
        </p>
      </div>
    </Modal>
  );
}

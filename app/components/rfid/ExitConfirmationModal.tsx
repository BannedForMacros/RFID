"use client";

import { AlertTriangle, LogOut, X } from "lucide-react";
import Modal from "../Modal";

interface ExitConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ExitConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
}: ExitConfirmationModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Confirmar Salida"
      size="sm"
      footer={
        <>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors"
          >
            Permanecer aquí
          </button>
          <button
            onClick={onConfirm}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white text-sm font-bold rounded-lg hover:bg-red-600 transition-all shadow-sm"
          >
            <LogOut size={16} />
            Desconectar y Salir
          </button>
        </>
      }
    >
      <div className="flex flex-col items-center text-center p-2">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
          <AlertTriangle size={32} className="text-red-500" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-2">¡Reader Activo!</h3>
        <p className="text-sm text-slate-500 leading-relaxed">
          Todavía tienes un reader conectado o en proceso de lectura. Si sales ahora, se 
          <span className="font-bold text-slate-700"> desconectará automáticamente</span> para evitar conflictos.
        </p>
        <p className="text-xs text-red-500 mt-4 font-semibold">
          ¿Estás seguro de que deseas salir?
        </p>
      </div>
    </Modal>
  );
}

"use client";

import { useState, useEffect } from "react";
import { Save, Loader2 } from "lucide-react";
import Modal from "../Modal";
import { tagService } from "../../services/tagService";
import { useApp } from "../../context/AppContext";

interface TagRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefilledTagId?: string;
}

export function TagRegistrationModal({
  isOpen,
  onClose,
  prefilledTagId = "",
}: TagRegistrationModalProps) {
  const { globalConfig, token, addLog } = useApp();

  const [form, setForm] = useState({
    idTag: prefilledTagId,
    codProducto: "",
    codBarra: "",
    codManual: "",
    descripcion: "",
  });
  const [saving, setSaving] = useState(false);

  // Reset form when modal opens with new tagId
  useEffect(() => {
    if (isOpen && prefilledTagId) {
      setForm({
        idTag: prefilledTagId,
        codProducto: "",
        codBarra: "",
        codManual: "",
        descripcion: "",
      });
    }
  }, [isOpen, prefilledTagId]);

  const handleSave = async () => {
    if (!form.idTag.trim()) {
      addLog("El ID del Tag es obligatorio", "error");
      return;
    }

    setSaving(true);
    try {
      const res = await tagService.insert(globalConfig.baseUrl, token, {
        idTag: form.idTag,
        codProducto: form.codProducto,
        codBarra: form.codBarra,
        codManual: form.codManual,
        descripcion: form.descripcion,
      });

      if (res.codigo === 1) {
        addLog(`Tag ${form.idTag} registrado exitosamente`, "success");
        onClose();
        setForm({ idTag: "", codProducto: "", codBarra: "", codManual: "", descripcion: "" });
      } else {
        addLog(`Error al registrar: ${res.mensaje}`, "error");
      }
    } catch (e: unknown) {
      addLog(`Error al registrar tag: ${(e as Error).message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Registrar Tag"
      size="md"
      footer={
        <>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.idTag.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-[#22c4a1] text-white text-sm font-bold rounded-lg hover:brightness-105 disabled:opacity-50 transition-all"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? "Guardando..." : "Registrar"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            ID Tag *
          </label>
          <input
            className="w-full p-2.5 border border-slate-200 rounded-lg text-sm font-mono focus:border-[#22c4a1] outline-none transition-all bg-slate-50"
            value={form.idTag}
            onChange={(e) => updateField("idTag", e.target.value)}
            placeholder="EPC / Tag ID"
            readOnly={!!prefilledTagId}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Cód. Producto
            </label>
            <input
              className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:border-[#22c4a1] outline-none transition-all"
              value={form.codProducto}
              onChange={(e) => updateField("codProducto", e.target.value)}
              placeholder="Código de producto"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Cód. Barra
            </label>
            <input
              className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:border-[#22c4a1] outline-none transition-all"
              value={form.codBarra}
              onChange={(e) => updateField("codBarra", e.target.value)}
              placeholder="Código de barra"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Cód. Manual
          </label>
          <input
            className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:border-[#22c4a1] outline-none transition-all"
            value={form.codManual}
            onChange={(e) => updateField("codManual", e.target.value)}
            placeholder="Código manual"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Descripción
          </label>
          <textarea
            className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:border-[#22c4a1] outline-none transition-all resize-none"
            rows={3}
            value={form.descripcion}
            onChange={(e) => updateField("descripcion", e.target.value)}
            placeholder="Descripción del tag"
          />
        </div>
      </div>
    </Modal>
  );
}

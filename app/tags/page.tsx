"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Tag,
  Search,
  Plus,
  Edit3,
  Trash2,
  Loader2,
  Save,
  X,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  RotateCcw,
  Ban,
} from "lucide-react";

import { Navbar } from "../components/rfid/Navbar";
import { LogModal } from "../components/rfid/LogModal";
import { ConfigModal } from "../components/ConfigModal";
import Modal from "../components/Modal";
import { useApp } from "../context/AppContext";
import { tagService } from "../services/tagService";
import type { TagRegistro } from "../../types/rfid";

type ModalMode = "create" | "edit" | null;

const EMPTY_FORM: TagRegistro = {
  idTag: "",
  codProducto: "",
  codBarra: "",
  codManual: "",
  descripcion: "",
  estado: "1",
};

const isTagActive = (estado: string | undefined | null) => {
  if (!estado) return false;
  const e = String(estado).trim().toUpperCase();
  // Priorizamos "1", pero mantenemos "A" y "ACTIVO" para compatibilidad con datos existentes si fuera necesario
  return e === "1" || e === "A" || e === "ACTIVO";
};

export default function TagsPage() {
  const {
    globalConfig, setGlobalConfig, token, setToken, logs, addLog,
    readers, readerStates,
    handleAddReader, handleRemoveReader, handleUpdateReader, handleTestReader, handleGenerateToken,
  } = useApp();

  const [tags, setTags] = useState<TagRegistro[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [form, setForm] = useState<TagRegistro>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Modals
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isLogOpen, setIsLogOpen] = useState(false);

  // ── Fetch tags ──
  const fetchTags = useCallback(async () => {
    if (globalConfig.mockMode) {
      addLog("Modo simulación activo — las operaciones de mantenimiento requieren la API real", "info");
      return;
    }
    setLoading(true);
    try {
      const res = await tagService.list(globalConfig.baseUrl, token);
      if (res.codigo === 1) {
        setTags(res.registros ?? []);
        addLog(`${res.registros?.length ?? 0} tags cargados`, "success");
      } else {
        addLog(`Error al listar: ${res.mensaje}`, "error");
      }
    } catch (e: unknown) {
      addLog(`Error cargando tags: ${(e as Error).message}`, "error");
    } finally {
      setLoading(false);
    }
  }, [globalConfig.baseUrl, globalConfig.mockMode, token, addLog]);

  useEffect(() => {
    if (token && !globalConfig.mockMode) fetchTags();
  }, [token, globalConfig.mockMode, fetchTags]);

  // ── Filter & Stats ──
  const activeTags = tags.filter(t => isTagActive(t.estado)).length;
  const inactiveTags = tags.length - activeTags;

  const filteredTags = tags.filter((t) => {
    const isSearchMatch =
      t.idTag.toLowerCase().includes(search.toLowerCase()) ||
      t.descripcion.toLowerCase().includes(search.toLowerCase()) ||
      t.codProducto.toLowerCase().includes(search.toLowerCase()) ||
      t.codBarra.toLowerCase().includes(search.toLowerCase());

    const isActive = isTagActive(t.estado);
    const isInactive = !isActive;

    if (statusFilter === "active" && !isActive) return false;
    if (statusFilter === "inactive" && !isInactive) return false;

    return isSearchMatch;
  });

  // ── CRUD ──
  const openCreate = () => {
    setForm(EMPTY_FORM);
    setModalMode("create");
  };

  const openEdit = (tag: TagRegistro) => {
    setForm({ ...tag });
    setModalMode("edit");
  };

  const handleSave = async () => {
    if (!form.idTag.trim()) {
      addLog("El ID del Tag es obligatorio", "error");
      return;
    }
    setSaving(true);
    try {
      const res =
        modalMode === "create"
          ? await tagService.insert(globalConfig.baseUrl, token, form)
          : await tagService.update(globalConfig.baseUrl, token, form);

      if (res.codigo === 1) {
        addLog(
          `Tag ${form.idTag} ${modalMode === "create" ? "registrado" : "actualizado"} exitosamente`,
          "success"
        );
        setModalMode(null);
        fetchTags();
      } else {
        addLog(`Error: ${res.mensaje}`, "error");
      }
    } catch (e: unknown) {
      addLog(`Error: ${(e as Error).message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (idTag: string) => {
    try {
      const res = await tagService.remove(globalConfig.baseUrl, token, idTag);
      if (res.codigo === 1) {
        addLog(`Tag ${idTag} eliminado`, "success");
        fetchTags();
      } else {
        addLog(`Error al eliminar: ${res.mensaje}`, "error");
      }
    } catch (e: unknown) {
      addLog(`Error: ${(e as Error).message}`, "error");
    }
  };

  const handleToggleState = async (tag: TagRegistro) => {
    // 1. Actualización Visual Optimista Inmediata
    const isCurrentlyActive = isTagActive(tag.estado);
    const newEstado = isCurrentlyActive ? "0" : "1";

    setTags((prev) =>
      prev.map((t) =>
        t.idTag === tag.idTag ? { ...t, estado: newEstado } : t
      )
    );

    // 2. Notificar al backend de forma asíncrona
    try {
      const res = await tagService.toggleState(globalConfig.baseUrl, token, tag.idTag, newEstado);
      if (Number(res.codigo) === 1 || Number(res.codigo) === 0) {
        addLog(`Estado de ${tag.idTag} guardado en backend`, "success");
      } else {
        addLog(`Notificación backend: ${res.mensaje || "Respuesta inusual al cambiar estado"}`, "error");
      }
    } catch (e: unknown) {
      addLog(`Error de conexión al guardar el estado: ${(e as Error).message}`, "error");
    }
  };

  const updateField = (field: keyof TagRegistro, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const estadoLabel = (estado: string) => {
    if (estado === "1" || estado === "A") return { text: "ACTIVO", cls: "bg-emerald-50 text-emerald-600 border-emerald-200" };
    if (estado === "0" || estado === "I") return { text: "INACTIVO", cls: "bg-red-50 text-red-500 border-red-200" };
    return { text: estado.toUpperCase(), cls: "bg-slate-100 text-slate-500 border-slate-200" };
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a]">
      <Navbar
        readersCount={readers.length}
        mockMode={globalConfig.mockMode}
        logsCount={logs.length}
        onOpenLogs={() => setIsLogOpen(true)}
        onOpenConfig={() => setIsConfigOpen(true)}
      />

      <main className="max-w-7xl mx-auto p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-[#1e4786] flex items-center gap-2">
              <Tag size={24} /> Mantenimiento de Tags
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Gestiona los tags RFID registrados — editar, inactivar o eliminar
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchTags}
              disabled={loading || globalConfig.mockMode}
              className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-xs font-semibold hover:bg-slate-50 disabled:opacity-40 transition-all"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refrescar
            </button>
            <button
              onClick={openCreate}
              disabled={globalConfig.mockMode}
              className="flex items-center gap-1.5 bg-[#22c4a1] text-white px-4 py-2 rounded-lg text-sm font-bold hover:brightness-105 disabled:opacity-50 transition-all"
            >
              <Plus size={16} /> Nuevo Tag
            </button>
          </div>
        </div>

        {/* Mock mode warning */}
        {globalConfig.mockMode && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <AlertCircle size={20} className="text-amber-500 shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-800">Modo Simulación</p>
              <p className="text-xs text-amber-600">
                El mantenimiento de tags requiere conexión a la API real. Desactiva el modo simulación en Configuración.
              </p>
            </div>
          </div>
        )}

        {/* Stats Cards / Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatBox
            label="Total Registrados"
            value={tags.length}
            icon={<Tag size={18} className="text-[#1e4786]" />}
            color="#1e4786"
            onClick={() => setStatusFilter("all")}
            isSelected={statusFilter === "all"}
          />
          <StatBox
            label="Activos"
            value={activeTags}
            icon={<CheckCircle size={18} className="text-emerald-500" />}
            color="#22c4a1"
            onClick={() => setStatusFilter("active")}
            isSelected={statusFilter === "active"}
          />
          <StatBox
            label="Inactivos"
            value={inactiveTags}
            icon={<AlertCircle size={18} className="text-red-500" />}
            color="#ef4444"
            alert={inactiveTags > 0}
            onClick={() => setStatusFilter("inactive")}
            isSelected={statusFilter === "inactive"}
          />
        </div>

        {/* Search */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-[#22c4a1] outline-none transition-all bg-white"
              placeholder="Buscar por ID, descripción, código de producto o código de barra..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Table Area */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Table Header / Title */}
          <div className="px-6 py-4 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-[#1e4786] flex items-center gap-2">
                {statusFilter === "active" && <CheckCircle size={18} className="text-emerald-500" />}
                {statusFilter === "inactive" && <AlertCircle size={18} className="text-red-500" />}
                {statusFilter === "all" && <Tag size={18} />}
                Mostrando: {statusFilter === "all" ? "Todos los Tags" : statusFilter === "active" ? "Solo Activos" : "Solo Inactivos"}
              </span>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[11px] uppercase tracking-widest text-slate-400 font-bold bg-slate-50/80">
                  <th className="px-6 py-4">#</th>
                  <th className="px-6 py-4">ID Tag</th>
                  <th className="px-6 py-4">Cód. Producto</th>
                  <th className="px-6 py-4">Cód. Barra</th>
                  <th className="px-6 py-4">Cód. Manual</th>
                  <th className="px-6 py-4">Descripción</th>
                  <th className="px-6 py-4 text-center">Estado</th>
                  <th className="px-6 py-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-20 text-center">
                      <Loader2 size={32} className="animate-spin text-[#22c4a1] mx-auto" />
                      <p className="text-sm text-slate-400 mt-2">Cargando tags...</p>
                    </td>
                  </tr>
                ) : filteredTags.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-20 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2 opacity-40">
                        <Tag size={40} />
                        <p className="font-medium">
                          {tags.length === 0
                            ? "No hay tags registrados"
                            : "No se encontraron resultados"}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredTags.map((tag, idx) => {
                    const est = estadoLabel(tag.estado);
                    return (
                      <tr key={tag.idTag} className="group hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 text-xs font-mono text-slate-400">{idx + 1}</td>
                        <td className="px-6 py-4">
                          <span className="font-mono font-bold text-sm text-[#1e4786]">
                            {tag.idTag}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{tag.codProducto || "—"}</td>
                        <td className="px-6 py-4 text-sm font-mono text-slate-600">
                          {tag.codBarra || "—"}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{tag.codManual || "—"}</td>
                        <td className="px-6 py-4 text-sm text-slate-600 max-w-[200px] truncate">
                          {tag.descripcion || "—"}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => handleToggleState(tag)}
                            title={`Click para ${isTagActive(tag.estado) ? "Inactivar" : "Activar"}`}
                            className={`group/badge inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border transition-all hover:scale-105 active:scale-95 ${est.cls}`}
                          >
                            <span className="relative flex h-2 w-2">
                              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isTagActive(tag.estado) ? "bg-emerald-400" : "bg-red-400"}`}></span>
                              <span className={`relative inline-flex rounded-full h-2 w-2 ${isTagActive(tag.estado) ? "bg-emerald-500" : "bg-red-500"}`}></span>
                            </span>
                            {est.text}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                                onClick={() => openEdit(tag)}
                                className="p-2 text-slate-400 hover:text-[#1e4786] hover:bg-slate-100 rounded-lg transition-colors border border-transparent hover:border-slate-200"
                                title="Editar"
                              >
                                <Edit3 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer count */}
          {!loading && filteredTags.length > 0 && (
            <div className="px-6 py-3 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-mono">
                {filteredTags.length} de {tags.length} tag(s)
              </span>
              <div className="flex items-center gap-3 text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <CheckCircle size={11} className="text-emerald-500" />
                  {activeTags} activos
                </span>
                <span className="flex items-center gap-1">
                  <AlertCircle size={11} className="text-red-400" />
                  {inactiveTags} inactivos
                </span>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={modalMode !== null}
        onClose={() => setModalMode(null)}
        title={modalMode === "create" ? "Registrar Nuevo Tag" : "Editar Tag"}
        size="md"
        footer={
          <>
            <button
              onClick={() => setModalMode(null)}
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
              {saving ? "Guardando..." : modalMode === "create" ? "Registrar" : "Actualizar"}
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
              readOnly={modalMode === "edit"}
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

          {modalMode === "edit" && (
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Estado
              </label>
              <select
                className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:border-[#22c4a1] outline-none transition-all"
                value={form.estado}
                onChange={(e) => updateField("estado", e.target.value)}
              >
                <option value="1">Activo</option>
                <option value="0">Inactivo</option>
              </select>
            </div>
          )}
        </div>
      </Modal>

      <LogModal isOpen={isLogOpen} onClose={() => setIsLogOpen(false)} logs={logs} />

      <ConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        globalConfig={globalConfig}
        setGlobalConfig={setGlobalConfig}
        readers={readers}
        readerStates={readerStates}
        onGenerateToken={handleGenerateToken}
        onAddReader={handleAddReader}
        onRemoveReader={handleRemoveReader}
        onUpdateReader={handleUpdateReader}
        onTestReader={handleTestReader}
        token={token}
      />

      <footer className="py-8 text-center text-slate-400 text-[10px] font-mono tracking-[0.2em] uppercase">
        DBPERU RFID Systems · v2.0
      </footer>
    </div>
  );
}

// ── Stat Box Component ──
function StatBox({
  label,
  value,
  icon,
  color,
  alert,
  onClick,
  isSelected,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  alert?: boolean;
  onClick?: () => void;
  isSelected?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-white p-5 rounded-xl border transition-all duration-200 ${
        onClick ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5" : "shadow-sm"
      }`}
      style={{
        borderColor: isSelected ? color : alert ? "rgb(252, 165, 165)" : "rgb(226, 232, 240)",
        boxShadow: isSelected ? `0 0 0 1px ${color}` : undefined,
        backgroundColor: alert && !isSelected ? "rgba(254, 242, 242, 0.5)" : "white"
      }}
    >
      <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-mono" style={{ color: isSelected ? color : undefined, opacity: isSelected ? 0.8 : 1 }}>
        {icon} {label}
      </div>
      <div className="text-3xl font-extrabold font-mono" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

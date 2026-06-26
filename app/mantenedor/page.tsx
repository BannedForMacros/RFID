"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Server,
  Antenna,
  Search,
  Plus,
  Edit3,
  Trash2,
  Loader2,
  Save,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  X,
} from "lucide-react";

import { Navbar } from "../components/rfid/Navbar";
import { LogModal } from "../components/rfid/LogModal";
import { ConfigModal } from "../components/ConfigModal";
import Modal from "../components/Modal";
import { useApp } from "../context/AppContext";
import { readerManteService } from "../services/readerManteService";
import { antenaManteService } from "../services/antenaManteService";
import type { ReaderMante, AntenaMante } from "../../types/rfid";

type SubTab = "readers" | "antenas";
type ModalMode = "create" | "edit" | null;

const estadoLabel = (estado: string) => {
  if (estado === "1" || estado === "A")
    return { text: "ACTIVO", cls: "bg-emerald-50 text-emerald-600 border-emerald-200" };
  if (estado === "0" || estado === "I")
    return { text: "INACTIVO", cls: "bg-red-50 text-red-500 border-red-200" };
  return { text: (estado || "—").toUpperCase(), cls: "bg-slate-100 text-slate-500 border-slate-200" };
};

// ── Formularios ──
interface ReaderForm {
  id: number;
  ip: string;
  descripcion: string;
  estado: string;
}
const EMPTY_READER: ReaderForm = { id: 0, ip: "", descripcion: "", estado: "1" };

interface AntenaForm {
  id_antena: number;
  ip_reader: string;
  num_antena: number;
  descripcion: string;
  potencia: number;
  estado: string;
}
const EMPTY_ANTENA: AntenaForm = {
  id_antena: 0,
  ip_reader: "",
  num_antena: 1,
  descripcion: "",
  potencia: 50,
  estado: "1",
};

export default function MantenedorPage() {
  const {
    globalConfig, setGlobalConfig, token, logs, addLog,
    readers, readerStates, reloadReaders,
    handleTestReader, handleGenerateToken,
  } = useApp();

  const [tab, setTab] = useState<SubTab>("readers");

  // Datos
  const [readerList, setReaderList] = useState<ReaderMante[]>([]);
  const [antenaList, setAntenaList] = useState<AntenaMante[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  // Modales
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [readerForm, setReaderForm] = useState<ReaderForm>(EMPTY_READER);
  const [antenaForm, setAntenaForm] = useState<AntenaForm>(EMPTY_ANTENA);
  const [saving, setSaving] = useState(false);

  const mock = globalConfig.mockMode;

  // ── Toast visible (además del log) ──
  type ToastType = "success" | "error" | "info";
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // notify = muestra el mensaje en pantalla (toast) Y lo guarda en el log.
  const notify = useCallback(
    (msg: string, type: ToastType = "info") => {
      addLog(msg, type);
      setToast({ msg, type });
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 6000);
    },
    [addLog]
  );
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  // ── Carga de datos ──
  const fetchReaders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await readerManteService.list(globalConfig.baseUrl, token, mock);
      if (res.codigo === 1) {
        setReaderList(res.listareader ?? []);
        notify(`${res.listareader?.length ?? 0} reader(s) cargados`, "success");
      } else {
        notify(`Error al listar readers: ${res.mensaje}`, "error");
      }
    } catch (e: unknown) {
      notify(`Error cargando readers: ${(e as Error).message}`, "error");
    } finally {
      setLoading(false);
    }
  }, [mock, globalConfig.baseUrl, token, notify]);

  const fetchAntenas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await antenaManteService.list(globalConfig.baseUrl, token, mock);
      if (res.codigo === 1) {
        setAntenaList(res.antenas ?? []);
        notify(`${res.antenas?.length ?? 0} antena(s) cargadas`, "success");
      } else {
        notify(`Error al listar antenas: ${res.mensaje}`, "error");
      }
    } catch (e: unknown) {
      notify(`Error cargando antenas: ${(e as Error).message}`, "error");
    } finally {
      setLoading(false);
    }
  }, [mock, globalConfig.baseUrl, token, notify]);

  const refresh = useCallback(() => {
    if (tab === "readers") fetchReaders();
    else fetchAntenas();
  }, [tab, fetchReaders, fetchAntenas]);

  // Los readers se cargan SIEMPRE al entrar (el listado no requiere token).
  // La pestaña Readers los lista y el modal de Antenas los necesita para el select.
  useEffect(() => {
    fetchReaders();
    if (tab === "antenas") fetchAntenas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, mock, tab]);

  // ── Abrir modales ──
  const openCreate = () => {
    if (tab === "readers") {
      setReaderForm(EMPTY_READER);
    } else {
      // Preseleccionamos el primer reader disponible para minimizar el esfuerzo.
      setAntenaForm({ ...EMPTY_ANTENA, ip_reader: readerList[0]?.ip ?? "" });
    }
    setModalMode("create");
  };

  const openEditReader = (r: ReaderMante) => {
    setReaderForm({ id: r.id, ip: r.ip, descripcion: r.descripcion, estado: r.estado });
    setModalMode("edit");
  };

  const openEditAntena = (a: AntenaMante) => {
    // El response trae id_reader (numérico), no la IP. La resolvemos contra la
    // lista de readers para dejar el select correctamente preseleccionado.
    const matched = readerList.find((r) => r.id === a.id_reader);
    setAntenaForm({
      id_antena: a.id,
      ip_reader: matched?.ip ?? "",
      num_antena: a.antena_number,
      descripcion: a.descripcion,
      potencia: a.potencia,
      estado: a.estado,
    });
    setModalMode("edit");
  };

  // ── Guardar ──
  const handleSaveReader = async () => {
    if (!readerForm.ip.trim()) {
      notify("La IP del reader es obligatoria", "error");
      return;
    }
    setSaving(true);
    try {
      const res =
        modalMode === "create"
          ? await readerManteService.insert(globalConfig.baseUrl, token, {
              ip: readerForm.ip.trim(),
              descripcion: readerForm.descripcion,
              estado: readerForm.estado,
            })
          : await readerManteService.update(globalConfig.baseUrl, token, {
              id: readerForm.id,
              ip: readerForm.ip.trim(),
              descripcion: readerForm.descripcion,
              estado: readerForm.estado,
            });
      if (res.codigo === 1) {
        notify(
          `Reader ${readerForm.ip} ${modalMode === "create" ? "registrado" : "actualizado"}` +
            (res.mensaje ? ` — ${res.mensaje}` : ""),
          "success"
        );
        setModalMode(null);
        fetchReaders();
        reloadReaders(); // refresca Lectura/Validación
      } else {
        notify(`Error: ${res.mensaje}`, "error");
      }
    } catch (e: unknown) {
      notify(`Error: ${(e as Error).message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAntena = async () => {
    if (!antenaForm.ip_reader.trim()) {
      notify("La IP del reader es obligatoria", "error");
      return;
    }
    if (antenaForm.potencia < 0 || antenaForm.potencia > 100) {
      notify("La potencia debe estar entre 0 y 100 %", "error");
      return;
    }
    setSaving(true);
    try {
      const res =
        modalMode === "create"
          ? await antenaManteService.insert(globalConfig.baseUrl, token, {
              ip_reader: antenaForm.ip_reader.trim(),
              num_antena: antenaForm.num_antena,
              descripcion: antenaForm.descripcion,
              potencia: antenaForm.potencia,
              estado: antenaForm.estado,
            })
          : await antenaManteService.update(globalConfig.baseUrl, token, {
              id_antena: antenaForm.id_antena,
              ip_reader: antenaForm.ip_reader.trim(),
              num_antena: antenaForm.num_antena,
              descripcion: antenaForm.descripcion,
              potencia: antenaForm.potencia,
              estado: antenaForm.estado,
            });
      if (res.codigo === 1) {
        notify(
          `Antena ${antenaForm.num_antena} ${modalMode === "create" ? "registrada" : "actualizada"}` +
            (res.mensaje ? ` — ${res.mensaje}` : ""),
          "success"
        );
        setModalMode(null);
        fetchAntenas();
        reloadReaders(); // refresca Lectura/Validación
      } else {
        notify(`Error: ${res.mensaje}`, "error");
      }
    } catch (e: unknown) {
      notify(`Error: ${(e as Error).message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Eliminar ──
  const handleDeleteReader = async (r: ReaderMante) => {
    if (!window.confirm(`¿Eliminar el reader ${r.ip}?`)) return;
    try {
      const res = await readerManteService.remove(globalConfig.baseUrl, token, r.ip);
      if (res.codigo === 1) {
        notify(`Reader ${r.ip} eliminado`, "success");
        fetchReaders();
        reloadReaders(); // refresca Lectura/Validación
      } else {
        notify(`Error al eliminar: ${res.mensaje}`, "error");
      }
    } catch (e: unknown) {
      notify(`Error: ${(e as Error).message}`, "error");
    }
  };

  const handleDeleteAntena = async (a: AntenaMante) => {
    if (!window.confirm(`¿Eliminar la antena ${a.antena_number} (id ${a.id})?`)) return;
    try {
      const res = await antenaManteService.remove(globalConfig.baseUrl, token, a.id);
      if (res.codigo === 1) {
        notify(`Antena ${a.antena_number} eliminada`, "success");
        fetchAntenas();
        reloadReaders(); // refresca Lectura/Validación
      } else {
        notify(`Error al eliminar: ${res.mensaje}`, "error");
      }
    } catch (e: unknown) {
      notify(`Error: ${(e as Error).message}`, "error");
    }
  };

  // ── Filtros ──
  const q = search.toLowerCase();
  const filteredReaders = readerList.filter(
    (r) => r.ip.toLowerCase().includes(q) || (r.descripcion ?? "").toLowerCase().includes(q)
  );
  const filteredAntenas = antenaList.filter(
    (a) =>
      String(a.antena_number).includes(q) ||
      (a.descripcion ?? "").toLowerCase().includes(q) ||
      String(a.id_reader).includes(q)
  );

  const count = tab === "readers" ? readerList.length : antenaList.length;
  const filteredCount = tab === "readers" ? filteredReaders.length : filteredAntenas.length;

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
              <Server size={24} /> Mantenedor
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Administra los readers y sus antenas registrados en el sistema
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={refresh}
              disabled={loading || mock}
              className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-xs font-semibold hover:bg-slate-50 disabled:opacity-40 transition-all"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refrescar
            </button>
            <button
              onClick={openCreate}
              disabled={mock}
              className="flex items-center gap-1.5 bg-[#22c4a1] text-white px-4 py-2 rounded-lg text-sm font-bold hover:brightness-105 disabled:opacity-50 transition-all"
            >
              <Plus size={16} /> {tab === "readers" ? "Nuevo Reader" : "Nueva Antena"}
            </button>
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 w-fit shadow-sm">
          {([
            { key: "readers", label: "Readers", icon: Server },
            { key: "antenas", label: "Antenas", icon: Antenna },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => { setTab(key); setSearch(""); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === key
                  ? "bg-[#1e4786] text-white shadow"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>

        {/* Mock mode warning */}
        {mock && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <AlertCircle size={20} className="text-amber-500 shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-800">Modo Simulación</p>
              <p className="text-xs text-amber-600">
                El mantenedor requiere conexión a la API real. Desactiva el modo simulación en Configuración.
              </p>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-[#22c4a1] outline-none transition-all bg-white"
            placeholder={tab === "readers" ? "Buscar por IP o descripción..." : "Buscar por N° antena, descripción o id reader..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            {tab === "readers" ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[11px] uppercase tracking-widest text-slate-400 font-bold bg-slate-50/80">
                    <th className="px-6 py-4">#</th>
                    <th className="px-6 py-4">ID</th>
                    <th className="px-6 py-4">IP</th>
                    <th className="px-6 py-4">Descripción</th>
                    <th className="px-6 py-4 text-center">Estado</th>
                    <th className="px-6 py-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <LoadingRow cols={6} label="Cargando readers..." />
                  ) : filteredReaders.length === 0 ? (
                    <EmptyRow cols={6} icon={<Server size={40} />} empty={readerList.length === 0} />
                  ) : (
                    filteredReaders.map((r, idx) => {
                      const est = estadoLabel(r.estado);
                      return (
                        <tr key={r.id} className="group hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 text-xs font-mono text-slate-400">{idx + 1}</td>
                          <td className="px-6 py-4 text-sm font-mono text-slate-500">{r.id}</td>
                          <td className="px-6 py-4">
                            <span className="font-mono font-bold text-sm text-[#1e4786]">{r.ip}</span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600 max-w-[260px] truncate">
                            {r.descripcion || "—"}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold border ${est.cls}`}>
                              {est.text}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => openEditReader(r)}
                                className="p-2 text-slate-400 hover:text-[#1e4786] hover:bg-slate-100 rounded-lg transition-colors"
                                title="Editar"
                              >
                                <Edit3 size={16} />
                              </button>
                              <button
                                onClick={() => handleDeleteReader(r)}
                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Eliminar"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[11px] uppercase tracking-widest text-slate-400 font-bold bg-slate-50/80">
                    <th className="px-6 py-4">#</th>
                    <th className="px-6 py-4">ID</th>
                    <th className="px-6 py-4">ID Reader</th>
                    <th className="px-6 py-4">N° Antena</th>
                    <th className="px-6 py-4">Descripción</th>
                    <th className="px-6 py-4 text-center">Potencia</th>
                    <th className="px-6 py-4 text-center">Estado</th>
                    <th className="px-6 py-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <LoadingRow cols={8} label="Cargando antenas..." />
                  ) : filteredAntenas.length === 0 ? (
                    <EmptyRow cols={8} icon={<Antenna size={40} />} empty={antenaList.length === 0} />
                  ) : (
                    filteredAntenas.map((a, idx) => {
                      const est = estadoLabel(a.estado);
                      return (
                        <tr key={a.id} className="group hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 text-xs font-mono text-slate-400">{idx + 1}</td>
                          <td className="px-6 py-4 text-sm font-mono text-slate-500">{a.id}</td>
                          <td className="px-6 py-4 text-sm font-mono text-slate-500">{a.id_reader}</td>
                          <td className="px-6 py-4">
                            <span className="font-mono font-bold text-sm text-[#1e4786]">{a.antena_number}</span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600 max-w-[220px] truncate">
                            {a.descripcion || "—"}
                          </td>
                          <td className="px-6 py-4 text-center text-sm font-mono text-slate-600">
                            {a.potencia}%
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold border ${est.cls}`}>
                              {est.text}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => openEditAntena(a)}
                                className="p-2 text-slate-400 hover:text-[#1e4786] hover:bg-slate-100 rounded-lg transition-colors"
                                title="Editar"
                              >
                                <Edit3 size={16} />
                              </button>
                              <button
                                onClick={() => handleDeleteAntena(a)}
                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Eliminar"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>

          {!loading && filteredCount > 0 && (
            <div className="px-6 py-3 bg-slate-50/50 border-t border-slate-100">
              <span className="text-[11px] text-slate-400 font-mono">
                {filteredCount} de {count} {tab === "readers" ? "reader(s)" : "antena(s)"}
              </span>
            </div>
          )}
        </div>
      </main>

      {/* Toast visible — muestra el mensaje de la API */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[200] max-w-md animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div
            className={`flex items-start gap-3 px-4 py-3 rounded-xl shadow-2xl border text-sm font-semibold ${
              toast.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : toast.type === "error"
                ? "bg-red-50 border-red-200 text-red-700"
                : "bg-slate-50 border-slate-200 text-slate-700"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle size={18} className="shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
            )}
            <span className="flex-1 break-words">{toast.msg}</span>
            <button
              onClick={() => setToast(null)}
              className="shrink-0 opacity-50 hover:opacity-100 transition-opacity"
              title="Cerrar"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Modal Reader */}
      <Modal
        isOpen={modalMode !== null && tab === "readers"}
        onClose={() => setModalMode(null)}
        title={modalMode === "create" ? "Registrar Nuevo Reader" : "Editar Reader"}
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
              onClick={handleSaveReader}
              disabled={saving || !readerForm.ip.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-[#22c4a1] text-white text-sm font-bold rounded-lg hover:brightness-105 disabled:opacity-50 transition-all"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? "Guardando..." : modalMode === "create" ? "Registrar" : "Actualizar"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="IP del Reader *">
            <input
              className="w-full p-2.5 border border-slate-200 rounded-lg text-sm font-mono focus:border-[#22c4a1] outline-none transition-all bg-slate-50"
              value={readerForm.ip}
              onChange={(e) => setReaderForm((p) => ({ ...p, ip: e.target.value }))}
              placeholder="192.168.10.1"
            />
          </Field>
          <Field label="Descripción">
            <input
              className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:border-[#22c4a1] outline-none transition-all"
              value={readerForm.descripcion}
              onChange={(e) => setReaderForm((p) => ({ ...p, descripcion: e.target.value }))}
              placeholder="Nombre o ubicación del reader"
            />
          </Field>
          <Field label="Estado">
            <select
              className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:border-[#22c4a1] outline-none transition-all"
              value={readerForm.estado}
              onChange={(e) => setReaderForm((p) => ({ ...p, estado: e.target.value }))}
            >
              <option value="1">Activo</option>
              <option value="0">Inactivo</option>
            </select>
          </Field>
        </div>
      </Modal>

      {/* Modal Antena */}
      <Modal
        isOpen={modalMode !== null && tab === "antenas"}
        onClose={() => setModalMode(null)}
        title={modalMode === "create" ? "Registrar Nueva Antena" : "Editar Antena"}
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
              onClick={handleSaveAntena}
              disabled={saving || !antenaForm.ip_reader.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-[#22c4a1] text-white text-sm font-bold rounded-lg hover:brightness-105 disabled:opacity-50 transition-all"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? "Guardando..." : modalMode === "create" ? "Registrar" : "Actualizar"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Reader *">
            <select
              className="w-full p-2.5 border border-slate-200 rounded-lg text-sm font-mono focus:border-[#22c4a1] outline-none transition-all bg-slate-50 disabled:opacity-60"
              value={antenaForm.ip_reader}
              onChange={(e) => setAntenaForm((p) => ({ ...p, ip_reader: e.target.value }))}
              disabled={readerList.length === 0}
            >
              {readerList.length === 0 && <option value="">— Sin readers registrados —</option>}
              {readerList.map((r) => (
                <option key={r.id} value={r.ip}>
                  {r.ip}{r.descripcion ? ` · ${r.descripcion}` : ""}
                </option>
              ))}
            </select>
            {readerList.length === 0 && (
              <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1">
                <AlertCircle size={12} /> Registra un reader antes de crear antenas.
              </p>
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="N° Antena">
              <input
                type="number"
                min={1}
                className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:border-[#22c4a1] outline-none transition-all"
                value={antenaForm.num_antena}
                onChange={(e) => setAntenaForm((p) => ({ ...p, num_antena: Number(e.target.value) }))}
              />
            </Field>
            <Field label="Potencia (%)">
              <input
                type="number"
                min={0}
                max={100}
                className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:border-[#22c4a1] outline-none transition-all"
                value={antenaForm.potencia}
                onChange={(e) => setAntenaForm((p) => ({ ...p, potencia: Number(e.target.value) }))}
              />
            </Field>
          </div>
          <Field label="Descripción">
            <input
              className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:border-[#22c4a1] outline-none transition-all"
              value={antenaForm.descripcion}
              onChange={(e) => setAntenaForm((p) => ({ ...p, descripcion: e.target.value }))}
              placeholder="Descripción de la antena"
            />
          </Field>
          <Field label="Estado">
            <select
              className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:border-[#22c4a1] outline-none transition-all"
              value={antenaForm.estado}
              onChange={(e) => setAntenaForm((p) => ({ ...p, estado: e.target.value }))}
            >
              <option value="1">Activo</option>
              <option value="0">Inactivo</option>
            </select>
          </Field>
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
        onTestReader={handleTestReader}
        token={token}
      />

      <footer className="py-8 text-center text-slate-400 text-[10px] font-mono tracking-[0.2em] uppercase">
        DBPERU RFID Systems · v2.0
      </footer>
    </div>
  );
}

// ── Helpers UI ──
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

function LoadingRow({ cols, label }: { cols: number; label: string }) {
  return (
    <tr>
      <td colSpan={cols} className="py-20 text-center">
        <Loader2 size={32} className="animate-spin text-[#22c4a1] mx-auto" />
        <p className="text-sm text-slate-400 mt-2">{label}</p>
      </td>
    </tr>
  );
}

function EmptyRow({ cols, icon, empty }: { cols: number; icon: React.ReactNode; empty: boolean }) {
  return (
    <tr>
      <td colSpan={cols} className="py-20 text-center text-slate-400">
        <div className="flex flex-col items-center gap-2 opacity-40">
          {icon}
          <p className="font-medium">{empty ? "No hay registros" : "No se encontraron resultados"}</p>
        </div>
      </td>
    </tr>
  );
}

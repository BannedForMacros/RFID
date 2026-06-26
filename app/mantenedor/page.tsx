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
  ChevronDown,
  ChevronRight,
  Zap,
} from "lucide-react";

import { Navbar } from "../components/rfid/Navbar";
import { LogModal } from "../components/rfid/LogModal";
import { ConfigModal } from "../components/ConfigModal";
import Modal from "../components/Modal";
import { useApp } from "../context/AppContext";
import { readerManteService } from "../services/readerManteService";
import { antenaManteService } from "../services/antenaManteService";
import { confirmDelete } from "../lib/alerts";
import type { ReaderMante, AntenaMante } from "../../types/rfid";

type ModalMode = "create" | "edit" | null;
type ToastType = "success" | "error" | "info";

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

  // Datos
  const [readerList, setReaderList] = useState<ReaderMante[]>([]);
  const [antenaList, setAntenaList] = useState<AntenaMante[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set()); // readers desplegados

  // Modales
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [readerModal, setReaderModal] = useState<ModalMode>(null);
  const [antenaModal, setAntenaModal] = useState<ModalMode>(null);
  const [readerForm, setReaderForm] = useState<ReaderForm>(EMPTY_READER);
  const [antenaForm, setAntenaForm] = useState<AntenaForm>(EMPTY_ANTENA);
  const [saving, setSaving] = useState(false);

  const mock = globalConfig.mockMode;

  // ── Toast visible (además del log) ──
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  // ── Carga (readers + antenas en una sola pasada) ──
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, aRes] = await Promise.all([
        readerManteService.list(globalConfig.baseUrl, token, mock),
        antenaManteService.list(globalConfig.baseUrl, token, mock),
      ]);
      if (rRes.codigo === 1) setReaderList(rRes.listareader ?? []);
      else notify(`Error al listar readers: ${rRes.mensaje}`, "error");
      if (aRes.codigo === 1) setAntenaList(aRes.antenas ?? []);
      else notify(`Error al listar antenas: ${aRes.mensaje}`, "error");
    } catch (e: unknown) {
      notify(`Error cargando datos: ${(e as Error).message}`, "error");
    } finally {
      setLoading(false);
    }
  }, [globalConfig.baseUrl, token, mock, notify]);

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, mock]);

  // ── Helpers ──
  const readerById = (id: number) => readerList.find((r) => r.id === id);
  const antenasOf = (readerId: number) =>
    antenaList
      .filter((a) => a.id_reader === readerId)
      .sort((a, b) => a.antena_number - b.antena_number);
  const toggle = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // ── Abrir modales ──
  const openCreateReader = () => {
    setReaderForm(EMPTY_READER);
    setReaderModal("create");
  };
  const openEditReader = (r: ReaderMante) => {
    setReaderForm({ id: r.id, ip: r.ip, descripcion: r.descripcion, estado: r.estado });
    setReaderModal("edit");
  };
  const openCreateAntena = (r: ReaderMante) => {
    // El reader ya está fijado (no se elige a mano). Sugerimos el siguiente N° libre.
    const nums = antenasOf(r.id).map((a) => a.antena_number);
    const next = nums.length ? Math.max(...nums) + 1 : 1;
    setAntenaForm({ ...EMPTY_ANTENA, ip_reader: r.ip, num_antena: next });
    setAntenaModal("create");
  };
  const openEditAntena = (a: AntenaMante) => {
    const r = readerById(a.id_reader);
    setAntenaForm({
      id_antena: a.id,
      ip_reader: r?.ip ?? "",
      num_antena: a.antena_number,
      descripcion: a.descripcion,
      potencia: a.potencia,
      estado: a.estado,
    });
    setAntenaModal("edit");
  };

  // ── Guardar reader ──
  const handleSaveReader = async () => {
    if (!readerForm.ip.trim()) {
      notify("La IP del reader es obligatoria", "error");
      return;
    }
    setSaving(true);
    try {
      const res =
        readerModal === "create"
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
          `Reader ${readerForm.ip} ${readerModal === "create" ? "registrado" : "actualizado"}` +
            (res.mensaje ? ` — ${res.mensaje}` : ""),
          "success"
        );
        setReaderModal(null);
        fetchAll();
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

  // ── Guardar antena ──
  const handleSaveAntena = async () => {
    if (!antenaForm.ip_reader.trim()) {
      notify("La antena debe pertenecer a un reader", "error");
      return;
    }
    if (antenaForm.potencia < 0 || antenaForm.potencia > 100) {
      notify("La potencia debe estar entre 0 y 100 %", "error");
      return;
    }
    setSaving(true);
    try {
      const res =
        antenaModal === "create"
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
          `Antena ${antenaForm.num_antena} ${antenaModal === "create" ? "registrada" : "actualizada"}` +
            (res.mensaje ? ` — ${res.mensaje}` : ""),
          "success"
        );
        setAntenaModal(null);
        // Mantener desplegado el reader de esta antena para ver el cambio.
        const r = readerList.find((x) => x.ip === antenaForm.ip_reader);
        if (r) setExpanded((prev) => new Set(prev).add(r.id));
        fetchAll();
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
    const ok = await confirmDelete({
      title: "Eliminar reader",
      text: `Se eliminará el reader ${r.ip} y todas sus antenas. Esta acción no se puede deshacer.`,
      confirmText: "Sí, eliminar",
    });
    if (!ok) return;
    try {
      const res = await readerManteService.remove(globalConfig.baseUrl, token, r.ip);
      if (res.codigo === 1) {
        notify(`Reader ${r.ip} eliminado`, "success");
        fetchAll();
        reloadReaders();
      } else {
        notify(`Error al eliminar: ${res.mensaje}`, "error");
      }
    } catch (e: unknown) {
      notify(`Error: ${(e as Error).message}`, "error");
    }
  };

  const handleDeleteAntena = async (a: AntenaMante) => {
    const ok = await confirmDelete({
      title: "Eliminar antena",
      text: `Se eliminará la antena N° ${a.antena_number}. Esta acción no se puede deshacer.`,
      confirmText: "Sí, eliminar",
    });
    if (!ok) return;
    try {
      const res = await antenaManteService.remove(globalConfig.baseUrl, token, a.id);
      if (res.codigo === 1) {
        notify(`Antena ${a.antena_number} eliminada`, "success");
        fetchAll();
        reloadReaders();
      } else {
        notify(`Error al eliminar: ${res.mensaje}`, "error");
      }
    } catch (e: unknown) {
      notify(`Error: ${(e as Error).message}`, "error");
    }
  };

  // ── Filtro de readers ──
  const q = search.toLowerCase();
  const filteredReaders = readerList.filter(
    (r) => r.ip.toLowerCase().includes(q) || (r.descripcion ?? "").toLowerCase().includes(q)
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a]">
      <Navbar
        readersCount={readers.length}
        mockMode={globalConfig.mockMode}
        logsCount={logs.length}
        onOpenLogs={() => setIsLogOpen(true)}
        onOpenConfig={() => setIsConfigOpen(true)}
      />

      <main className="max-w-5xl mx-auto p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-[#1e4786] flex items-center gap-2">
              <Server size={24} /> Mantenedor
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {readerList.length} reader(s) · {antenaList.length} antena(s) — despliega un reader para ver sus antenas
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchAll}
              disabled={loading}
              className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-600 px-3 py-2 rounded-lg text-xs font-semibold hover:bg-slate-50 disabled:opacity-40 transition-all"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refrescar
            </button>
            <button
              onClick={openCreateReader}
              disabled={mock}
              className="flex items-center gap-1.5 bg-[#22c4a1] text-white px-4 py-2 rounded-lg text-sm font-bold hover:brightness-105 disabled:opacity-50 transition-all"
            >
              <Plus size={16} /> Nuevo Reader
            </button>
          </div>
        </div>

        {/* Mock mode warning */}
        {mock && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <AlertCircle size={20} className="text-amber-500 shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-800">Modo Simulación</p>
              <p className="text-xs text-amber-600">
                Estás viendo datos simulados. Desactiva el modo simulación en Configuración para operar contra la API real.
              </p>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:border-[#22c4a1] outline-none transition-all bg-white"
            placeholder="Buscar reader por IP o descripción..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Lista de readers (acordeón) */}
        <div className="space-y-3">
          {loading && readerList.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 py-20 text-center">
              <Loader2 size={32} className="animate-spin text-[#22c4a1] mx-auto" />
              <p className="text-sm text-slate-400 mt-2">Cargando...</p>
            </div>
          ) : filteredReaders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 py-20 text-center text-slate-400">
              <div className="flex flex-col items-center gap-2 opacity-40">
                <Server size={40} />
                <p className="font-medium">
                  {readerList.length === 0 ? "No hay readers registrados" : "No se encontraron resultados"}
                </p>
              </div>
            </div>
          ) : (
            filteredReaders.map((r) => {
              const isOpen = expanded.has(r.id);
              const ants = antenasOf(r.id);
              const est = estadoLabel(r.estado);
              return (
                <div
                  key={r.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                >
                  {/* Cabecera del reader */}
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <button
                      onClick={() => toggle(r.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-[#1e4786] transition-colors shrink-0"
                      title={isOpen ? "Contraer" : "Ver antenas"}
                    >
                      {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>

                    <button
                      onClick={() => toggle(r.id)}
                      className="flex-1 flex items-center gap-3 text-left min-w-0"
                    >
                      <div className="bg-[#1e4786]/10 p-2 rounded-xl shrink-0">
                        <Server size={18} className="text-[#1e4786]" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-mono font-bold text-sm text-[#1e4786]">{r.ip}</div>
                        <div className="text-xs text-slate-400 truncate">
                          {r.descripcion || "Sin descripción"}
                        </div>
                      </div>
                    </button>

                    <span className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-full shrink-0">
                      <Antenna size={12} /> {ants.length}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${est.cls}`}
                    >
                      {est.text}
                    </span>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEditReader(r)}
                        className="p-2 text-slate-400 hover:text-[#1e4786] hover:bg-slate-100 rounded-lg transition-colors"
                        title="Editar reader"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteReader(r)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar reader"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Panel de antenas (desplegable) */}
                  {isOpen && (
                    <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3.5">
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                          <Antenna size={12} /> Antenas de este reader
                        </span>
                        <button
                          onClick={() => openCreateAntena(r)}
                          disabled={mock}
                          className="flex items-center gap-1 text-[11px] font-bold text-[#1e4786] hover:text-[#22c4a1] disabled:opacity-40 transition-colors"
                        >
                          <Plus size={13} /> Nueva antena
                        </button>
                      </div>

                      {ants.length === 0 ? (
                        <p className="text-[12px] text-slate-400 italic py-3 text-center">
                          Este reader no tiene antenas. Agrégalas con el botón “Nueva antena”.
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {ants.map((a) => {
                            const aEst = estadoLabel(a.estado);
                            return (
                              <div
                                key={a.id}
                                className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm"
                              >
                                <span className="font-mono font-bold text-[#1e4786] shrink-0 w-9 text-center">
                                  #{a.antena_number}
                                </span>
                                <span className="flex-1 min-w-0 truncate text-slate-600">
                                  {a.descripcion || "—"}
                                </span>
                                <span className="flex items-center gap-1 shrink-0 text-slate-500 font-mono text-xs">
                                  <Zap size={11} className="text-slate-400" /> {a.potencia}%
                                </span>
                                <span
                                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${aEst.cls}`}
                                >
                                  {aEst.text}
                                </span>
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <button
                                    onClick={() => openEditAntena(a)}
                                    className="p-1.5 text-slate-400 hover:text-[#1e4786] hover:bg-slate-100 rounded-lg transition-colors"
                                    title="Editar antena"
                                  >
                                    <Edit3 size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteAntena(a)}
                                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Eliminar antena"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
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
        isOpen={readerModal !== null}
        onClose={() => setReaderModal(null)}
        title={readerModal === "create" ? "Registrar Nuevo Reader" : "Editar Reader"}
        size="md"
        footer={
          <>
            <button
              onClick={() => setReaderModal(null)}
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
              {saving ? "Guardando..." : readerModal === "create" ? "Registrar" : "Actualizar"}
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
        isOpen={antenaModal !== null}
        onClose={() => setAntenaModal(null)}
        title={antenaModal === "create" ? "Nueva Antena" : "Editar Antena"}
        size="md"
        footer={
          <>
            <button
              onClick={() => setAntenaModal(null)}
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
              {saving ? "Guardando..." : antenaModal === "create" ? "Registrar" : "Actualizar"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Reader fijo: la antena pertenece a este reader, no se elige a mano */}
          <Field label="Reader">
            <div className="w-full p-2.5 border border-slate-200 rounded-lg text-sm font-mono bg-slate-100 text-slate-600 flex items-center gap-2">
              <Server size={14} className="text-slate-400" /> {antenaForm.ip_reader || "—"}
            </div>
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
              placeholder="Descripción de la antena (ej. Puerta entrada)"
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

// ── Helper UI ──
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

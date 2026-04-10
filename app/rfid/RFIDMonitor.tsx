"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Activity, RefreshCw, Zap } from "lucide-react";

import { StatCard } from "../components/StatCard";
import { ConfigModal } from "../components/ConfigModal";
import { Navbar } from "../components/rfid/Navbar";
import { ControlBar } from "../components/rfid/ControlBar";
import { ReaderTabs } from "../components/rfid/ReaderTabs";
import { AntennaPanel } from "../components/rfid/AntennaPanel";
import { TagTable } from "../components/rfid/TagTable";
import { LogModal } from "../components/rfid/LogModal";
import { TagRegistrationModal } from "../components/rfid/TagRegistrationModal";

import { useApp } from "../context/AppContext";
import { useDownload } from "../hooks/useDownload";
import { rfidService } from "../services/rfidService";
import { tagService } from "../services/tagService";
import Modal from "../components/Modal";
import type { TagRegistro } from "../../types/rfid";

export default function RFIDMonitor() {
  const {
    globalConfig, setGlobalConfig, token, setToken, logs, addLog,
    readers, readerStates, activeReaderId, setActiveReaderId,
    activeAntennaNum, setActiveAntennaNum, activeState, activeReader,
    readersRef, readerStatesRef, globalConfigRef, tokenRef,
    updateReaderState,
    handleAddReader, handleRemoveReader, handleUpdateReader,
    handleConnect, handleDisconnect, handleTestReader, handleGenerateToken,
    polling, startPolling, stopPolling,
  } = useApp();

  const { downloadCSV, downloadTXT } = useDownload(addLog);

  // ── Registered tags (for comparing live reads) ──
  const [registeredTags, setRegisteredTags] = useState<Map<string, TagRegistro>>(new Map());
  const registeredFetched = useRef(false);

  useEffect(() => {
    if (registeredFetched.current) return;
    if (!token && !globalConfig.mockMode) return;
    if (globalConfig.mockMode) return;
    registeredFetched.current = true;
    tagService.list(globalConfig.baseUrl, token).then((res) => {
      if (res.codigo === 1 && res.registros) {
        const map = new Map<string, TagRegistro>();
        res.registros.forEach((t) => map.set(t.idTag, t));
        setRegisteredTags(map);
      }
    }).catch(() => { /* silent */ });
  }, [token, globalConfig.baseUrl, globalConfig.mockMode]);

  // ── Modals ──
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [registerTagId, setRegisterTagId] = useState("");
  const [viewTag, setViewTag] = useState<TagRegistro | null>(null);

  // ── Clear view ──
  const handleClearView = useCallback(async () => {
    const reader = readersRef.current.find((r) => r.id === activeReaderId);
    if (!reader) return;
    try {
      await rfidService.clearReadings(
        globalConfigRef.current.baseUrl,
        tokenRef.current,
        reader.ip,
        globalConfigRef.current.mockMode
      );
    } catch {
      // ignorar
    }
    updateReaderState(activeReaderId, () => ({
      tags: [],
      newTagIds: [],
      scanCount: 0,
    }));
    addLog(`Lista de ${reader.name} limpiada`, "info");
  }, [activeReaderId, addLog, updateReaderState, readersRef, globalConfigRef, tokenRef]);

  // ── Auto-cleanup on unmount ──
  useEffect(() => {
    return () => {
      // Intentamos detener todo al salir de la ruta como medida de seguridad extra
      stopPolling();
    };
  }, [stopPolling]);

  // ── Register tag from live reading ──
  const handleRegisterTag = (tagId: string) => {
    setRegisterTagId(tagId);
    setIsRegisterOpen(true);
  };

  // ── Derived data ──
  const activeAntennaCfg = activeReader?.antenas.find(
    (a) => a.numero === activeAntennaNum
  );
  const activeTags =
    activeAntennaNum !== null
      ? activeState.tags.filter((t) => t.antena === activeAntennaNum)
      : activeState.tags;

  const totalTags = Object.values(readerStates).reduce((sum, s) => sum + s.tags.length, 0);
  const totalNew = Object.values(readerStates).reduce((sum, s) => sum + s.scanCount, 0);
  const connectedReaders = readers.filter((r) => {
    const s = readerStates[r.id]?.status;
    return s === "connected" || s === "reading";
  }).length;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a]">
      <Navbar
        readersCount={readers.length}
        mockMode={globalConfig.mockMode}
        logsCount={logs.length}
        onOpenLogs={() => setIsLogOpen(true)}
        onOpenConfig={() => setIsConfigOpen(true)}
      />

      <main className="max-w-7xl mx-auto p-6 lg:p-8 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="TAGs Detectados"
            value={totalTags}
            icon={Activity}
            color="#1e4786"
            sub={`${connectedReaders} reader${connectedReaders !== 1 ? "s" : ""} activo${connectedReaders !== 1 ? "s" : ""}`}
          />
          <StatCard
            label="Nuevos (Sesión)"
            value={totalNew}
            icon={RefreshCw}
            color="#22c4a1"
          />
          <StatCard
            label="Última Sincronización"
            value={activeState.lastUpdate ?? "--:--:--"}
            icon={Zap}
            color="#f59e0b"
            sub={polling ? "Tiempo real activo" : "En pausa"}
          />
        </div>

        {/* Controls */}
        <ControlBar
          polling={polling}
          onTogglePolling={() =>
            polling ? stopPolling() : startPolling()
          }
          onClear={handleClearView}
        />

        {/* Reader panel */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
          <ReaderTabs
            readers={readers}
            readerStates={readerStates}
            activeReaderId={activeReaderId}
            onSelectReader={setActiveReaderId}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            token={token}
            mockMode={globalConfig.mockMode}
          />

          {activeReader && (
            <AntennaPanel
              reader={activeReader}
              readerState={activeState}
              activeAntennaNum={activeAntennaNum}
              onSelectAntenna={setActiveAntennaNum}
            />
          )}

          <TagTable
            tags={activeTags}
            reader={activeReader}
            readerState={activeState}
            activeAntennaNum={activeAntennaNum}
            activeAntennaCfg={activeAntennaCfg}
            onDownloadCSV={() => downloadCSV(activeTags, activeReader)}
            onDownloadTXT={() => downloadTXT(activeTags, activeReader)}
            onClear={handleClearView}
            onRegisterTag={handleRegisterTag}
            onViewTag={(t) => setViewTag(t)}
            registeredTags={registeredTags}
          />
        </div>
      </main>

      {/* Modals */}
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

      <LogModal isOpen={isLogOpen} onClose={() => setIsLogOpen(false)} logs={logs} />

      <TagRegistrationModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        prefilledTagId={registerTagId}
        onSuccess={(newTag: TagRegistro) => {
          setRegisteredTags((prev) => {
            const map = new Map(prev);
            map.set(newTag.idTag, newTag);
            return map;
          });
        }}
      />

      {/* Tag detail modal */}
      <Modal isOpen={!!viewTag} onClose={() => setViewTag(null)} title="Detalle del Tag" size="md">
        {viewTag && (
          <div className="space-y-3 text-sm">
            {([["ID Tag", viewTag.idTag], ["Cód. Producto", viewTag.codProducto], ["Cód. Barra", viewTag.codBarra], ["Cód. Manual", viewTag.codManual], ["Descripción", viewTag.descripcion], ["Estado", viewTag.estado === "1" || viewTag.estado === "A" ? "Activo" : "Inactivo"]] as [string, string][]).map(([label, val]) => (
              <div key={label} className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-400 text-xs font-semibold uppercase">{label}</span>
                <span className="font-mono text-slate-700">{val || "—"}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <footer className="py-8 text-center text-slate-400 text-[10px] font-mono tracking-[0.2em] uppercase">
        DBPERU RFID Systems · v2.0
      </footer>
    </div>
  );
}

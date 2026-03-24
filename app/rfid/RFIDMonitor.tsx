"use client";

import { useState, useCallback } from "react";
import { Activity, RefreshCw, Clock, Zap } from "lucide-react";

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
import { useReaderManager } from "../hooks/useReaderManager";
import { useRfidPolling } from "../hooks/useRfidPolling";
import { useDownload } from "../hooks/useDownload";
import { rfidService } from "../services/rfidService";

export default function RFIDMonitor() {
  const { globalConfig, setGlobalConfig, token, setToken, logs, addLog } = useApp();

  const manager = useReaderManager();
  const {
    readers,
    readerStates,
    activeReaderId,
    setActiveReaderId,
    activeAntennaNum,
    setActiveAntennaNum,
    activeState,
    activeReader,
    readersRef,
    readerStatesRef,
    globalConfigRef,
    tokenRef,
    setReaderStates,
    handleAddReader,
    handleRemoveReader,
    handleUpdateReader,
    handleConnect,
    handleDisconnect,
    handleTestReader,
    handleConnectAntenna,
    handleDisconnectAntenna,
    handleStartAntenna,
    handleStopAntenna,
  } = manager;

  const { polling, setPolling, togglePolling } = useRfidPolling({
    readersRef,
    readerStatesRef,
    globalConfigRef,
    tokenRef,
    setReaderStates,
    addLog,
  });

  const { downloadCSV, downloadTXT } = useDownload(addLog);

  // ── Modals ──
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [registerTagId, setRegisterTagId] = useState("");

  // ── Token generation ──
  const handleGenerateToken = async () => {
    try {
      addLog("Generando token...", "info");
      const t = await rfidService.generateToken(
        globalConfig.baseUrl,
        globalConfig.dias,
        globalConfig.mockMode
      );
      setToken(t);
      addLog(
        `Token generado (${globalConfig.dias} día${globalConfig.dias !== 1 ? "s" : ""})`,
        "success"
      );
    } catch (e: unknown) {
      addLog(`Error token: ${(e as Error).message}`, "error");
    }
  };

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
    manager.updateReaderState(activeReaderId, () => ({
      tags: [],
      newTagIds: [],
      scanCount: 0,
    }));
    addLog(`Lista de ${reader.name} limpiada`, "info");
  }, [activeReaderId, addLog, manager, readersRef, globalConfigRef, tokenRef]);

  // ── Antenna start triggers polling ──
  const handleStartAntennaWithPolling = (readerId: string, antNum: number) => {
    handleStartAntenna(readerId, antNum);
    if (!polling) setPolling(true);
  };

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
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="TAGs Detectados (total)" value={totalTags} icon={Activity} color="#1e4786" />
          <StatCard label="Nuevos (Sesión)" value={totalNew} icon={RefreshCw} color="#22c4a1" />
          <StatCard label="Intervalo" value="2.0s" icon={Clock} color="#64748b" />
          <StatCard label="Última Sinc" value={activeState.lastUpdate ?? "--:--"} icon={Zap} color="#f59e0b" />
        </div>

        {/* Controls */}
        <ControlBar
          polling={polling}
          onTogglePolling={() => togglePolling(readers, readerStates)}
          onClear={handleClearView}
        />

        {/* Reader panel */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <ReaderTabs
            readers={readers}
            readerStates={readerStates}
            activeReaderId={activeReaderId}
            onSelectReader={setActiveReaderId}
          />

          {activeReader && (
            <AntennaPanel
              reader={activeReader}
              readerState={activeState}
              activeAntennaNum={activeAntennaNum}
              onSelectAntenna={setActiveAntennaNum}
              onConnectAntenna={handleConnectAntenna}
              onDisconnectAntenna={handleDisconnectAntenna}
              onStartAntenna={handleStartAntennaWithPolling}
              onStopAntenna={handleStopAntenna}
              token={token}
              mockMode={globalConfig.mockMode}
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
      />

      <footer className="py-8 text-center text-slate-400 text-[10px] font-mono tracking-[0.2em] uppercase">
        DBPERU RFID Systems · v2.0
      </footer>
    </div>
  );
}

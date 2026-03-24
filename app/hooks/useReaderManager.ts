"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { rfidService } from "../services/rfidService";
import { useApp } from "../context/AppContext";
import type {
  ReaderConfig,
  ReaderRuntimeState,
  AntennaStatus,
} from "../../types/rfid";

const DEFAULT_READER_STATE: ReaderRuntimeState = {
  status: "disconnected",
  tags: [],
  newTagIds: [],
  scanCount: 0,
  lastUpdate: null,
  antenasState: {},
};

function genId() {
  return `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function useReaderManager() {
  const { globalConfig, token, addLog } = useApp();

  const [readers, setReaders] = useState<ReaderConfig[]>([
    {
      id: "r_default",
      name: "Reader 1",
      ip: "192.168.10.1",
      antenas: [
        { numero: 1, nombre: "Antena 1", potencia: 20 },
        { numero: 2, nombre: "Antena 2", potencia: 20 },
      ],
    },
  ]);

  const [readerStates, setReaderStates] = useState<Record<string, ReaderRuntimeState>>({});
  const [activeReaderId, setActiveReaderId] = useState("r_default");
  const [activeAntennaNum, setActiveAntennaNum] = useState<number | null>(null);

  // Refs para evitar closures stale
  const readersRef = useRef(readers);
  const readerStatesRef = useRef(readerStates);
  const globalConfigRef = useRef(globalConfig);
  const tokenRef = useRef(token);

  useEffect(() => { readersRef.current = readers; }, [readers]);
  useEffect(() => { readerStatesRef.current = readerStates; }, [readerStates]);
  useEffect(() => { globalConfigRef.current = globalConfig; }, [globalConfig]);
  useEffect(() => { tokenRef.current = token; }, [token]);
  useEffect(() => { setActiveAntennaNum(null); }, [activeReaderId]);

  const updateReaderState = useCallback(
    (id: string, updater: (prev: ReaderRuntimeState) => Partial<ReaderRuntimeState>) => {
      setReaderStates((prev) => {
        const current = prev[id] ?? DEFAULT_READER_STATE;
        return { ...prev, [id]: { ...current, ...updater(current) } };
      });
    },
    []
  );

  const setAntennaStatus = useCallback(
    (readerId: string, antNum: number, status: AntennaStatus) => {
      setReaderStates((prev) => {
        const cur = prev[readerId] ?? DEFAULT_READER_STATE;
        const newAnt = { ...cur.antenasState, [antNum]: { status } };
        const antVals = Object.values(newAnt);
        let readerStatus = cur.status;
        if (antVals.some((a) => a.status === "reading")) readerStatus = "reading";
        else if (antVals.some((a) => a.status === "connected" || a.status === "connecting"))
          readerStatus = "connected";
        else if (antVals.every((a) => a.status === "disconnected"))
          readerStatus = "disconnected";
        return { ...prev, [readerId]: { ...cur, antenasState: newAnt, status: readerStatus } };
      });
    },
    []
  );

  // ── CRUD Readers ──

  const handleAddReader = useCallback(() => {
    const id = genId();
    const num = readersRef.current.length + 1;
    setReaders((prev) => [
      ...prev,
      {
        id,
        name: `Reader ${num}`,
        ip: "192.168.10.1",
        antenas: [{ numero: 1, nombre: "Antena 1", potencia: 20 }],
      },
    ]);
    setActiveReaderId(id);
    addLog(`Reader ${num} agregado`, "info");
  }, [addLog]);

  const handleRemoveReader = useCallback(
    (id: string) => {
      setReaders((prev) => prev.filter((r) => r.id !== id));
      setReaderStates((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setActiveReaderId((current) => {
        if (current === id) {
          const remaining = readersRef.current.filter((r) => r.id !== id);
          return remaining[0]?.id ?? "";
        }
        return current;
      });
      addLog("Reader eliminado", "info");
    },
    [addLog]
  );

  const handleUpdateReader = useCallback(
    (id: string, updates: Partial<ReaderConfig>) => {
      setReaders((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
    },
    []
  );

  // ── Conexión / Desconexión ──

  const handleConnect = useCallback(
    async (readerId: string) => {
      const reader = readersRef.current.find((r) => r.id === readerId);
      if (!reader) return;
      if (!tokenRef.current && !globalConfigRef.current.mockMode) {
        addLog("Primero genera un token", "error");
        return;
      }
      updateReaderState(readerId, () => ({ status: "connecting" }));
      addLog(`Conectando a ${reader.name} (${reader.ip})...`, "info");
      try {
        const cfg = globalConfigRef.current;
        await rfidService.connect(
          cfg.baseUrl,
          tokenRef.current,
          reader.ip,
          reader.antenas.map((a) => ({ numero: a.numero, potenciaDbm: a.potencia })),
          cfg.mockMode
        );
        updateReaderState(readerId, () => ({ status: "connected" }));
        addLog(`${reader.name} conectado`, "success");
      } catch (e: unknown) {
        updateReaderState(readerId, () => ({ status: "error" }));
        addLog(`Error conectando ${reader.name}: ${(e as Error).message}`, "error");
      }
    },
    [addLog, updateReaderState]
  );

  const handleDisconnect = useCallback(
    async (readerId: string) => {
      const reader = readersRef.current.find((r) => r.id === readerId);
      if (!reader) return;
      try {
        const cfg = globalConfigRef.current;
        await rfidService.disconnect(cfg.baseUrl, tokenRef.current, reader.ip, cfg.mockMode);
      } catch {
        // ignorar
      }
      updateReaderState(readerId, () => ({ status: "disconnected", tags: [] }));
      addLog(`${reader.name} desconectado`, "info");
    },
    [addLog, updateReaderState]
  );

  // ── Test de comunicación ──

  const handleTestReader = useCallback(
    async (readerId: string): Promise<{ ok: boolean; latencyMs: number }> => {
      const reader = readersRef.current.find((r) => r.id === readerId);
      if (!reader) throw new Error("Reader no encontrado");
      addLog(`Probando comunicación con ${reader.name} (${reader.ip})...`, "info");
      try {
        const cfg = globalConfigRef.current;
        const result = await rfidService.testConnection(cfg.baseUrl, reader.ip, cfg.mockMode);
        if (result.ok) {
          addLog(`${reader.name}: Comunicación OK (${result.latencyMs}ms)`, "success");
        } else {
          addLog(`${reader.name}: Sin respuesta`, "error");
        }
        return result;
      } catch (e: unknown) {
        addLog(`Error probando ${reader.name}: ${(e as Error).message}`, "error");
        return { ok: false, latencyMs: 0 };
      }
    },
    [addLog]
  );

  // ── Control por antena ──

  const handleConnectAntenna = useCallback(
    async (readerId: string, antNum: number) => {
      const reader = readersRef.current.find((r) => r.id === readerId);
      const ant = reader?.antenas.find((a) => a.numero === antNum);
      if (!reader || !ant) return;
      setAntennaStatus(readerId, antNum, "connecting");
      addLog(`Conectando Antena ${antNum} — ${ant.nombre}...`, "info");
      try {
        const cfg = globalConfigRef.current;
        await rfidService.connectAntenna(
          cfg.baseUrl,
          tokenRef.current,
          reader.ip,
          antNum,
          ant.potencia,
          cfg.mockMode
        );
        setAntennaStatus(readerId, antNum, "connected");
        addLog(`Antena ${antNum} — ${ant.nombre} conectada`, "success");
      } catch (e: unknown) {
        setAntennaStatus(readerId, antNum, "disconnected");
        addLog(`Error antena ${antNum}: ${(e as Error).message}`, "error");
      }
    },
    [addLog, setAntennaStatus]
  );

  const handleDisconnectAntenna = useCallback(
    async (readerId: string, antNum: number) => {
      const reader = readersRef.current.find((r) => r.id === readerId);
      const ant = reader?.antenas.find((a) => a.numero === antNum);
      if (!reader || !ant) return;
      try {
        const cfg = globalConfigRef.current;
        await rfidService.disconnectAntenna(
          cfg.baseUrl,
          tokenRef.current,
          reader.ip,
          antNum,
          cfg.mockMode
        );
      } catch {
        /* ignorar */
      }
      setAntennaStatus(readerId, antNum, "disconnected");
      addLog(`Antena ${antNum} — ${ant.nombre} desconectada`, "info");
    },
    [addLog, setAntennaStatus]
  );

  const handleStartAntenna = useCallback(
    (readerId: string, antNum: number) => {
      const reader = readersRef.current.find((r) => r.id === readerId);
      const ant = reader?.antenas.find((a) => a.numero === antNum);
      if (!ant) return;
      setAntennaStatus(readerId, antNum, "reading");
      addLog(`Antena ${antNum} — ${ant.nombre} iniciando lectura`, "success");
    },
    [addLog, setAntennaStatus]
  );

  const handleStopAntenna = useCallback(
    (readerId: string, antNum: number) => {
      const reader = readersRef.current.find((r) => r.id === readerId);
      const ant = reader?.antenas.find((a) => a.numero === antNum);
      if (!ant) return;
      setAntennaStatus(readerId, antNum, "connected");
      addLog(`Antena ${antNum} — ${ant.nombre} detenida`, "info");
    },
    [addLog, setAntennaStatus]
  );

  // ── Datos derivados ──
  const activeState = readerStates[activeReaderId] ?? DEFAULT_READER_STATE;
  const activeReader = readers.find((r) => r.id === activeReaderId);

  return {
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
    updateReaderState,
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
  };
}

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { rfidService } from "../services/rfidService";
import { useApp } from "../context/AppContext";
import type {
  ReaderConfig,
  ReaderRuntimeState,
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

  // ── Conexión / Desconexión del READER (con todas sus antenas) ──

  const handleConnect = useCallback(
    async (readerId: string) => {
      const reader = readersRef.current.find((r) => r.id === readerId);
      if (!reader) return;
      if (!tokenRef.current && !globalConfigRef.current.mockMode) {
        addLog("Primero genera un token", "error");
        return;
      }
      if (reader.antenas.length === 0) {
        addLog("Agrega al menos una antena al reader antes de conectar", "error");
        return;
      }
      updateReaderState(readerId, () => ({ status: "connecting" }));
      addLog(`Conectando ${reader.name} (${reader.ip}) con ${reader.antenas.length} antena(s)...`, "info");
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
        addLog(`${reader.name} conectado (${reader.antenas.length} antena(s))`, "success");
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
      updateReaderState(readerId, () => ({
        status: "disconnected",
        tags: [],
        newTagIds: [],
        scanCount: 0,
        lastUpdate: null,
      }));
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
  };
}

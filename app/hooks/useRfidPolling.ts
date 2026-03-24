"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { rfidService } from "../services/rfidService";
import type { ReaderConfig, ReaderRuntimeState, GlobalConfig } from "../../types/rfid";

interface UseRfidPollingOptions {
  readersRef: React.RefObject<ReaderConfig[]>;
  readerStatesRef: React.RefObject<Record<string, ReaderRuntimeState>>;
  globalConfigRef: React.RefObject<GlobalConfig>;
  tokenRef: React.RefObject<string>;
  setReaderStates: React.Dispatch<React.SetStateAction<Record<string, ReaderRuntimeState>>>;
  addLog: (msg: string, type?: "info" | "success" | "error" | "default") => void;
}

const DEFAULT_READER_STATE: ReaderRuntimeState = {
  status: "disconnected",
  tags: [],
  newTagIds: [],
  scanCount: 0,
  lastUpdate: null,
  antenasState: {},
};

export function useRfidPolling({
  readersRef,
  readerStatesRef,
  globalConfigRef,
  tokenRef,
  setReaderStates,
  addLog,
}: UseRfidPollingOptions) {
  const [polling, setPolling] = useState(false);
  const pollingRef = useRef(false);
  const addLogRef = useRef(addLog);

  useEffect(() => { addLogRef.current = addLog; }, [addLog]);
  useEffect(() => { pollingRef.current = polling; }, [polling]);

  const pollAllReaders = useCallback(async () => {
    const currentReaders = readersRef.current;
    const { baseUrl, mockMode } = globalConfigRef.current;
    const t = tokenRef.current;
    const log = addLogRef.current;

    const active = currentReaders.filter((r) => {
      const s = readerStatesRef.current[r.id]?.status;
      return s === "connected" || s === "reading";
    });

    if (active.length === 0) return;

    await Promise.all(
      active.map(async (reader) => {
        try {
          const antenasNums = reader.antenas.map((a) => a.numero);
          const lista = await rfidService.listReadings(
            baseUrl, t, reader.ip, antenasNums, mockMode
          );

          const prevTags = readerStatesRef.current[reader.id]?.tags ?? [];
          const prevSet = new Set(prevTags.map((tg) => tg.tagid));
          const newOnes = lista.filter((tg) => !prevSet.has(tg.tagid));

          if (newOnes.length > 0) {
            log(`[${reader.name}] ${newOnes.length} TAG(s) nuevo(s)`, "success");
          }

          setReaderStates((prev) => {
            const cur = prev[reader.id] ?? DEFAULT_READER_STATE;
            return {
              ...prev,
              [reader.id]: {
                ...cur,
                tags: lista,
                newTagIds: newOnes.map((tg) => tg.tagid),
                scanCount: cur.scanCount + newOnes.length,
                lastUpdate: new Date().toLocaleTimeString("es-PE", { hour12: false }),
                status: "reading",
              },
            };
          });
        } catch (e: unknown) {
          log(`[${reader.name}] Error polling: ${(e as Error).message}`, "error");
        }
      })
    );
  }, [readersRef, readerStatesRef, globalConfigRef, tokenRef, setReaderStates]);

  // Continuous loop: poll → response → poll again immediately (real-time)
  useEffect(() => {
    let cancelled = false;

    async function loop() {
      while (!cancelled && pollingRef.current) {
        await pollAllReaders();
        // Micro-pause to let React render and avoid locking the thread
        await new Promise((r) => setTimeout(r, 50));
      }
    }

    if (polling) {
      loop();
    } else {
      // Readers que estaban leyendo pasan a "connected"
      setReaderStates((prev) => {
        const next = { ...prev };
        let changed = false;
        Object.keys(next).forEach((id) => {
          if (next[id].status === "reading") {
            next[id] = { ...next[id], status: "connected" };
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }

    return () => { cancelled = true; };
  }, [polling, pollAllReaders, setReaderStates]);

  const togglePolling = useCallback(
    (readers: ReaderConfig[], readerStates: Record<string, ReaderRuntimeState>) => {
      const anyConnected = readers.some((r) => {
        const s = readerStates[r.id]?.status;
        return s === "connected" || s === "reading";
      });
      if (!anyConnected) {
        addLog("Conecta al menos un reader antes de iniciar lectura", "error");
        return;
      }
      setPolling((p) => {
        addLog(!p ? "Lectura en tiempo real iniciada" : "Lectura pausada", !p ? "success" : "info");
        return !p;
      });
    },
    [addLog]
  );

  return { polling, setPolling, togglePolling };
}

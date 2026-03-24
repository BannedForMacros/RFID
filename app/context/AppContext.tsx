"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import type { GlobalConfig, LogEntry } from "../../types/rfid";

interface AppContextValue {
  globalConfig: GlobalConfig;
  setGlobalConfig: React.Dispatch<React.SetStateAction<GlobalConfig>>;
  token: string;
  setToken: React.Dispatch<React.SetStateAction<string>>;
  logs: LogEntry[];
  addLog: (msg: string, type?: LogEntry["type"]) => void;
  clearLogs: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig>({
    baseUrl: "https://abc123.ngrok.io",
    dias: 1,
    mockMode: true,
  });

  const [token, setToken] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = useCallback((msg: string, type: LogEntry["type"] = "default") => {
    const time = new Date().toLocaleTimeString("es-PE", { hour12: false });
    setLogs((prev) => [{ msg, type, time }, ...prev].slice(0, 80));
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);

  return (
    <AppContext.Provider
      value={{ globalConfig, setGlobalConfig, token, setToken, logs, addLog, clearLogs }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

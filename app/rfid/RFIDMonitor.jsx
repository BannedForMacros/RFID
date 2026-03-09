"use client";
import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────────────────────
//  DBPERU RFID Monitor — Paleta oficial DBPERU
//  Azul Principal:  #1e4786   Verde Turquesa: #22c4a1
//  Azul Profundo:   #003366   Gris Superficie: #f8fafc
//  Azul Noche:      #0f172a
// ─────────────────────────────────────────────────────────────

const THEME = {
  brand:   "#1e4786",
  accent:  "#22c4a1",
  deep:    "#003366",
  surface: "#f8fafc",
  text:    "#0f172a",
  border:  "#d1dff5",
  muted:   "#64748b",
  danger:  "#ef4444",
  white:   "#ffffff",
};

// Helpers de fetch con manejo de SSL self-signed (localhost)
async function apiFetch(url, options = {}) {
  const res = await fetch(url, { ...options });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Componente: Indicador de pulso ────────────────────────────
function PulseIndicator({ active, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", width: 14, height: 14 }}>
        <span style={{
          width: 10, height: 10, borderRadius: "50%",
          background: active ? THEME.accent : "#94a3b8",
          display: "block",
          boxShadow: active ? `0 0 6px ${THEME.accent}` : "none",
          transition: "all 0.4s ease",
        }} />
        {active && (
          <span style={{
            position: "absolute", inset: -4, borderRadius: "50%",
            border: `1.5px solid ${THEME.accent}60`,
            animation: "rfidPing 1.5s ease-out infinite",
          }} />
        )}
      </span>
      <span style={{ fontSize: 12, color: active ? THEME.accent : THEME.muted, fontWeight: 600, fontFamily: "monospace" }}>
        {label}
      </span>
    </div>
  );
}

// ── Componente: Tarjeta de estadística ───────────────────────
function StatCard({ label, value, icon, accent }) {
  return (
    <div style={{
      background: THEME.white,
      border: `1px solid ${accent ? accent + "40" : THEME.border}`,
      borderRadius: 12,
      padding: "16px 20px",
      flex: 1,
      minWidth: 120,
      boxShadow: accent ? `0 2px 16px ${accent}18` : "0 1px 4px #1e478612",
    }}>
      <div style={{ fontSize: 11, color: THEME.muted, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6, fontFamily: "monospace" }}>{icon} {label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: accent || THEME.brand, fontFamily: "monospace" }}>{value}</div>
    </div>
  );
}

// ── Componente: Badge de estado ──────────────────────────────
function StatusBadge({ status }) {
  const config = {
    disconnected: { label: "Desconectado", bg: "#f1f5f9", color: THEME.muted },
    connecting:   { label: "Conectando…",  bg: "#fffbeb", color: "#d97706" },
    connected:    { label: "Conectado",    bg: "#ecfdf5", color: "#059669" },
    reading:      { label: "Leyendo…",     bg: "#ecfdf5", color: THEME.accent },
    error:        { label: "Error",         bg: "#fef2f2", color: THEME.danger },
  };
  const c = config[status] || config.disconnected;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      background: c.bg, color: c.color,
      padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700,
      border: `1px solid ${c.color}30`,
    }}>
      <span style={{ fontSize: 8 }}>●</span> {c.label}
    </span>
  );
}

// ── Componente: Fila de TAG ───────────────────────────────────
function TagRow({ tag, idx, onDelete, isNew }) {
  const [flash, setFlash] = useState(isNew);
  useEffect(() => {
    if (isNew) { const t = setTimeout(() => setFlash(false), 2500); return () => clearTimeout(t); }
  }, [isNew]);

  const epc  = tag.epc  || tag.EPC  || tag.Epc  || "—";
  const rssi = tag.rssi || tag.RSSI || tag.signal || "—";
  const id   = tag.id   || tag.Id   || tag.ID   || idx;
  const ts   = tag.timestamp || tag.Timestamp || tag.fecha || tag.readTime || null;

  return (
    <tr style={{
      background: flash ? `${THEME.accent}12` : (idx % 2 === 0 ? THEME.surface : THEME.white),
      transition: "background 1.2s ease",
      borderBottom: `1px solid ${THEME.border}`,
    }}>
      <td style={{ padding: "10px 16px", fontFamily: "monospace", fontSize: 12, color: THEME.muted, width: 50 }}>{idx + 1}</td>
      <td style={{ padding: "10px 16px" }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontFamily: "monospace", fontSize: 13, fontWeight: 700,
          color: THEME.brand, letterSpacing: 0.5,
        }}>
          {flash && <span style={{ color: THEME.accent, fontSize: 10, animation: "fadeIn 0.3s" }}>▶</span>}
          {epc}
        </span>
      </td>
      <td style={{ padding: "10px 16px", fontFamily: "monospace", fontSize: 12, color: THEME.muted }}>
        {rssi !== "—" ? (
          <span style={{ color: parseInt(rssi) > -60 ? THEME.accent : "#f59e0b" }}>{rssi} dBm</span>
        ) : "—"}
      </td>
      <td style={{ padding: "10px 16px", fontFamily: "monospace", fontSize: 11, color: THEME.muted }}>
        {ts ? new Date(ts).toLocaleTimeString("es-PE", { hour12: false }) : new Date().toLocaleTimeString("es-PE", { hour12: false })}
      </td>
      <td style={{ padding: "10px 16px", textAlign: "center" }}>
        <button
          onClick={() => onDelete(id)}
          style={{
            background: "transparent", border: `1px solid #fca5a530`,
            color: "#f87171", borderRadius: 6, padding: "3px 10px",
            fontSize: 11, cursor: "pointer", fontFamily: "monospace",
            transition: "all 0.2s",
          }}
          onMouseOver={e => { e.target.style.background = "#fef2f2"; e.target.style.borderColor = THEME.danger; }}
          onMouseOut={e => { e.target.style.background = "transparent"; e.target.style.borderColor = "#fca5a530"; }}
        >
          ✕ Eliminar
        </button>
      </td>
    </tr>
  );
}

// ── Componente: Log de eventos ───────────────────────────────
function EventLog({ logs }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [logs]);
  return (
    <div ref={ref} style={{
      background: "#0f172a", borderRadius: 10, padding: 14,
      height: 160, overflowY: "auto", fontFamily: "monospace", fontSize: 11,
      border: `1px solid ${THEME.brand}40`,
    }}>
      {logs.length === 0 && <div style={{ color: "#475569" }}>— Sin eventos aún —</div>}
      {logs.map((l, i) => (
        <div key={i} style={{
          color: l.type === "error" ? "#f87171" : l.type === "success" ? THEME.accent : l.type === "info" ? "#93c5fd" : "#94a3b8",
          marginBottom: 3, lineHeight: 1.5,
        }}>
          <span style={{ color: "#475569" }}>[{l.time}]</span> {l.msg}
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  PÁGINA PRINCIPAL
// ════════════════════════════════════════════════════════════
export default function RFIDMonitor() {
  // ── Config ───────────────────────────────────────────────
  const [baseUrl, setBaseUrl]       = useState("https://abc123.ngrok.io");
  const [dias, setDias]             = useState(1);
  const [ipReader, setIpReader]     = useState("192.168.1.100");
  const [potencia, setPotencia]     = useState(20);
  const [tLectura, setTLectura]     = useState(10);

  // ── Estado ───────────────────────────────────────────────
  const [token, setToken]           = useState("");
  const [status, setStatus]         = useState("disconnected"); // disconnected | connecting | connected | reading | error
  const [tags, setTags]             = useState([]);
  const [prevTagIds, setPrevTagIds] = useState(new Set());
  const [newTagIds, setNewTagIds]   = useState(new Set());
  const [logs, setLogs]             = useState([]);
  const [polling, setPolling]       = useState(false);
  const [scanCount, setScanCount]   = useState(0);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [tokenInput, setTokenInput] = useState("");

  const pollRef = useRef(null);

  // ── Helper: log ──────────────────────────────────────────
  const log = useCallback((msg, type = "default") => {
    const time = new Date().toLocaleTimeString("es-PE", { hour12: false });
    setLogs(prev => [...prev.slice(-80), { msg, type, time }]);
  }, []);

  // ── 1. Generar Token ─────────────────────────────────────
  const handleGenerateToken = async () => {
    try {
      log("Generando token...", "info");
      const url = `${baseUrl}/api/Rfid/generate-token?dias=${dias}`;
      const data = await apiFetch(url, { method: "POST" });
      const t = data.token || data.Token || data.access_token || JSON.stringify(data);
      setToken(t);
      setTokenInput(t);
      log(`✓ Token generado (${dias} día${dias > 1 ? "s" : ""})`, "success");
    } catch (e) {
      log(`✗ Error generando token: ${e.message}`, "error");
    }
  };

  // ── 2. Conectar Reader ───────────────────────────────────
  const handleConnect = async () => {
    if (!token) { log("✗ Primero genera un token", "error"); return; }
    setStatus("connecting");
    try {
      log(`Conectando a reader ${ipReader}...`, "info");
      await apiFetch(`${baseUrl}/api/Rfid/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Auth-Token": token },
        body: JSON.stringify({ ipreader: ipReader, potenciaDbm: Number(potencia), tlectura: Number(tLectura) }),
      });
      setStatus("connected");
      log(`✓ Conectado a ${ipReader} (potencia: ${potencia} dBm, t: ${tLectura}s)`, "success");
    } catch (e) {
      setStatus("error");
      log(`✗ Error conectando: ${e.message}`, "error");
    }
  };

  // ── 3. Polling de lecturas ───────────────────────────────
  const fetchTags = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch(`${baseUrl}/api/Rfid/listaActualizaLecturas`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Auth-Token": token },
        body: JSON.stringify({ ope: 1, id: 0 }),
      });

      // Normalizar respuesta — puede ser array directo o envuelto
      const lista = Array.isArray(data) ? data : (data.lecturas || data.data || data.tags || data.Items || []);

      setTags(prev => {
        const prevIds = new Set(prev.map(t => t.epc || t.EPC || t.id || t.Id));
        const incoming = new Set(lista.map(t => t.epc || t.EPC || t.id || t.Id));
        const newOnes  = new Set([...incoming].filter(x => !prevIds.has(x)));
        if (newOnes.size > 0) {
          setNewTagIds(newOnes);
          setScanCount(c => c + newOnes.size);
          log(`▶ ${newOnes.size} nuevo${newOnes.size > 1 ? "s" : ""} TAG${newOnes.size > 1 ? "s" : ""} detectado${newOnes.size > 1 ? "s" : ""}`, "success");
        }
        return lista;
      });

      setLastUpdate(new Date());
      setStatus("reading");
    } catch (e) {
      log(`✗ Error polling: ${e.message}`, "error");
    }
  }, [baseUrl, token, log]);

  // Arrancar / parar polling
  useEffect(() => {
    if (polling) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchTags();
      pollRef.current = setInterval(fetchTags, 2000);
    } else {
      clearInterval(pollRef.current);
      if (status === "reading") setStatus("connected");
    }
    return () => clearInterval(pollRef.current);
  }, [polling, fetchTags]); // eslint-disable-line react-hooks/exhaustive-deps

  const togglePolling = () => {
    if (!token) { log("✗ Primero genera un token y conecta el reader", "error"); return; }
    setPolling(p => !p);
    log(polling ? "⏸ Lectura pausada" : "▶ Lectura en tiempo real iniciada (cada 2s)", polling ? "info" : "success");
  };

  // ── 4. Eliminar TAG ──────────────────────────────────────
  const handleDeleteTag = async (id) => {
    try {
      await apiFetch(`${baseUrl}/api/Rfid/listaActualizaLecturas`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Auth-Token": token },
        body: JSON.stringify({ ope: 2, id }),
      });
      setTags(prev => prev.filter(t => (t.id || t.Id || t.epc || t.EPC) !== id));
      log(`✓ TAG ${id} eliminado`, "info");
    } catch (e) {
      log(`✗ Error eliminando TAG: ${e.message}`, "error");
    }
  };

  // ── 5. Desconectar ───────────────────────────────────────
  const handleDisconnect = async () => {
    setPolling(false);
    try {
      await apiFetch(`${baseUrl}/api/Rfid/disconnect`, {
        method: "POST",
        headers: { "X-Auth-Token": token },
      });
      setStatus("disconnected");
      setTags([]);
      log("✓ Reader desconectado correctamente", "info");
    } catch (e) {
      setStatus("disconnected");
      log(`Desconectado (${e.message})`, "info");
    }
  };

  // ── Limpiar lecturas localmente ──────────────────────────
  const handleClearLocal = () => { setTags([]); setScanCount(0); log("Lista limpiada localmente", "info"); };

  // ════════════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════════════
  return (
    <>
      {/* ── CSS global ─────────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Outfit:wght@400;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${THEME.surface}; color: ${THEME.text}; font-family: 'Outfit', sans-serif; }
        @keyframes rfidPing {
          0%   { transform: scale(1);   opacity: 0.8; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes fadeIn { from { opacity: 0; transform: translateX(-4px); } to { opacity: 1; transform: none; } }
        @keyframes scanLine {
          0%   { transform: translateY(-100%); opacity: 0.6; }
          100% { transform: translateY(800%);  opacity: 0; }
        }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: ${THEME.surface}; }
        ::-webkit-scrollbar-thumb { background: ${THEME.border}; border-radius: 4px; }
        input, select {
          font-family: 'Outfit', sans-serif;
          background: ${THEME.white};
          border: 1px solid ${THEME.border};
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 13px;
          color: ${THEME.text};
          outline: none;
          width: 100%;
          transition: border-color 0.2s;
        }
        input:focus, select:focus { border-color: ${THEME.accent}; box-shadow: 0 0 0 3px ${THEME.accent}18; }
        label { font-size: 11px; color: ${THEME.muted}; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; display: block; margin-bottom: 4px; }
      `}</style>

      <div style={{ minHeight: "100vh", background: THEME.surface }}>

        {/* ── HEADER ───────────────────────────────────── */}
        <div style={{
          background: `linear-gradient(135deg, ${THEME.deep} 0%, ${THEME.brand} 100%)`,
          padding: "0 32px",
          boxShadow: "0 4px 24px #00336640",
        }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: `${THEME.accent}20`,
                border: `1.5px solid ${THEME.accent}50`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
              }}>📡</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 17, color: THEME.white, letterSpacing: 0.3 }}>RFID Monitor</div>
                <div style={{ fontSize: 11, color: `${THEME.accent}cc`, fontFamily: "monospace" }}>DBPERU · Tiempo Real</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <PulseIndicator active={polling} label={polling ? "EN VIVO" : "PAUSADO"} />
              <StatusBadge status={status} />
            </div>
          </div>
        </div>

        {/* ── CONTENIDO ─────────────────────────────────── */}
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 32px", display: "flex", flexDirection: "column", gap: 24 }}>

          {/* ── STATS ───────────────────────────────────── */}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <StatCard label="TAGs Detectados" value={tags.length} icon="🏷" accent={THEME.brand} />
            <StatCard label="Nuevos (sesión)" value={scanCount} icon="✨" accent={THEME.accent} />
            <StatCard label="Intervalo" value="2s" icon="⏱" />
            <StatCard label="Última lectura" value={lastUpdate ? lastUpdate.toLocaleTimeString("es-PE", { hour12: false }) : "—"} icon="🕐" />
          </div>

          {/* ── GRID: Config + Log ─────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

            {/* Panel izquierdo: configuración */}
            <div style={{
              background: THEME.white, borderRadius: 14, padding: 24,
              border: `1px solid ${THEME.border}`,
              boxShadow: "0 2px 12px #1e478610",
            }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: THEME.brand, marginBottom: 18, display: "flex", alignItems: "center", gap: 8 }}>
                <span>⚙️</span> Configuración
              </div>

              {/* URL base */}
              <div style={{ marginBottom: 14 }}>
                <label>URL Base (ngrok / local)</label>
                <input value={baseUrl} onChange={e => setBaseUrl(e.target.value.replace(/\/$/, ""))} placeholder="https://abc123.ngrok.io" />
              </div>

              {/* Token */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginBottom: 14 }}>
                <div>
                  <label>Días de validez del token</label>
                  <input type="number" value={dias} min={1} max={30} onChange={e => setDias(Number(e.target.value))} />
                </div>
                <div style={{ paddingTop: 20 }}>
                  <button onClick={handleGenerateToken} style={{
                    background: THEME.brand, color: THEME.white,
                    border: "none", borderRadius: 8, padding: "9px 16px",
                    fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
                    fontFamily: "Outfit, sans-serif", transition: "opacity 0.2s",
                  }}
                    onMouseOver={e => e.target.style.opacity = 0.85}
                    onMouseOut={e => e.target.style.opacity = 1}
                  >🔑 Generar</button>
                </div>
              </div>

              {token && (
                <div style={{ background: `${THEME.accent}12`, border: `1px solid ${THEME.accent}40`, borderRadius: 8, padding: "8px 12px", marginBottom: 14 }}>
                  <label>Token activo</label>
                  <div style={{ fontFamily: "monospace", fontSize: 11, color: THEME.accent, wordBreak: "break-all" }}>{token.substring(0, 60)}{token.length > 60 ? "…" : ""}</div>
                </div>
              )}

              <div style={{ borderTop: `1px solid ${THEME.border}`, paddingTop: 16, marginTop: 4 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: THEME.text, marginBottom: 14 }}>Parámetros del Reader</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
                  <div>
                    <label>IP Reader</label>
                    <input value={ipReader} onChange={e => setIpReader(e.target.value)} placeholder="192.168.1.100" />
                  </div>
                  <div>
                    <label>Potencia (10-30 dBm)</label>
                    <input type="number" value={potencia} min={10} max={30} onChange={e => setPotencia(e.target.value)} />
                  </div>
                  <div>
                    <label>T. Lectura (seg)</label>
                    <input type="number" value={tLectura} min={1} max={60} onChange={e => setTLectura(e.target.value)} />
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={handleConnect} disabled={!token || status === "connecting"}
                    style={{
                      flex: 1, background: THEME.accent, color: THEME.white,
                      border: "none", borderRadius: 8, padding: "10px",
                      fontSize: 13, fontWeight: 700, cursor: "pointer",
                      opacity: (!token || status === "connecting") ? 0.5 : 1,
                      fontFamily: "Outfit, sans-serif", transition: "opacity 0.2s",
                    }}>
                    🔌 Conectar Reader
                  </button>
                  <button onClick={handleDisconnect} disabled={status === "disconnected"}
                    style={{
                      flex: 1, background: "transparent", color: THEME.danger,
                      border: `1px solid ${THEME.danger}50`, borderRadius: 8, padding: "10px",
                      fontSize: 13, fontWeight: 700, cursor: "pointer",
                      opacity: status === "disconnected" ? 0.4 : 1,
                      fontFamily: "Outfit, sans-serif", transition: "all 0.2s",
                    }}>
                    ⏹ Desconectar
                  </button>
                </div>
              </div>
            </div>

            {/* Panel derecho: log de eventos */}
            <div style={{
              background: THEME.white, borderRadius: 14, padding: 24,
              border: `1px solid ${THEME.border}`,
              boxShadow: "0 2px 12px #1e478610",
              display: "flex", flexDirection: "column",
            }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: THEME.brand, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                <span>📋</span> Log de Eventos
              </div>
              <EventLog logs={logs} />

              {/* Botón de lectura */}
              <div style={{ marginTop: "auto", paddingTop: 20 }}>
                <button onClick={togglePolling}
                  style={{
                    width: "100%", padding: "14px",
                    background: polling
                      ? `linear-gradient(135deg, #dc2626, #b91c1c)`
                      : `linear-gradient(135deg, ${THEME.accent}, #1aaf8e)`,
                    color: THEME.white, border: "none", borderRadius: 10,
                    fontSize: 15, fontWeight: 800, cursor: "pointer",
                    fontFamily: "Outfit, sans-serif",
                    boxShadow: polling ? "0 4px 16px #dc262640" : `0 4px 16px ${THEME.accent}50`,
                    transition: "all 0.3s", letterSpacing: 0.5,
                  }}>
                  {polling ? "⏸  Pausar Lectura" : "▶  Iniciar Lectura en Tiempo Real"}
                </button>
              </div>
            </div>
          </div>

          {/* ── TABLA DE TAGs ────────────────────────────── */}
          <div style={{
            background: THEME.white, borderRadius: 14,
            border: `1px solid ${THEME.border}`,
            boxShadow: "0 2px 12px #1e478610",
            overflow: "hidden",
          }}>
            {/* Cabecera tabla */}
            <div style={{
              padding: "16px 24px",
              background: `linear-gradient(135deg, ${THEME.deep}08, ${THEME.brand}08)`,
              borderBottom: `1px solid ${THEME.border}`,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: THEME.brand }}>🏷 Lecturas RFID</span>
                {polling && (
                  <span style={{ fontSize: 11, color: THEME.accent, fontFamily: "monospace", background: `${THEME.accent}15`, padding: "2px 10px", borderRadius: 12, border: `1px solid ${THEME.accent}30` }}>
                    ● actualizando cada 2s
                  </span>
                )}
              </div>
              <button onClick={handleClearLocal} style={{
                background: "transparent", border: `1px solid ${THEME.border}`,
                color: THEME.muted, borderRadius: 7, padding: "5px 14px",
                fontSize: 12, cursor: "pointer", fontFamily: "Outfit, sans-serif",
              }}>🗑 Limpiar vista</button>
            </div>

            {/* Tabla */}
            {tags.length === 0 ? (
              <div style={{ padding: 60, textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📡</div>
                <div style={{ color: THEME.muted, fontSize: 14 }}>
                  {status === "disconnected" ? "Conecta el reader para comenzar a leer TAGs" : "Esperando lecturas RFID…"}
                </div>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: `${THEME.brand}08` }}>
                      {["#", "EPC / TAG ID", "RSSI", "Hora", "Acciones"].map(h => (
                        <th key={h} style={{
                          padding: "10px 16px", textAlign: "left",
                          fontSize: 11, color: THEME.muted, fontWeight: 700,
                          textTransform: "uppercase", letterSpacing: 1.2,
                          borderBottom: `2px solid ${THEME.border}`,
                          fontFamily: "monospace",
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tags.map((tag, i) => {
                      const id = tag.epc || tag.EPC || tag.id || tag.Id;
                      return (
                        <TagRow
                          key={id || i}
                          tag={tag}
                          idx={i}
                          onDelete={handleDeleteTag}
                          isNew={newTagIds.has(id)}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

        {/* ── FOOTER ───────────────────────────────────── */}
        <div style={{ textAlign: "center", padding: "20px 32px", color: THEME.muted, fontSize: 11, fontFamily: "monospace", borderTop: `1px solid ${THEME.border}` }}>
          DBPERU · RFID Monitor v1.0 · Polling cada 2s · {new Date().getFullYear()}
        </div>
      </div>
    </>
  );
}
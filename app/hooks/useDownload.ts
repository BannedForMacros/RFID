"use client";

import { useCallback } from "react";
import type { Tag, ReaderConfig } from "../../types/rfid";

function formatDate(d: string) {
  return d
    ? new Date(d).toLocaleString("es-PE", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
    : "—";
}

function downloadBlob(blob: Blob, filename: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function timestamp() {
  return new Date().toISOString().slice(0, 19).replace(/:/g, "-");
}

export function useDownload(addLog: (msg: string, type?: "info" | "success" | "error" | "default") => void) {
  const downloadCSV = useCallback(
    (tags: Tag[], reader?: ReaderConfig) => {
      if (tags.length === 0) {
        addLog("No hay datos para descargar", "error");
        return;
      }
      const headers = ["#", "EPC / TAG ID", "Antena", "Contador", "Hora Inicio", "Hora Fin", "IP Reader"];
      const rows = tags.map((tag, idx) => {
        const antCfg = reader?.antenas.find((a) => a.numero === tag.antena);
        return [
          idx + 1,
          tag.tagid,
          antCfg?.nombre ?? `Antena ${tag.antena}`,
          tag.contador,
          formatDate(tag.fecini),
          formatDate(tag.fecfin),
          tag.ipreader,
        ]
          .map((c) => `"${c}"`)
          .join(",");
      });
      const blob = new Blob([[headers.join(","), ...rows].join("\n")], {
        type: "text/csv;charset=utf-8;",
      });
      downloadBlob(blob, `lecturas_rfid_${timestamp()}.csv`);
      addLog(`${tags.length} registros descargados en CSV`, "success");
    },
    [addLog]
  );

  const downloadTXT = useCallback(
    (tags: Tag[], reader?: ReaderConfig) => {
      if (tags.length === 0) {
        addLog("No hay datos para descargar", "error");
        return;
      }
      const lines = tags.map((tag, idx) => {
        const antCfg = reader?.antenas.find((a) => a.numero === tag.antena);
        return `${idx + 1}\t${tag.tagid}\t${antCfg?.nombre ?? `Antena ${tag.antena}`}\t${tag.contador}\t${formatDate(tag.fecini)}\t${formatDate(tag.fecfin)}\t${tag.ipreader}`;
      });
      const blob = new Blob(
        [["#\tEPC / TAG ID\tAntena\tContador\tHora Inicio\tHora Fin\tIP Reader", ...lines].join("\n")],
        { type: "text/plain;charset=utf-8;" }
      );
      downloadBlob(blob, `lecturas_rfid_${timestamp()}.txt`);
      addLog(`${tags.length} registros descargados en TXT`, "success");
    },
    [addLog]
  );

  return { downloadCSV, downloadTXT };
}

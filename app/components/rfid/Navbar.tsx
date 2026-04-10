"use client";

import { Activity, ClipboardList, Settings, Tag, CheckSquare, Radio } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "../../context/AppContext";
import { ExitConfirmationModal } from "./ExitConfirmationModal";

interface NavbarProps {
  readersCount: number;
  mockMode: boolean;
  logsCount: number;
  onOpenLogs: () => void;
  onOpenConfig: () => void;
}

const NAV_ITEMS = [
  { href: "/rfid", label: "Lectura en Vivo", icon: Radio },
  { href: "/tags", label: "Mantenimiento", icon: Tag },
  { href: "/validation", label: "Validación", icon: CheckSquare },
];

export function Navbar({ readersCount, mockMode, logsCount, onOpenLogs, onOpenConfig }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { readerStates, stopPolling } = useApp();

  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  // Un reader está "activo" si está conectado o leyendo
  const isAnyReaderActive = Object.values(readerStates).some(
    (s) => s.status === "connected" || s.status === "reading"
  );

  const handleNavClick = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    if (pathname === href) return;

    if (isAnyReaderActive) {
      setPendingUrl(href);
    } else {
      router.push(href);
    }
  };

  const handleConfirmExit = async () => {
    if (pendingUrl) {
      const target = pendingUrl;
      setPendingUrl(null);
      await stopPolling(); // Esto detiene el polling y desconecta todos los readers activos
      router.push(target);
    }
  };

  return (
    <nav className="bg-gradient-to-r from-[#003366] via-[#1a3d6e] to-[#1e4786] text-white px-6 lg:px-8 h-16 flex items-center justify-between shadow-xl sticky top-0 z-50">
      <div className="flex items-center gap-5">
        {/* Logo */}
        <a 
          href="/rfid" 
          onClick={(e) => handleNavClick(e, "/rfid")}
          className="flex items-center gap-3 group cursor-pointer"
        >
          <div className="bg-[#22c4a1]/20 p-2 rounded-xl border border-[#22c4a1]/30 group-hover:bg-[#22c4a1]/30 transition-colors">
            <Activity size={20} className="text-[#22c4a1]" />
          </div>
          <div className="hidden sm:block">
            <h1 className="font-extrabold text-lg tracking-tight leading-none">RFID MONITOR</h1>
            <p className="text-[9px] text-[#22c4a1]/80 font-mono tracking-[0.2em]">
              DBPERU · {readersCount} READER{readersCount !== 1 ? "S" : ""}
              {mockMode && " · MOCK"}
            </p>
          </div>
        </a>

        {/* Divider */}
        <div className="hidden md:block w-px h-8 bg-white/10" />

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <a
                key={item.href}
                href={item.href}
                onClick={(e) => handleNavClick(e, item.href)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-semibold transition-all cursor-pointer ${
                  isActive
                    ? "bg-white/12 text-[#22c4a1] shadow-inner"
                    : "text-white/50 hover:text-white/90 hover:bg-white/8"
                }`}
              >
                <item.icon size={14} />
                {item.label}
              </a>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {/* Mobile nav */}
        <div className="flex md:hidden items-center gap-1 mr-2">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <a
                key={item.href}
                href={item.href}
                onClick={(e) => handleNavClick(e, item.href)}
                className={`p-2 rounded-lg transition-all cursor-pointer ${
                  isActive ? "bg-white/15 text-[#22c4a1]" : "text-white/40 hover:text-white/80"
                }`}
                title={item.label}
              >
                <item.icon size={18} />
              </a>
            );
          })}
        </div>

        <button
          onClick={onOpenLogs}
          className="p-2.5 hover:bg-white/10 rounded-xl transition-colors relative"
          title="Log de eventos"
        >
          <ClipboardList size={20} />
          {logsCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-400 rounded-full border-2 border-[#1e4786]" />
          )}
        </button>
        <button
          onClick={onOpenConfig}
          className="p-2.5 hover:bg-white/10 rounded-xl transition-colors"
          title="Configuración"
        >
          <Settings size={20} />
        </button>
      </div>

      <ExitConfirmationModal 
        isOpen={!!pendingUrl} 
        onClose={() => setPendingUrl(null)} 
        onConfirm={handleConfirmExit}
      />
    </nav>
  );
}

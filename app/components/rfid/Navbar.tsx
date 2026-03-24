"use client";

import { Activity, ClipboardList, Settings, Tag, CheckSquare } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavbarProps {
  readersCount: number;
  mockMode: boolean;
  logsCount: number;
  onOpenLogs: () => void;
  onOpenConfig: () => void;
}

const NAV_ITEMS = [
  { href: "/rfid", label: "Lectura en Vivo", icon: Activity },
  { href: "/tags", label: "Mantenimiento Tags", icon: Tag },
  { href: "/validation", label: "Validación", icon: CheckSquare },
];

export function Navbar({ readersCount, mockMode, logsCount, onOpenLogs, onOpenConfig }: NavbarProps) {
  const pathname = usePathname();

  return (
    <nav className="bg-gradient-to-r from-[#003366] to-[#1e4786] text-white px-8 h-16 flex items-center justify-between shadow-lg sticky top-0 z-50">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="bg-[#22c4a1]/20 p-2 rounded-lg border border-[#22c4a1]/50">
            <Activity size={20} className="text-[#22c4a1]" />
          </div>
          <div>
            <h1 className="font-extrabold text-lg tracking-tight">RFID MONITOR</h1>
            <p className="text-[10px] text-[#22c4a1] font-mono tracking-widest">
              DBPERU · REAL TIME · {readersCount} READER{readersCount !== 1 ? "S" : ""}
              {mockMode && " · SIMULACIÓN"}
            </p>
          </div>
        </div>

        {/* Navigation links */}
        <div className="hidden md:flex items-center gap-1 ml-4">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-white/15 text-[#22c4a1]"
                    : "text-white/60 hover:text-white hover:bg-white/10"
                }`}
              >
                <item.icon size={14} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onOpenLogs}
          className="p-2 hover:bg-white/10 rounded-full transition-colors relative"
        >
          <ClipboardList size={22} />
          {logsCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-500 rounded-full border border-[#1e4786]" />
          )}
        </button>
        <button
          onClick={onOpenConfig}
          className="p-2 hover:bg-white/10 rounded-full transition-colors"
        >
          <Settings size={22} />
        </button>
      </div>
    </nav>
  );
}

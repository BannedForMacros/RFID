import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: string;
  sub?: string;
}

export const StatCard = ({ label, value, icon: Icon, color = "#1e4786", sub }: StatCardProps) => (
  <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow flex-1 min-w-[150px]">
    <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-mono">
      <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${color}10` }}>
        <Icon size={13} style={{ color }} />
      </div>
      {label}
    </div>
    <div className="text-3xl font-extrabold font-mono leading-none" style={{ color }}>
      {value}
    </div>
    {sub && (
      <p className="text-[10px] text-slate-400 mt-1.5 font-mono">{sub}</p>
    )}
  </div>
);

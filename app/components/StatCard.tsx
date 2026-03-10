import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: string;
}

export const StatCard = ({ label, value, icon: Icon, color = "#1e4786" }: StatCardProps) => (
  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex-1 min-w-[150px]">
    <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-mono">
      <Icon size={14} style={{ color }} /> {label}
    </div>
    <div className="text-3xl font-extrabold font-mono" style={{ color }}>{value}</div>
  </div>
);
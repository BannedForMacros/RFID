import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  message: string;
  sub?: string;
}

export function EmptyState({ icon: Icon, message, sub }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 py-20 opacity-40">
      <Icon size={40} />
      <p className="font-medium text-slate-400">{message}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

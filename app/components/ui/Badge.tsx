interface BadgeProps {
  children: React.ReactNode;
  variant?: "success" | "error" | "warning" | "info" | "neutral" | "reading";
  pulse?: boolean;
  className?: string;
}

const VARIANTS: Record<string, string> = {
  success: "bg-emerald-50 text-emerald-600 border-emerald-200",
  error: "bg-red-50 text-red-500 border-red-200",
  warning: "bg-yellow-50 text-yellow-600 border-yellow-200",
  info: "bg-blue-50 text-blue-600 border-blue-200",
  neutral: "bg-slate-100 text-slate-500 border-slate-200",
  reading: "bg-emerald-50 text-emerald-600 border-emerald-200",
};

export function Badge({ children, variant = "neutral", pulse, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold border uppercase ${VARIANTS[variant]} ${pulse ? "animate-pulse" : ""} ${className}`}
    >
      {children}
    </span>
  );
}

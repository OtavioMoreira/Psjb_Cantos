export function Cross({ size = 12, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden className={className} fill="currentColor">
      <path d="M5 0h2v5h5v2H7v5H5V7H0V5h5z" />
    </svg>
  );
}

/** Filete dourado com cruz no centro: ──── ✣ ──── */
export function Divider({ className = "", align = "center" }: { className?: string; align?: "center" | "left" }) {
  return (
    <div
      aria-hidden
      className={`flex items-center gap-3 text-gold ${align === "center" ? "justify-center" : ""} ${className}`}
    >
      <span className="h-px w-16 bg-gradient-to-r from-transparent to-gold sm:w-24" />
      <Cross size={10} />
      <span className="h-px w-16 bg-gradient-to-l from-transparent to-gold sm:w-24" />
    </div>
  );
}

export function CornerFrame() {
  const c = "absolute h-4 w-4 border-gold";
  return (
    <span aria-hidden className="pointer-events-none">
      <span className={`${c} left-2 top-2 border-l border-t`} />
      <span className={`${c} right-2 top-2 border-r border-t`} />
      <span className={`${c} bottom-2 left-2 border-b border-l`} />
      <span className={`${c} bottom-2 right-2 border-b border-r`} />
    </span>
  );
}

import type { ComponentProps } from "react";
import { AlertCircle } from "lucide-react";

export function Field({
  label,
  error,
  hint,
  id,
  className = "",
  children,
  ...props
}: ComponentProps<"input"> & { label: string; error?: string; hint?: string; children?: React.ReactNode }) {
  const inputId = id ?? props.name;
  return (
    <div className={className}>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-erro` : undefined}
          className="h-11 w-full rounded-[6px] border border-border bg-surface px-3 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-gold/40 aria-[invalid=true]:border-danger"
          {...props}
        />
        {children}
      </div>
      {error ? (
        <p id={`${inputId}-erro`} className="mt-1.5 flex items-center gap-1.5 text-sm text-danger">
          <AlertCircle size={14} /> {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-sm text-ink-muted">{hint}</p>
      )}
    </div>
  );
}

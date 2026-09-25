export function passwordScore(p: string) {
  return [p.length >= 8, /\d/.test(p), /[A-Z]/.test(p) && /[a-z]/.test(p), /[^\w\s]/.test(p) || p.length >= 12].filter(Boolean).length;
}

const LABELS = ["Muito fraca", "Fraca", "Razoável", "Boa", "Forte"];

export function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const score = passwordScore(password);
  const color = score < 2 ? "bg-danger" : score < 3 ? "bg-gold" : "bg-success";
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i < score ? color : "bg-surface-2"}`} />
        ))}
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        Força: {LABELS[score]} · use 8+ caracteres, números e letras maiúsculas.
      </p>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Info, Loader2 } from "lucide-react";
import { DEMO_EMAIL, DEMO_PASSWORD, login } from "@/lib/store";
import { Logo } from "./Logo";
import { CornerFrame, Divider } from "@/components/ui/Ornament";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const emailErr = touched.email && !/^\S+@\S+\.\S+$/.test(email) ? "Informe um e-mail válido." : undefined;
  const passErr = touched.password && password.length < 6 ? "Use pelo menos 6 caracteres." : undefined;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 6) return;
    setLoading(true);
    setError("");
    // Simula a latência de uma API real.
    setTimeout(() => {
      if (login(email, password)) {
        const volta = params.get("volta");
        router.push(volta && volta.startsWith("/") ? volta : "/painel");
      } else {
        setLoading(false);
        setError("E-mail ou senha não conferem. Tente de novo.");
      }
    }, 600);
  };

  return (
    <div className="relative w-full max-w-[420px] rounded-[16px] border border-border bg-surface px-6 py-10 shadow-overlay sm:px-10">
      <CornerFrame />
      <div className="flex justify-center">
        <Logo className="h-20 w-auto" />
      </div>
      <Divider className="my-6" />
      <h1 className="font-serif text-3xl font-semibold">Entrar</h1>
      <p className="mt-1 text-sm text-ink-muted">Acesse suas missas e preferências.</p>
      <form onSubmit={submit} noValidate className="mt-6 space-y-4">
        <Field
          label="E-mail"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, email: true }))}
          error={emailErr}
        />
        <Field
          label="Senha"
          name="password"
          type={show ? "text" : "password"}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, password: true }))}
          error={passErr}
        >
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Ocultar senha" : "Mostrar senha"}
            className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center text-ink-muted"
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </Field>
        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" defaultChecked className="h-4 w-4 accent-[var(--primary-solid)]" /> Manter conectado
          </label>
          <span className="text-ink-muted" title="Disponível quando houver API">
            Esqueci a senha
          </span>
        </div>
        {error && (
          <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" disabled={loading} className="h-12 w-full">
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Entrando…
            </>
          ) : (
            "Entrar"
          )}
        </Button>
      </form>
      <div className="mt-6 flex gap-3 rounded-[10px] bg-gold-soft p-4 text-sm">
        <Info size={18} className="mt-0.5 shrink-0 text-gold-ink" />
        <div>
          <p className="font-semibold">Área de demonstração</p>
          <p className="mt-1 text-ink-muted">
            E-mail: <code className="font-mono text-ink">{DEMO_EMAIL}</code>
            <br />
            Senha: <code className="font-mono text-ink">{DEMO_PASSWORD}</code>
          </p>
          <p className="mt-1 text-xs text-ink-muted">Se você mudou a senha no perfil, use a nova.</p>
          <button
            type="button"
            onClick={() => {
              setEmail(DEMO_EMAIL);
              setPassword(DEMO_PASSWORD);
            }}
            className="mt-2 font-semibold text-primary underline underline-offset-2"
          >
            Preencher automaticamente
          </button>
        </div>
      </div>
    </div>
  );
}

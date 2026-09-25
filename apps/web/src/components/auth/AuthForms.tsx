"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Info, Loader2, MailCheck, ShieldAlert } from "lucide-react";
import { DEMO_ACCOUNTS, login, resendVerification, signup } from "@/lib/store";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { AuthCard, DemoNote } from "./AuthCard";
import { Recaptcha } from "./Recaptcha";
import { PasswordStrength, passwordScore } from "./PasswordStrength";

const EMAIL_RE = /^\S+@\S+\.\S+$/;
type Tab = "entrar" | "criar";

export function AuthForms() {
  const params = useSearchParams();
  const router = useRouter();
  const tab: Tab = params.get("aba") === "criar" ? "criar" : "entrar";
  const [pendingEmail, setPendingEmail] = useState<{ email: string; token: string } | null>(null);


  const setTab = (t: Tab) => {
    const sp = new URLSearchParams(params.toString());
    if (t === "criar") sp.set("aba", "criar");
    else sp.delete("aba");
    const qs = sp.toString();
    router.replace(qs ? `/entrar?${qs}` : "/entrar", { scroll: false });
  };

  if (pendingEmail)
    return (
      <CheckEmail
        {...pendingEmail}
        onBack={() => {
          setPendingEmail(null);
          setTab("entrar");
        }}
      />
    );

  return (
    <AuthCard>
      <div role="tablist" aria-label="Acesso" className="mb-6 grid grid-cols-2 rounded-[10px] bg-surface-2 p-1">
        {(
          [
            ["entrar", "Entrar"],
            ["criar", "Criar conta"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className="h-10 rounded-md text-[15px] font-semibold text-ink-muted transition aria-selected:bg-surface aria-selected:text-primary aria-selected:shadow-card"
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "entrar" ? (
        <LoginForm onPending={(email) => setPendingEmail({ email, token: resendVerification(email) ?? "" })} />
      ) : (
        <SignupForm onCreated={(email, token) => setPendingEmail({ email, token })} />
      )}
    </AuthCard>
  );
}

function PasswordField(props: React.ComponentProps<typeof Field>) {
  const [show, setShow] = useState(false);
  return (
    <Field {...props} type={show ? "text" : "password"}>
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Ocultar senha" : "Mostrar senha"}
        className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center text-ink-muted"
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </Field>
  );
}

function LoginForm({ onPending }: { onPending: (email: string) => void }) {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState({ email: false, password: false });
  const [error, setError] = useState<{ text: string; pending?: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  const emailErr = touched.email && !EMAIL_RE.test(email) ? "Informe um e-mail válido." : undefined;
  const passErr = touched.password && password.length < 6 ? "Use pelo menos 6 caracteres." : undefined;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (!EMAIL_RE.test(email) || password.length < 6) return;
    setLoading(true);
    setError(null);
    // Simula a latência de uma API real.
    setTimeout(() => {
      const r = login(email, password);
      if (r.ok) {
        const volta = params.get("volta");
        router.push(volta && volta.startsWith("/") ? volta : "/painel");
        return;
      }
      setLoading(false);
      if (r.reason === "pendente") setError({ text: "Você ainda não confirmou seu e-mail.", pending: true });
      else if (r.reason === "bloqueado")
        setError({ text: `Seu acesso está bloqueado.${r.message ? ` Motivo: ${r.message}` : ""} Procure a coordenação da paróquia.` });
      else setError({ text: "E-mail ou senha não conferem. Tente de novo." });
    }, 600);
  };

  return (
    <>
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
        <PasswordField
          label="Senha"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, password: true }))}
          error={passErr}
        />
        <div className="flex items-center justify-between text-sm">
          <label className="flex min-h-11 items-center gap-2">
            <input type="checkbox" defaultChecked className="h-4 w-4 accent-[var(--primary-solid)]" /> Manter conectado
          </label>
          <Link href="/recuperar-senha" className="inline-flex min-h-11 items-center font-medium text-primary hover:underline">
            Esqueci a senha
          </Link>
        </div>
        {error && (
          <div role="alert" className="flex gap-2 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
            <ShieldAlert size={18} className="mt-0.5 shrink-0" />
            <div>
              {error.text}
              {error.pending && (
                <button type="button" onClick={() => onPending(email)} className="ml-1 font-semibold underline underline-offset-2">
                  Reenviar e-mail de confirmação
                </button>
              )}
            </div>
          </div>
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
      <DemoNote>
        <div className="flex gap-3">
          <Info size={18} className="mt-0.5 shrink-0 text-gold-ink" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Contas de demonstração</p>
            <ul className="mt-2 space-y-2">
              {DEMO_ACCOUNTS.map((a) => (
                <li key={a.email} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-ink-muted">
                    <strong className="text-ink">{a.label}:</strong> <code className="font-mono text-xs text-ink">{a.email}</code> /{" "}
                    <code className="font-mono text-xs text-ink">{a.password}</code>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail(a.email);
                      setPassword(a.password);
                      setError(null);
                    }}
                    className="min-h-9 rounded-md px-3 font-semibold text-primary underline underline-offset-2 hover:bg-primary-soft"
                  >
                    Usar
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </DemoNote>
    </>
  );
}

function SignupForm({ onCreated }: { onCreated: (email: string, token: string) => void }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "", ministry: "" });
  const [accepted, setAccepted] = useState(false);
  const [human, setHuman] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const errors = {
    name: form.name.trim().length < 3 ? "Informe seu nome completo." : undefined,
    email: !EMAIL_RE.test(form.email) ? "Informe um e-mail válido." : undefined,
    password: passwordScore(form.password) < 2 || form.password.length < 8 ? "Use pelo menos 8 caracteres, com letras e números." : undefined,
    confirm: form.confirm !== form.password || !form.confirm ? "As senhas não conferem." : undefined,
  };
  const show = (k: keyof typeof errors) => (submitted ? errors[k] : undefined);
  const valid = !Object.values(errors).some(Boolean) && accepted && human;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setError("");
    if (!valid) return;
    setLoading(true);
    setTimeout(() => {
      const r = signup(form);
      setLoading(false);
      if (!r.ok) setError("Já existe uma conta com este e-mail. Tente entrar ou recuperar a senha.");
      else onCreated(form.email.trim().toLowerCase(), r.token);
    }, 700);
  };

  return (
    <>
      <h1 className="font-serif text-3xl font-semibold">Criar conta</h1>
      <p className="mt-1 text-sm text-ink-muted">Enviaremos um link para confirmar seu e-mail. A conta só é ativada depois da confirmação.</p>
      <form onSubmit={submit} noValidate className="mt-6 space-y-4">
        <Field label="Nome completo" name="name" autoComplete="name" value={form.name} onChange={set("name")} error={show("name")} />
        <Field label="E-mail" name="signup-email" type="email" autoComplete="email" value={form.email} onChange={set("email")} error={show("email")} />
        <Field
          label="Ministério / pastoral (opcional)"
          name="ministry"
          value={form.ministry}
          onChange={set("ministry")}
          placeholder="Ex.: Ministério de Música — Missa das 10h"
        />
        <div>
          <PasswordField label="Senha" name="new-password" autoComplete="new-password" value={form.password} onChange={set("password")} error={show("password")} />
          <PasswordStrength password={form.password} />
        </div>
        <PasswordField label="Confirmar senha" name="confirm-password" autoComplete="new-password" value={form.confirm} onChange={set("confirm")} error={show("confirm")} />
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary-solid)]" />
          <span>
            Li e aceito os termos de uso e a política de privacidade (LGPD). Meus dados serão usados apenas para o acesso ao repertório.
          </span>
        </label>
        {submitted && !accepted && <p className="-mt-2 text-sm text-danger">É preciso aceitar os termos.</p>}
        <div>
          <Recaptcha onChange={setHuman} />
          {submitted && !human && <p className="mt-1.5 text-sm text-danger">Confirme que você não é um robô.</p>}
        </div>
        {error && (
          <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" disabled={loading} className="h-12 w-full">
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Criando conta…
            </>
          ) : (
            "Criar conta"
          )}
        </Button>
      </form>
    </>
  );
}

function CheckEmail({ email, token, onBack }: { email: string; token: string; onBack: () => void }) {
  const [cooldown, setCooldown] = useState(60);
  const [currentToken, setCurrentToken] = useState(token);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  return (
    <AuthCard>
      <div className="text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary-soft text-primary">
          <MailCheck size={32} />
        </span>
        <h1 className="mt-4 font-serif text-3xl font-semibold">Confirme seu e-mail</h1>
        <p className="mt-2 text-ink-muted">
          Enviamos um link de confirmação para <strong className="text-ink">{email}</strong>. Abra o e-mail e clique no link para ativar sua conta.
        </p>
        <p className="mt-2 text-sm text-ink-muted">O link vale por 24 horas. Não recebeu? Olhe a caixa de spam.</p>
        <div className="mt-6 flex flex-col gap-3">
          <Button
            variant="secondary"
            disabled={cooldown > 0}
            onClick={() => {
              const t = resendVerification(email);
              if (t) setCurrentToken(t);
              setCooldown(60);
            }}
          >
            {cooldown > 0 ? `Reenviar e-mail em ${cooldown}s` : "Reenviar e-mail"}
          </Button>
          <Button variant="ghost" onClick={onBack}>
            Voltar para o login
          </Button>
        </div>
      </div>
      {currentToken && (
        <DemoNote>
          <p className="font-semibold">Demonstração: ainda não há envio de e-mail</p>
          <p className="mt-1 text-ink-muted">Clique abaixo para simular o link que chegaria na caixa de entrada.</p>
          <Link href={`/confirmar-email?token=${currentToken}`} className="mt-2 inline-block font-semibold text-primary underline underline-offset-2">
            Abrir link de confirmação →
          </Link>
        </DemoNote>
      )}
    </AuthCard>
  );
}

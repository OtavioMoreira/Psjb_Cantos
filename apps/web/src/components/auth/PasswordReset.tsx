"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { CircleCheck, KeyRound, Loader2, MailCheck } from "lucide-react";
import { requestPasswordReset, resetPassword } from "@/lib/store";
import { Field } from "@/components/ui/Field";
import { Button, ButtonLink } from "@/components/ui/Button";
import { AuthCard, DemoNote } from "./AuthCard";
import { PasswordStrength, passwordScore } from "./PasswordStrength";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<{ token: string | null } | null>(null);
  const [loading, setLoading] = useState(false);
  const valid = /^\S+@\S+\.\S+$/.test(email);

  if (sent) {
    return (
      <AuthCard>
        <div className="text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary-soft text-primary">
            <MailCheck size={32} />
          </span>
          <h1 className="mt-4 font-serif text-3xl font-semibold">Verifique seu e-mail</h1>
          {/* Mesma mensagem existindo ou não a conta — não revela quais e-mails estão cadastrados. */}
          <p className="mt-2 text-ink-muted">
            Se houver uma conta para <strong className="text-ink">{email}</strong>, você receberá um link para criar uma nova senha. O link vale por 1 hora.
          </p>
          <ButtonLink href="/entrar" variant="ghost" className="mt-6">
            Voltar para o login
          </ButtonLink>
        </div>
        {sent.token && (
          <DemoNote>
            <p className="font-semibold">Demonstração: ainda não há envio de e-mail</p>
            <Link href={`/redefinir-senha?token=${sent.token}`} className="mt-2 inline-block font-semibold text-primary underline underline-offset-2">
              Abrir link de redefinição →
            </Link>
          </DemoNote>
        )}
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <KeyRound size={32} className="text-gold" />
      <h1 className="mt-3 font-serif text-3xl font-semibold">Esqueci a senha</h1>
      <p className="mt-1 text-sm text-ink-muted">Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.</p>
      <form
        noValidate
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          setLoading(true);
          setTimeout(() => setSent({ token: requestPasswordReset(email) }), 600);
        }}
      >
        <Field label="E-mail" name="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button type="submit" disabled={!valid || loading} className="h-12 w-full">
          {loading ? <Loader2 size={18} className="animate-spin" /> : "Enviar link"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm">
        Lembrou?{" "}
        <Link href="/entrar" className="inline-flex min-h-11 items-center px-1 font-semibold text-primary hover:underline">
          Entrar
        </Link>
      </p>
    </AuthCard>
  );
}

export function ResetPassword() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<"form" | "ok" | "invalido">("form");
  const [error, setError] = useState("");

  if (state !== "form") {
    return (
      <AuthCard>
        <div className="text-center">
          {state === "ok" ? (
            <>
              <CircleCheck size={48} className="mx-auto text-success" />
              <h1 className="mt-4 font-serif text-3xl font-semibold">Senha alterada</h1>
              <p className="mt-2 text-ink-muted">Pronto! Use a nova senha para entrar.</p>
            </>
          ) : (
            <>
              <h1 className="font-serif text-3xl font-semibold">Link inválido ou expirado</h1>
              <p className="mt-2 text-ink-muted">Peça um novo link de redefinição.</p>
            </>
          )}
          <ButtonLink href={state === "ok" ? "/entrar" : "/recuperar-senha"} className="mt-6 w-full">
            {state === "ok" ? "Entrar" : "Pedir novo link"}
          </ButtonLink>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <h1 className="font-serif text-3xl font-semibold">Criar nova senha</h1>
      <form
        noValidate
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          if (password.length < 8 || passwordScore(password) < 2) return setError("Use pelo menos 8 caracteres, com letras e números.");
          if (password !== confirm) return setError("As senhas não conferem.");
          setState(resetPassword(token, password) ? "ok" : "invalido");
        }}
      >
        <div>
          <Field label="Nova senha" name="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <PasswordStrength password={password} />
        </div>
        <Field label="Confirmar nova senha" name="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" className="h-12 w-full">
          Salvar nova senha
        </Button>
      </form>
    </AuthCard>
  );
}

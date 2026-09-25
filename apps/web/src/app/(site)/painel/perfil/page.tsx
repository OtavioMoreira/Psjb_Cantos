"use client";

import { useState } from "react";
import { changePassword, initials, setPrefs, updateUser, usePrefs, useUser } from "@/lib/store";
import type { User } from "@/lib/types";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { toast } from "@/components/ui/Toast";
import { passwordScore } from "@/components/auth/PasswordStrength";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[16px] border border-border bg-surface p-5 shadow-card sm:p-6">
      <h2 className="font-serif text-2xl font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function PerfilPage() {
  const user = useUser();
  return (
    <div className="max-w-[640px]">
      <h1 className="font-serif text-[32px] font-semibold text-primary sm:text-[40px]">Meu perfil</h1>
      <p className="mt-1 text-sm text-ink-muted">Nesta demonstração os dados ficam salvos só neste navegador.</p>
      <div className="mt-6 space-y-5">
        {/* key força reinicializar o formulário quando o usuário salvo muda */}
        <PersonalCard key={user.name + user.email} user={user} />
        <MinistryCard key={user.ministry + user.parish + user.instrument} user={user} />
        <SecurityCard />
        <PrefsCard />
      </div>
    </div>
  );
}

function PersonalCard({ user }: { user: User }) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const emailOk = /^\S+@\S+\.\S+$/.test(email);
  const dirty = name !== user.name || email !== user.email;
  return (
    <Card title="Dados pessoais">
      <div className="mb-5 flex items-center gap-4">
        <span className="grid h-[72px] w-[72px] place-items-center rounded-full bg-primary-solid font-serif text-3xl font-semibold text-[#FFFDF8]">
          {initials(name || user.name)}
        </span>
        <span className="text-sm text-ink-muted">A foto de perfil chega junto com a API.</span>
      </div>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim() || !emailOk) return;
          updateUser({ name: name.trim(), email: email.trim() });
          toast("Tudo certo, seu perfil foi atualizado.");
        }}
      >
        <Field label="Nome" name="name" value={name} onChange={(e) => setName(e.target.value)} error={!name.trim() ? "Informe seu nome." : undefined} />
        <Field
          label="E-mail"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={!emailOk ? "Informe um e-mail válido." : undefined}
          hint="Também é o seu login."
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={!dirty || !name.trim() || !emailOk}>
            Salvar alterações
          </Button>
        </div>
      </form>
    </Card>
  );
}

function MinistryCard({ user }: { user: User }) {
  const [parish, setParish] = useState(user.parish);
  const [ministry, setMinistry] = useState(user.ministry);
  const [instrument, setInstrument] = useState(user.instrument ?? "");
  const dirty = parish !== user.parish || ministry !== user.ministry || instrument !== (user.instrument ?? "");
  return (
    <Card title="Paróquia e ministério">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          updateUser({ parish, ministry, instrument });
          toast("Ministério atualizado.");
        }}
      >
        <Field label="Paróquia" name="parish" value={parish} onChange={(e) => setParish(e.target.value)} />
        <Field label="Ministério" name="ministry" value={ministry} onChange={(e) => setMinistry(e.target.value)} />
        <div>
          <label htmlFor="instrument" className="mb-1.5 block text-sm font-medium">
            Instrumento / voz
          </label>
          <select
            id="instrument"
            value={instrument}
            onChange={(e) => setInstrument(e.target.value)}
            className="h-11 w-full rounded-[6px] border border-border bg-surface px-3 outline-none focus:border-primary"
          >
            {["Violão", "Teclado", "Voz", "Baixo", "Flauta", "Coordenação"].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={!dirty}>
            Salvar
          </Button>
        </div>
      </form>
    </Card>
  );
}

function SecurityCard() {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const strength = [next.length >= 6, /\d/.test(next), /[A-Z]/.test(next) || /[^\w]/.test(next), next.length >= 10].filter(Boolean).length;
  return (
    <Card title="Segurança">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setErr("");
          if (next.length < 8 || passwordScore(next) < 2) return setErr("Use pelo menos 8 caracteres, com letras e números.");
          if (next !== confirm) return setErr("A confirmação não confere com a nova senha.");
          if (!changePassword(cur, next)) return setErr("Senha atual incorreta.");
          setCur("");
          setNext("");
          setConfirm("");
          toast("Senha alterada.");
        }}
      >
        <Field label="Senha atual" name="current" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nova senha" name="new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          <Field label="Confirmar" name="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        {next && (
          <div className="flex items-center gap-2" aria-label={`Força da senha: ${strength} de 4`}>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={`h-1.5 flex-1 rounded-full ${i < strength ? (strength < 2 ? "bg-danger" : strength < 3 ? "bg-gold" : "bg-success") : "bg-surface-2"}`} />
            ))}
          </div>
        )}
        {err && (
          <p role="alert" className="text-sm text-danger">
            {err}
          </p>
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={!cur || !next || !confirm}>
            Alterar senha
          </Button>
        </div>
      </form>
    </Card>
  );
}

function PrefsCard() {
  const prefs = usePrefs();
  return (
    <Card title="Preferências">
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-sm font-medium">Tema</p>
          <ThemeToggle />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">Acidentes nas cifras transpostas</p>
          <div role="radiogroup" className="inline-flex rounded-[10px] border border-border bg-surface p-1 text-sm">
            {[
              [false, "Sustenidos (C♯)"],
              [true, "Bemóis (D♭)"],
            ].map(([v, l]) => (
              <button
                key={String(v)}
                role="radio"
                aria-checked={prefs.preferFlats === v}
                onClick={() => setPrefs({ preferFlats: v as boolean })}
                className="rounded-md px-3 py-1.5 text-ink-muted aria-checked:bg-primary-soft aria-checked:font-semibold aria-checked:text-primary"
              >
                {l as string}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

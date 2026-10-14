"use client";

import { useRef, useState } from "react";
import { Camera, KeyRound, Loader2 } from "lucide-react";
import { changePassword, initials, setPrefs, updateUser, uploadMyPhoto, usePrefs, useUser } from "@/lib/store";
import { API_ENABLED, ApiError } from "@/lib/api";
import type { User } from "@/lib/types";
import { Field } from "@/components/ui/Field";
import { MovementSelect } from "@/components/user/MovementSelect";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { toast } from "@/components/ui/Toast";
import { passwordScore } from "@/components/auth/PasswordStrength";

function Card({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-[16px] border border-border bg-surface p-5 shadow-card sm:p-6">
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
      {user.mustChangePassword ? (
        <p role="alert" className="mt-3 flex gap-2 rounded-[10px] border border-gold/40 bg-gold-soft p-3 text-sm">
          <KeyRound size={18} className="mt-0.5 shrink-0 text-gold-ink" />
          <span>
            Você entrou com uma <strong>senha temporária</strong>. Crie uma senha sua em <a href="#seguranca" className="font-semibold underline">Segurança</a>{" "}
            para continuar usando o painel.
          </span>
        </p>
      ) : API_ENABLED ? (
        <p className="mt-1 text-sm text-ink-muted">Tema e cifras ficam salvos neste aparelho; o resto, na sua conta.</p>
      ) : (
        <p className="mt-1 text-sm text-ink-muted">Nesta demonstração os dados ficam salvos só neste navegador.</p>
      )}
      <div className="mt-6 space-y-5">
        {/* key força reinicializar o formulário quando o usuário salvo muda */}
        <PersonalCard key={user.name + user.email} user={user} />
        <MovementCard key={user.movement + user.parish + user.instrument} user={user} />
        <SecurityCard required={Boolean(user.mustChangePassword)} />
        <PrefsCard />
      </div>
    </div>
  );
}

function PersonalCard({ user }: { user: User }) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [busy, setBusy] = useState(false);
  const emailOk = /^\S+@\S+\.\S+$/.test(email);
  const dirty = name.trim() !== user.name || email !== user.email;
  return (
    <Card title="Dados pessoais">
      <PhotoPicker user={user} name={name} />
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim().length < 3 || !emailOk) return;
          void save(setBusy, () => updateUser({ name: name.trim(), email: email.trim() }), "Tudo certo, seu perfil foi atualizado.");
        }}
      >
        <Field
          label="Nome"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={name.trim().length < 3 ? "Informe seu nome completo." : undefined}
        />
        {/* Com a API, trocar o e-mail depende da confirmação por e-mail, que ainda não existe. */}
        <Field
          label="E-mail"
          name="email"
          type="email"
          value={email}
          readOnly={API_ENABLED}
          onChange={(e) => setEmail(e.target.value)}
          error={!emailOk ? "Informe um e-mail válido." : undefined}
          hint={API_ENABLED ? "É o seu login. Para trocar, peça à coordenação." : "Também é o seu login."}
          className={API_ENABLED ? "[&_input]:bg-surface-2 [&_input]:text-ink-muted" : undefined}
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={busy || !dirty || name.trim().length < 3 || !emailOk}>
            {busy && <Loader2 size={16} className="animate-spin" />} Salvar alterações
          </Button>
        </div>
      </form>
    </Card>
  );
}

/** Foto do perfil: com a API, envia (JPG, PNG ou WebP até 2 MB); na demonstração, só as iniciais. */
function PhotoPicker({ user, name }: { user: User; name: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="mb-5 flex items-center gap-4">
      <span className="relative grid h-[72px] w-[72px] shrink-0 place-items-center overflow-hidden rounded-full bg-primary-solid font-serif text-3xl font-semibold text-[#FFFDF8]">
        {user.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto do Blob/API, já no tamanho final
          <img src={user.photoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          initials(name || user.name)
        )}
      </span>
      {API_ENABLED ? (
        <div>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-label="Escolher foto"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              if (file.size > 2 * 1024 * 1024) return toast("A foto pode ter no máximo 2 MB.");
              setBusy(true);
              try {
                await uploadMyPhoto(file);
                toast("Foto atualizada.");
              } catch (err) {
                toast(err instanceof ApiError ? err.message : "Não foi possível enviar a foto.");
              } finally {
                setBusy(false);
              }
            }}
          />
          <Button type="button" variant="secondary" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />} {user.photoUrl ? "Trocar foto" : "Enviar foto"}
          </Button>
          <p className="mt-1.5 text-xs text-ink-muted">JPG, PNG ou WebP, até 2 MB.</p>
        </div>
      ) : (
        <span className="text-sm text-ink-muted">A foto de perfil chega junto com a API.</span>
      )}
    </div>
  );
}

function MovementCard({ user }: { user: User }) {
  const [parish, setParish] = useState(user.parish);
  const [movement, setMovement] = useState({ id: user.movementId, name: user.movement });
  const [instrument, setInstrument] = useState(user.instrument ?? "");
  const [busy, setBusy] = useState(false);
  const dirty = parish !== user.parish || movement.id !== user.movementId || instrument !== (user.instrument ?? "");
  return (
    <Card title="Paróquia e movimento">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save(setBusy, () => updateUser({ parish: parish.trim(), movement: movement.name, movementId: movement.id, instrument }), "Dados atualizados.");
        }}
      >
        <fieldset className="space-y-4">
          <Field label="Paróquia" name="parish" value={parish} maxLength={120} placeholder="Paróquia Catedral São João Batista" onChange={(e) => setParish(e.target.value)} />
          <MovementSelect
            label="Movimento"
            value={movement.id}
            onChange={(m) => setMovement({ id: m?.id ?? null, name: m?.name ?? "" })}
          />
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
              <option value="">Não informado</option>
              {["Violão", "Teclado", "Voz", "Baixo", "Flauta", "Coordenação"].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>
        </fieldset>
        <div className="flex justify-end">
          <Button type="submit" disabled={busy || !dirty}>
            {busy && <Loader2 size={16} className="animate-spin" />} Salvar
          </Button>
        </div>
      </form>
    </Card>
  );
}

function SecurityCard({ required }: { required: boolean }) {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const strength = [next.length >= 6, /\d/.test(next), /[A-Z]/.test(next) || /[^\w]/.test(next), next.length >= 10].filter(Boolean).length;
  return (
    <Card title="Segurança" id="seguranca">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setErr("");
          if (next.length < 8 || passwordScore(next) < 2) return setErr("Use pelo menos 8 caracteres, com letras e números.");
          if (next !== confirm) return setErr("A confirmação não confere com a nova senha.");
          setBusy(true);
          const r = await changePassword(cur, next);
          setBusy(false);
          if (!r.ok) return setErr(r.message);
          setCur("");
          setNext("");
          setConfirm("");
          toast(API_ENABLED ? "Senha alterada. Os outros aparelhos vão pedir para entrar de novo." : "Senha alterada.");
        }}
      >
        {API_ENABLED && !required && <p className="text-sm text-ink-muted">Ao trocar a senha, as sessões abertas em outros aparelhos são encerradas.</p>}
        <fieldset className="space-y-4">
          <Field label={required ? "Senha temporária" : "Senha atual"} name="current" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />
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
        </fieldset>
        <div className="flex justify-end">
          <Button type="submit" disabled={busy || !cur || !next || !confirm}>
            {busy && <Loader2 size={16} className="animate-spin" />} Alterar senha
          </Button>
        </div>
      </form>
    </Card>
  );
}

/** Roda o salvamento com indicador de carregamento e mostra o resultado num toast. */
async function save(setBusy: (v: boolean) => void, run: () => Promise<unknown>, done: string) {
  setBusy(true);
  try {
    await run();
    toast(done);
  } catch (err) {
    toast(err instanceof ApiError ? err.message : "Não foi possível salvar agora. Tente de novo.");
  } finally {
    setBusy(false);
  }
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

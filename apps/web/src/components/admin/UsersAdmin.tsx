"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Ban,
  CircleCheck,
  Copy,
  KeyRound,
  Mail,
  MoreHorizontal,
  Pencil,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  Clock,
  Info,
} from "lucide-react";
import type { User, UserRole, UserStatus } from "@/lib/types";
import { admin, initials, useUser, useUsers } from "@/lib/store";
import { normalize } from "@/lib/search";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toast";

export const ROLE_LABEL: Record<UserRole, string> = { admin: "Administrador", coordenador: "Coordenador", musico: "Músico" };

const STATUS: Record<UserStatus, { label: string; cls: string; dot: string }> = {
  ativo: { label: "Ativo", cls: "bg-success/10 text-success", dot: "bg-success" },
  pendente: { label: "Aguardando e-mail", cls: "bg-gold-soft text-gold-ink", dot: "bg-gold" },
  bloqueado: { label: "Bloqueado", cls: "bg-danger/10 text-danger", dot: "bg-danger" },
};

function relative(iso: string | null) {
  if (!iso) return "Nunca";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "Hoje";
  if (days === 1) return "Ontem";
  if (days < 30) return `Há ${days} dias`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" });
}

type Dialog =
  | { kind: "edit"; user: User }
  | { kind: "block"; user: User }
  | { kind: "password"; user: User }
  | { kind: "delete"; user: User }
  | { kind: "invite" };

export function UsersAdmin() {
  const users = useUsers();
  const me = useUser();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<UserStatus | "todos">("todos");
  const [role, setRole] = useState<UserRole | "todos">("todos");
  const [dialog, setDialog] = useState<Dialog | null>(null);

  const counts = useMemo(
    () => ({
      todos: users.length,
      ativo: users.filter((u) => u.status === "ativo").length,
      pendente: users.filter((u) => u.status === "pendente").length,
      bloqueado: users.filter((u) => u.status === "bloqueado").length,
    }),
    [users],
  );

  const list = useMemo(() => {
    const nq = normalize(q.trim());
    return users
      .filter((u) => status === "todos" || u.status === status)
      .filter((u) => role === "todos" || u.role === role)
      .filter((u) => !nq || normalize(`${u.name} ${u.email} ${u.ministry}`).includes(nq))
      .sort((a, b) => {
        const order = { pendente: 0, bloqueado: 1, ativo: 2 };
        return order[a.status] - order[b.status] || a.name.localeCompare(b.name, "pt-BR");
      });
  }, [users, q, status, role]);

  const close = () => setDialog(null);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-gold-ink">
            <ShieldCheck size={14} /> Administração
          </p>
          <h1 className="font-serif text-[32px] font-semibold text-primary sm:text-[40px]">Usuários</h1>
        </div>
        <Button onClick={() => setDialog({ kind: "invite" })}>
          <UserPlus size={18} /> Convidar usuário
        </Button>
      </div>

      <div className="mt-4 flex gap-3 rounded-[10px] border border-gold/40 bg-gold-soft p-3 text-sm">
        <Info size={18} className="mt-0.5 shrink-0 text-gold-ink" />
        <p>
          <strong>Demonstração:</strong> as alterações ficam salvas só neste navegador. Envio de e-mails, bloqueio real e senhas
          dependem da API e do banco de dados (veja <code className="font-mono text-xs">planning.md</code>).
        </p>
      </div>

      {/* Resumo por status (clicável como filtro) */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(
          [
            ["todos", "Total", Users, "text-primary"],
            ["ativo", "Ativos", CircleCheck, "text-success"],
            ["pendente", "Aguardando e-mail", Clock, "text-gold-ink"],
            ["bloqueado", "Bloqueados", Ban, "text-danger"],
          ] as const
        ).map(([id, label, Icon, color]) => (
          <button
            key={id}
            aria-pressed={status === id}
            onClick={() => setStatus(id)}
            className="rounded-[10px] border border-border bg-surface p-4 text-left shadow-card transition hover:shadow-raised aria-pressed:border-primary aria-pressed:ring-1 aria-pressed:ring-primary"
          >
            <Icon size={20} className={color} />
            <p className="mt-2 font-serif text-3xl font-semibold leading-none [font-variant-numeric:lining-nums]">{counts[id]}</p>
            <p className="mt-1 text-sm text-ink-muted">{label}</p>
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <label className="relative min-w-[220px] flex-1">
          <span className="sr-only">Buscar usuário</span>
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome, e-mail ou ministério"
            className="h-11 w-full rounded-[10px] border border-border bg-surface pl-10 pr-3 outline-none focus:border-primary focus:ring-2 focus:ring-gold/40"
          />
        </label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as typeof role)}
          aria-label="Filtrar por papel"
          className="h-11 rounded-[10px] border border-border bg-surface px-3"
        >
          <option value="todos">Todos os papéis</option>
          {Object.entries(ROLE_LABEL).map(([id, l]) => (
            <option key={id} value={id}>
              {l}
            </option>
          ))}
        </select>
      </div>

      <p className="mt-4 text-sm text-ink-muted" aria-live="polite">
        {list.length} {list.length === 1 ? "usuário" : "usuários"}
      </p>

      {/* Tabela (desktop) */}
      <div className="mt-2 hidden overflow-hidden rounded-[16px] border border-border bg-surface shadow-card lg:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-2 text-xs uppercase tracking-[0.08em] text-ink-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Usuário</th>
              <th className="px-4 py-3 font-semibold">Papel</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Último acesso</th>
              <th className="px-4 py-3 font-semibold">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {list.map((u) => (
              <tr key={u.id} className="align-middle hover:bg-surface-2/60">
                <td className="px-4 py-3">
                  <UserIdentity user={u} isMe={u.id === me.id} />
                </td>
                <td className="px-4 py-3">{ROLE_LABEL[u.role]}</td>
                <td className="px-4 py-3">
                  <StatusBadge user={u} />
                </td>
                <td className="px-4 py-3 text-ink-muted">{relative(u.lastLoginAt)}</td>
                <td className="px-4 py-3 text-right">
                  <UserActions user={u} isMe={u.id === me.id} open={setDialog} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <p className="px-4 py-10 text-center text-ink-muted">Nenhum usuário com esses filtros.</p>}
      </div>

      {/* Cards (mobile/tablet) */}
      <ul className="mt-2 space-y-3 lg:hidden">
        {list.map((u) => (
          <li key={u.id} className="rounded-[10px] border border-border bg-surface p-4 shadow-card">
            <div className="flex items-start justify-between gap-2">
              <UserIdentity user={u} isMe={u.id === me.id} />
              <UserActions user={u} isMe={u.id === me.id} open={setDialog} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <StatusBadge user={u} />
              <span className="text-ink-muted">{ROLE_LABEL[u.role]}</span>
              <span className="text-ink-muted">Último acesso: {relative(u.lastLoginAt)}</span>
            </div>
          </li>
        ))}
        {list.length === 0 && <li className="py-10 text-center text-ink-muted">Nenhum usuário com esses filtros.</li>}
      </ul>

      {dialog?.kind === "edit" && <EditDialog user={dialog.user} isMe={dialog.user.id === me.id} onClose={close} />}
      {dialog?.kind === "block" && <BlockDialog user={dialog.user} onClose={close} />}
      {dialog?.kind === "password" && <PasswordDialog user={dialog.user} onClose={close} />}
      {dialog?.kind === "delete" && <DeleteDialog user={dialog.user} onClose={close} />}
      {dialog?.kind === "invite" && <InviteDialog onClose={close} />}
    </div>
  );
}

function UserIdentity({ user, isMe }: { user: User; isMe: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-soft font-serif text-lg font-semibold text-primary">
        {initials(user.name) || "?"}
      </span>
      <div className="min-w-0">
        <p className="truncate font-semibold">
          {user.name}
          {isMe && <span className="ml-2 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-ink-muted">você</span>}
        </p>
        <p className="truncate text-sm text-ink-muted">{user.email}</p>
        {user.ministry && <p className="truncate text-xs text-ink-muted">{user.ministry}</p>}
      </div>
    </div>
  );
}

function StatusBadge({ user }: { user: User }) {
  const s = STATUS[user.status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${s.cls}`} title={user.blockedReason}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} /> {s.label}
    </span>
  );
}

function UserActions({ user, isMe, open }: { user: User; isMe: boolean; open: (d: Dialog) => void }) {
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setMenu(false);
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  const item = "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm hover:bg-primary-soft disabled:pointer-events-none disabled:opacity-40";
  const run = (fn: () => void) => () => {
    setMenu(false);
    fn();
  };

  return (
    <div className="relative inline-block text-left" ref={ref}>
      <button aria-label={`Ações para ${user.name}`} aria-expanded={menu} onClick={() => setMenu((v) => !v)} className="grid h-10 w-10 place-items-center rounded-full text-ink-muted hover:bg-surface-2">
        <MoreHorizontal size={20} />
      </button>
      {menu && (
        <div role="menu" className="animate-fade-in absolute right-0 top-11 z-20 w-64 rounded-[10px] border border-border bg-surface p-1.5 shadow-overlay">
          <button role="menuitem" className={item} onClick={run(() => open({ kind: "edit", user }))}>
            <Pencil size={16} /> Editar dados e papel
          </button>
          <button role="menuitem" className={item} onClick={run(() => open({ kind: "password", user }))}>
            <KeyRound size={16} /> Redefinir senha
          </button>
          {user.status === "pendente" && (
            <>
              <button
                role="menuitem"
                className={item}
                onClick={run(() => {
                  admin.resendVerification(user.id);
                  toast(`E-mail de confirmação reenviado para ${user.email}.`);
                })}
              >
                <Mail size={16} /> Reenviar confirmação de e-mail
              </button>
              <button
                role="menuitem"
                className={item}
                onClick={run(() => {
                  admin.activate(user.id);
                  toast(`${user.name} foi ativado(a) manualmente.`);
                })}
              >
                <CircleCheck size={16} /> Ativar sem confirmação
              </button>
            </>
          )}
          <div className="my-1 border-t border-border" />
          {user.status === "bloqueado" ? (
            <button
              role="menuitem"
              className={item}
              onClick={run(() => {
                admin.unblock(user.id);
                toast(`Acesso de ${user.name} liberado.`);
              })}
            >
              <ShieldCheck size={16} /> Liberar acesso
            </button>
          ) : (
            <button role="menuitem" disabled={isMe} title={isMe ? "Você não pode bloquear a si mesmo" : undefined} className={`${item} text-danger`} onClick={run(() => open({ kind: "block", user }))}>
              <Ban size={16} /> Bloquear acesso
            </button>
          )}
          <button role="menuitem" disabled={isMe} className={`${item} text-danger hover:bg-danger/10`} onClick={run(() => open({ kind: "delete", user }))}>
            <Trash2 size={16} /> Excluir usuário
          </button>
        </div>
      )}
    </div>
  );
}

function EditDialog({ user, isMe, onClose }: { user: User; isMe: boolean; onClose: () => void }) {
  const [form, setForm] = useState({ name: user.name, email: user.email, role: user.role, ministry: user.ministry });
  const valid = form.name.trim().length >= 3 && /^\S+@\S+\.\S+$/.test(form.email);
  return (
    <Modal
      title="Editar usuário"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!valid}
            onClick={() => {
              admin.update(user.id, form);
              toast("Usuário atualizado.");
              onClose();
            }}
          >
            Salvar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Nome" name="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Field
          label="E-mail"
          name="email"
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          hint="Ao trocar o e-mail, a API enviará uma nova confirmação."
        />
        <Field label="Ministério" name="ministry" value={form.ministry} onChange={(e) => setForm({ ...form, ministry: e.target.value })} />
        <div>
          <label htmlFor="role" className="mb-1.5 block text-sm font-medium">
            Papel
          </label>
          <select
            id="role"
            value={form.role}
            disabled={isMe}
            onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
            className="h-11 w-full rounded-[6px] border border-border bg-surface px-3 disabled:opacity-60"
          >
            {Object.entries(ROLE_LABEL).map(([id, l]) => (
              <option key={id} value={id}>
                {l}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-sm text-ink-muted">
            {isMe ? "Você não pode alterar o próprio papel." : "Administrador gerencia usuários; Coordenador monta e compartilha missas; Músico usa o repertório."}
          </p>
        </div>
      </div>
    </Modal>
  );
}

function BlockDialog({ user, onClose }: { user: User; onClose: () => void }) {
  const [reason, setReason] = useState("");
  return (
    <Modal
      title="Bloquear acesso"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <button
            onClick={() => {
              admin.block(user.id, reason);
              toast(`${user.name} foi bloqueado(a).`, { label: "Desfazer", onClick: () => admin.unblock(user.id) });
              onClose();
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-danger px-4 text-[15px] font-semibold text-white hover:opacity-90"
          >
            <Ban size={18} /> Bloquear
          </button>
        </>
      }
    >
      <p>
        <strong>{user.name}</strong> não poderá mais entrar no site. As missas montadas por essa pessoa continuam salvas. Você pode liberar o acesso
        depois.
      </p>
      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm font-medium">Motivo (aparece para a pessoa ao tentar entrar)</span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Ex.: Cadastro duplicado."
          className="w-full rounded-[6px] border border-border bg-surface p-3 outline-none focus:border-primary focus:ring-2 focus:ring-gold/40"
        />
      </label>
    </Modal>
  );
}

function PasswordDialog({ user, onClose }: { user: User; onClose: () => void }) {
  const [temp, setTemp] = useState<string | null>(null);
  return (
    <Modal title="Redefinir senha" onClose={onClose} footer={<Button onClick={onClose}>Concluir</Button>}>
      <p className="text-ink-muted">
        Escolha como <strong className="text-ink">{user.name}</strong> vai criar uma nova senha.
      </p>
      <div className="mt-4 space-y-3">
        <button
          onClick={() => {
            admin.sendResetLink(user.id);
            toast(`Link de redefinição enviado para ${user.email}.`);
            onClose();
          }}
          className="flex w-full items-start gap-3 rounded-[10px] border border-border p-4 text-left hover:border-primary hover:bg-primary-soft"
        >
          <Mail size={20} className="mt-0.5 shrink-0 text-primary" />
          <span>
            <span className="block font-semibold">Enviar link por e-mail (recomendado)</span>
            <span className="text-sm text-ink-muted">A pessoa recebe um link válido por 1 hora e escolhe a própria senha.</span>
          </span>
        </button>
        <button
          onClick={() => setTemp(admin.temporaryPassword(user.id))}
          className="flex w-full items-start gap-3 rounded-[10px] border border-border p-4 text-left hover:border-primary hover:bg-primary-soft"
        >
          <KeyRound size={20} className="mt-0.5 shrink-0 text-primary" />
          <span>
            <span className="block font-semibold">Gerar senha temporária</span>
            <span className="text-sm text-ink-muted">Para quem não tem acesso ao e-mail. A troca será exigida no próximo login.</span>
          </span>
        </button>
      </div>
      {temp && (
        <div className="mt-4 rounded-[10px] bg-surface-2 p-4">
          <p className="text-sm text-ink-muted">Senha temporária (mostrada só agora):</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 rounded-md bg-surface px-3 py-2 font-mono text-lg">{temp}</code>
            <Button
              variant="secondary"
              onClick={() => {
                navigator.clipboard?.writeText(temp).catch(() => {});
                toast("Senha copiada.");
              }}
            >
              <Copy size={16} /> Copiar
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function DeleteDialog({ user, onClose }: { user: User; onClose: () => void }) {
  return (
    <Modal
      title="Excluir usuário"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <button
            onClick={() => {
              const undo = admin.remove(user.id);
              toast(`${user.name} foi excluído(a).`, { label: "Desfazer", onClick: undo });
              onClose();
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-danger px-4 text-[15px] font-semibold text-white hover:opacity-90"
          >
            <Trash2 size={18} /> Excluir
          </button>
        </>
      }
    >
      <p>
        Excluir <strong>{user.name}</strong> ({user.email})? Se a intenção é só impedir o acesso, prefira <strong>bloquear</strong>, que pode ser
        desfeito a qualquer momento.
      </p>
    </Modal>
  );
}

function InviteDialog({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", role: "musico" as UserRole });
  const [error, setError] = useState("");
  const valid = form.name.trim().length >= 3 && /^\S+@\S+\.\S+$/.test(form.email);
  return (
    <Modal
      title="Convidar usuário"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!valid}
            onClick={() => {
              if (!admin.invite(form)) return setError("Já existe um usuário com este e-mail.");
              toast(`Convite enviado para ${form.email}.`);
              onClose();
            }}
          >
            <Mail size={18} /> Enviar convite
          </Button>
        </>
      }
    >
      <p className="mb-4 text-sm text-ink-muted">
        A pessoa recebe um e-mail para confirmar o endereço e criar a senha. Até lá, aparece como “Aguardando e-mail”.
      </p>
      <div className="space-y-4">
        <Field label="Nome" name="invite-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Field label="E-mail" name="invite-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={error || undefined} />
        <div>
          <label htmlFor="invite-role" className="mb-1.5 block text-sm font-medium">
            Papel
          </label>
          <select id="invite-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })} className="h-11 w-full rounded-[6px] border border-border bg-surface px-3">
            {Object.entries(ROLE_LABEL).map(([id, l]) => (
              <option key={id} value={id}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Modal>
  );
}

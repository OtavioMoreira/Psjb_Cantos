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
  Loader2,
} from "lucide-react";
import type { User, UserRole, UserStatus } from "@/lib/types";
import { admin, initials, syncAdminUsers, useUser, useUsers } from "@/lib/store";
import { API_ENABLED, ApiError } from "@/lib/api";
import { normalize } from "@/lib/search";
import { BULK_INVITE_MAX, parseInviteList } from "@/lib/inviteList";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { MovementSelect } from "@/components/user/MovementSelect";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/components/ui/Toast";

export const ROLE_LABEL: Record<UserRole, string> = { admin: "Administrador", musico: "Músico" };

const STATUS: Record<UserStatus, { label: string; cls: string; dot: string }> = {
  ativo: { label: "Ativo", cls: "bg-success/10 text-success", dot: "bg-success" },
  // Com a API, a conta nova espera um admin ativar; na demonstração, a confirmação do e-mail.
  pendente: { label: API_ENABLED ? "Aguardando ativação" : "Aguardando e-mail", cls: "bg-gold-soft text-gold-ink", dot: "bg-gold" },
  bloqueado: { label: "Bloqueado", cls: "bg-danger/10 text-danger", dot: "bg-danger" },
};

const countsFrom = (c: { all: number; active: number; pending: number; blocked: number }) => ({
  todos: c.all,
  ativo: c.active,
  pendente: c.pending,
  bloqueado: c.blocked,
});

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

const errorText = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

const PAGE = 50;
const TO_API_STATUS = { ativo: "active", pendente: "pending", bloqueado: "blocked" } as const;

type ServerPage = { key: string; ids: string[]; total: number; page: number; counts: Record<UserStatus | "todos", number> };

export function UsersAdmin() {
  const users = useUsers();
  const me = useUser();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<UserStatus | "todos">("todos");
  const [role, setRole] = useState<UserRole | "todos">("todos");
  const [dialog, setDialog] = useState<Dialog | null>(null);

  // Com a API, filtros, busca e paginação são feitos no servidor; a cópia local de cada conta fica no store.
  const [server, setServer] = useState<ServerPage | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [reload, setReload] = useState(0);
  const query = useMemo(
    () => ({ q: q.trim() || undefined, status: status === "todos" ? undefined : TO_API_STATUS[status], role: role === "todos" ? undefined : role }),
    [q, status, role],
  );
  const key = JSON.stringify(query);

  useEffect(() => {
    if (!API_ENABLED) return;
    let alive = true;
    // Espera 300 ms: não chama a API a cada letra digitada.
    const t = setTimeout(() => {
      syncAdminUsers({ ...query, page: 1, pageSize: PAGE })
        .then((r) => alive && (setServer({ key, ids: r.ids, total: r.total, page: 1, counts: countsFrom(r.counts) }), setLoadError(null)))
        .catch((e) => alive && setLoadError(e instanceof ApiError ? e.message : "Não foi possível carregar os usuários."));
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query, key, reload]);

  const loadMore = async () => {
    if (!server) return;
    setMore(true);
    try {
      const r = await syncAdminUsers({ ...query, page: server.page + 1, pageSize: PAGE });
      setServer({ ...server, ids: [...server.ids, ...r.ids.filter((id) => !server.ids.includes(id))], page: server.page + 1, total: r.total });
    } catch (e) {
      toast(errorText(e, "Não foi possível carregar mais usuários."));
    } finally {
      setMore(false);
    }
  };

  const localCounts = useMemo(
    () => ({
      todos: users.length,
      ativo: users.filter((u) => u.status === "ativo").length,
      pendente: users.filter((u) => u.status === "pendente").length,
      bloqueado: users.filter((u) => u.status === "bloqueado").length,
    }),
    [users],
  );

  const localList = useMemo(() => {
    if (API_ENABLED) return [];
    const nq = normalize(q.trim());
    return users
      .filter((u) => status === "todos" || u.status === status)
      .filter((u) => role === "todos" || u.role === role)
      .filter((u) => !nq || normalize(`${u.name} ${u.email} ${u.movement}`).includes(nq))
      .sort((a, b) => {
        const order = { pendente: 0, bloqueado: 1, ativo: 2 };
        return order[a.status] - order[b.status] || a.name.localeCompare(b.name, "pt-BR");
      });
  }, [users, q, status, role]);

  // Excluídos somem do store, então somem daqui também (e voltam no "Desfazer").
  const serverList = useMemo(() => {
    const byId = new Map(users.map((u) => [u.id, u]));
    return (server?.ids ?? []).map((id) => byId.get(id)).filter((u): u is User => Boolean(u));
  }, [server, users]);

  const list = API_ENABLED ? serverList : localList;
  const counts = API_ENABLED ? (server?.counts ?? { todos: 0, ativo: 0, pendente: 0, bloqueado: 0 }) : localCounts;
  const total = API_ENABLED ? (server?.total ?? 0) : localList.length;
  const loading = API_ENABLED && (!server || server.key !== key) && !loadError;

  const close = () => {
    setDialog(null);
    // Convite, bloqueio e edição mudam a lista e o resumo: busca de novo.
    if (API_ENABLED) setReload((n) => n + 1);
  };

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
        {API_ENABLED ? (
          <p>
            <strong>Servidor:</strong> todas as ações usam a API. Convites, links de redefinição de senha e o aviso de conta liberada saem por
            e-mail.
          </p>
        ) : (
          <p>
            <strong>Demonstração:</strong> as alterações ficam salvas só neste navegador. Envio de e-mails, bloqueio real e senhas dependem da
            API e do banco de dados (veja <code className="font-mono text-xs">planning.md</code>).
          </p>
        )}
      </div>

      {/* Resumo por status (clicável como filtro) */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(
          [
            ["todos", "Total", Users, "text-primary"],
            ["ativo", "Ativos", CircleCheck, "text-success"],
            ["pendente", STATUS.pendente.label, Clock, "text-gold-ink"],
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
            placeholder="Buscar por nome, e-mail ou movimento"
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
        {loading ? "Carregando…" : `${total} ${total === 1 ? "usuário" : "usuários"}`}
      </p>
      {loadError && (
        <p role="alert" className="mt-2 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {loadError}
        </p>
      )}

      {/* Tabela (desktop) */}
      <div className="mt-2 hidden rounded-[16px] border border-border bg-surface shadow-card lg:block">
        <table className="w-full text-left text-sm">
          {/* Sem overflow-hidden no contêiner: o menu de ações das últimas linhas seria cortado. */}
          <thead className="bg-surface-2 text-xs uppercase tracking-[0.08em] text-ink-muted [&_th:first-child]:rounded-tl-[16px] [&_th:last-child]:rounded-tr-[16px]">
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
        {!loading && list.length === 0 && <p className="px-4 py-10 text-center text-ink-muted">Nenhum usuário com esses filtros.</p>}
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
        {!loading && list.length === 0 && <li className="py-10 text-center text-ink-muted">Nenhum usuário com esses filtros.</li>}
      </ul>

      {API_ENABLED && server && server.ids.length < server.total && (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" onClick={loadMore} disabled={more}>
            {more && <Loader2 size={16} className="animate-spin" />} Mostrar mais ({server.total - server.ids.length})
          </Button>
        </div>
      )}

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
        {user.movement && <p className="truncate text-xs text-ink-muted">{user.movement}</p>}
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
              {/* Com a API, a conta pendente espera um admin (ou o convidado criar a senha), não a confirmação do e-mail. */}
              {API_ENABLED ? (
                <button
                  role="menuitem"
                  className={item}
                  onClick={run(async () => {
                    try {
                      await admin.resendInvite(user.id);
                      toast(`Convite enviado para ${user.email}.`);
                    } catch (e) {
                      toast(errorText(e, "Não foi possível enviar o convite agora."));
                    }
                  })}
                >
                  <Mail size={16} /> Enviar convite por e-mail
                </button>
              ) : (
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
              )}
              <button
                role="menuitem"
                className={item}
                onClick={run(async () => {
                  try {
                    await admin.activate(user.id);
                    toast(API_ENABLED ? `${user.name} já pode entrar.` : `${user.name} foi ativado(a) manualmente.`);
                  } catch (e) {
                    toast(errorText(e, "Não foi possível ativar agora."));
                  }
                })}
              >
                <CircleCheck size={16} /> {API_ENABLED ? "Ativar acesso" : "Ativar sem confirmação"}
              </button>
            </>
          )}
          <div className="my-1 border-t border-border" />
          {user.status === "bloqueado" ? (
            <button
              role="menuitem"
              className={item}
              onClick={run(async () => {
                try {
                  await admin.unblock(user.id);
                  toast(`Acesso de ${user.name} liberado.`);
                } catch (e) {
                  toast(errorText(e, "Não foi possível liberar agora."));
                }
              })}
            >
              <ShieldCheck size={16} /> Liberar acesso
            </button>
          ) : (
            <button role="menuitem" disabled={isMe} title={isMe ? "Você não pode bloquear a si mesmo" : undefined} className={`${item} text-danger`} onClick={run(() => open({ kind: "block", user }))}>
              <Ban size={16} /> Bloquear acesso
            </button>
          )}
          <button role="menuitem" disabled={isMe} title={isMe ? "Você não pode excluir a si mesmo" : undefined} className={`${item} text-danger hover:bg-danger/10`} onClick={run(() => open({ kind: "delete", user }))}>
            <Trash2 size={16} /> Excluir usuário
          </button>
        </div>
      )}
    </div>
  );
}

function EditDialog({ user, isMe, onClose }: { user: User; isMe: boolean; onClose: () => void }) {
  const [form, setForm] = useState({ name: user.name, email: user.email, role: user.role, movement: user.movement, movementId: user.movementId });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
            disabled={!valid || busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await admin.update(user.id, { ...form, name: form.name.trim(), email: form.email.trim() });
                toast("Usuário atualizado.");
                onClose();
              } catch (e) {
                setError(errorText(e, "Não foi possível salvar agora."));
                setBusy(false);
              }
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
          hint={API_ENABLED ? "É o login da pessoa. Avise sobre a troca, porque ela vai entrar com o novo e-mail." : "Ao trocar o e-mail, a API enviará uma nova confirmação."}
        />
        <MovementSelect
          id="edit-movement"
          label="Movimento"
          value={form.movementId}
          onChange={(m) => setForm({ ...form, movement: m?.name ?? "", movementId: m?.id ?? null })}
        />
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
            {isMe ? "Você não pode alterar o próprio papel." : "Administrador gerencia usuários; Músico usa o repertório e monta e compartilha missas."}
          </p>
        </div>
        {error && (
          <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

function BlockDialog({ user, onClose }: { user: User; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
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
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await admin.block(user.id, reason);
                toast(`${user.name} foi bloqueado(a).`, {
                  label: "Desfazer",
                  onClick: () => void admin.unblock(user.id).catch((e) => toast(errorText(e, "Não foi possível desfazer."))),
                });
                onClose();
              } catch (e) {
                toast(errorText(e, "Não foi possível bloquear agora."));
                setBusy(false);
              }
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-danger px-4 text-[15px] font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            <Ban size={18} /> Bloquear
          </button>
        </>
      }
    >
      <p>
        <strong>{user.name}</strong> não poderá mais entrar no site{API_ENABLED ? " e sai na hora dos aparelhos em que estava conectado(a)" : ""}. As
        missas montadas por essa pessoa continuam salvas. Você pode liberar o acesso depois.
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
  const [busy, setBusy] = useState(false);
  // Na API, o link só vai para conta ativa (pendente recebe o convite; bloqueado não entraria).
  const linkBlocked = API_ENABLED && user.status !== "ativo";
  return (
    <Modal title="Redefinir senha" onClose={onClose} footer={<Button onClick={onClose}>Concluir</Button>}>
      <p className="text-ink-muted">
        Escolha como <strong className="text-ink">{user.name}</strong> vai criar uma nova senha.
      </p>
      <div className="mt-4 space-y-3">
        <button
          disabled={busy || linkBlocked}
          title={linkBlocked ? "Só para contas ativas" : undefined}
          onClick={async () => {
            setBusy(true);
            try {
              await admin.sendResetLink(user.id);
              toast(`Link de redefinição enviado para ${user.email}.`);
              onClose();
            } catch (e) {
              toast(errorText(e, "Não foi possível enviar o link agora."));
              setBusy(false);
            }
          }}
          className="flex w-full items-start gap-3 rounded-[10px] border border-border p-4 text-left hover:border-primary hover:bg-primary-soft disabled:pointer-events-none disabled:opacity-50"
        >
          <Mail size={20} className="mt-0.5 shrink-0 text-primary" />
          <span>
            <span className="block font-semibold">Enviar link por e-mail (recomendado)</span>
            <span className="text-sm text-ink-muted">
              {linkBlocked ? "Só para contas ativas. Para quem ainda não entrou, use “Enviar convite por e-mail”." : "A pessoa recebe um link válido por 1 hora e escolhe a própria senha."}
            </span>
          </span>
        </button>
        <button
          disabled={busy || temp !== null}
          onClick={async () => {
            setBusy(true);
            try {
              setTemp(await admin.temporaryPassword(user.id));
            } catch (e) {
              toast(errorText(e, "Não foi possível gerar a senha agora."));
            } finally {
              setBusy(false);
            }
          }}
          className="flex w-full items-start gap-3 rounded-[10px] border border-border p-4 text-left hover:border-primary hover:bg-primary-soft disabled:pointer-events-none disabled:opacity-50"
        >
          <KeyRound size={20} className="mt-0.5 shrink-0 text-primary" />
          <span>
            <span className="block font-semibold">Gerar senha temporária</span>
            <span className="text-sm text-ink-muted">
              Para quem não tem acesso ao e-mail. A troca será exigida no próximo login{API_ENABLED ? ", e a pessoa sai dos aparelhos conectados" : ""}.
            </span>
          </span>
        </button>
      </div>
      {temp && (
        <div className="mt-4 rounded-[10px] bg-surface-2 p-4">
          <p className="text-sm text-ink-muted">Senha temporária (mostrada só agora; passe para a pessoa por um canal seguro):</p>
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
              const undo = admin.remove(user.id, (e) => toast(errorText(e, `Não foi possível excluir ${user.name}.`)));
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
      {API_ENABLED && (
        <p className="mt-3 text-sm text-ink-muted">
          As missas criadas por essa pessoa também são apagadas, e quem as recebeu perde o acesso. Missas de outras pessoas não mudam.
        </p>
      )}
    </Modal>
  );
}

function InviteDialog({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<"one" | "many">("one");
  return mode === "one" ? <InviteOne onClose={onClose} onMany={() => setMode("many")} /> : <InviteMany onClose={onClose} onOne={() => setMode("one")} />;
}

function RoleSelect({ id, value, onChange }: { id: string; value: UserRole; onChange: (r: UserRole) => void }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        Papel
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as UserRole)} className="h-11 w-full rounded-[6px] border border-border bg-surface px-3">
        {Object.entries(ROLE_LABEL).map(([k, l]) => (
          <option key={k} value={k}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}

const INVITE_HELP = API_ENABLED
  ? "A pessoa recebe um e-mail com um link (válido por 7 dias) para criar a senha. Até lá, aparece como “Aguardando ativação”."
  : "A pessoa recebe um e-mail para confirmar o endereço e criar a senha. Até lá, aparece como “Aguardando e-mail”.";

function InviteOne({ onClose, onMany }: { onClose: () => void; onMany: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", role: "musico" as UserRole });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
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
            disabled={!valid || busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                if (!(await admin.invite(form))) return setError("Já existe um usuário com este e-mail.");
                toast(`Convite enviado para ${form.email}.`);
                onClose();
              } catch (e) {
                toast(errorText(e, "Não foi possível enviar o convite agora."));
                onClose();
              } finally {
                setBusy(false);
              }
            }}
          >
            <Mail size={18} /> Enviar convite
          </Button>
        </>
      }
    >
      <p className="mb-4 text-sm text-ink-muted">{INVITE_HELP}</p>
      <div className="space-y-4">
        <Field label="Nome" name="invite-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Field label="E-mail" name="invite-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={error || undefined} />
        <RoleSelect id="invite-role" value={form.role} onChange={(role) => setForm({ ...form, role })} />
        <button type="button" onClick={onMany} className="min-h-11 text-sm font-medium text-primary underline-offset-2 hover:underline">
          Convidar várias pessoas de uma vez
        </button>
      </div>
    </Modal>
  );
}

const BULK_STATUS: Record<"invited" | "exists" | "email_failed", { label: string; cls: string }> = {
  invited: { label: "Convite enviado", cls: "text-success" },
  exists: { label: "Já tem conta", cls: "text-ink-muted" },
  email_failed: { label: "E-mail não saiu: use “Reenviar convite”", cls: "text-danger" },
};

function InviteMany({ onClose, onOne }: { onClose: () => void; onOne: () => void }) {
  const [text, setText] = useState("");
  const [role, setRole] = useState<UserRole>("musico");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Awaited<ReturnType<typeof admin.inviteBulk>> | null>(null);
  const { people, problems } = useMemo(() => parseInviteList(text), [text]);
  const tooMany = people.length > BULK_INVITE_MAX;
  const guessed = people.filter((p) => p.guessed).length;

  if (results) {
    const sent = results.filter((r) => r.status === "invited").length;
    return (
      <Modal title="Convites enviados" onClose={onClose} footer={<Button onClick={onClose}>Fechar</Button>}>
        <p className="mb-3 text-sm text-ink-muted">
          {sent} de {results.length} convite{results.length === 1 ? "" : "s"} enviado{sent === 1 ? "" : "s"}.
        </p>
        <ul className="max-h-[50vh] divide-y divide-border overflow-y-auto rounded-[6px] border border-border">
          {results.map((r) => (
            <li key={r.email} className="px-3 py-2 text-sm">
              <span className="block break-words font-medium">{r.name}</span>
              <span className="block break-all text-ink-muted">{r.email}</span>
              <span className={`block text-xs font-medium ${BULK_STATUS[r.status].cls}`}>{BULK_STATUS[r.status].label}</span>
            </li>
          ))}
        </ul>
      </Modal>
    );
  }

  return (
    <Modal
      title="Convidar várias pessoas"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onOne}>
            Voltar
          </Button>
          <Button
            disabled={!people.length || tooMany || busy}
            onClick={async () => {
              setBusy(true);
              try {
                setResults(await admin.inviteBulk(people.map(({ name, email }) => ({ name, email })), role));
              } catch (e) {
                toast(errorText(e, "Não foi possível enviar os convites agora."));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Mail size={18} />}
            {busy ? "Enviando…" : `Enviar ${people.length || ""} convite${people.length === 1 ? "" : "s"}`}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-ink-muted">
        Cole a lista, uma pessoa por linha: <span className="font-medium text-ink">Nome; e-mail</span> (também vale copiar da planilha ou só o e-mail). Até{" "}
        {BULK_INVITE_MAX} por vez. {INVITE_HELP}
      </p>
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Lista</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            placeholder={"Maria Souza; maria@gmail.com\nJoão Lima; joao@gmail.com"}
            className="w-full rounded-[6px] border border-border bg-surface p-3 font-mono text-sm outline-none focus:border-primary focus:ring-2 focus:ring-gold/40"
          />
        </label>
        <RoleSelect id="invite-many-role" value={role} onChange={setRole} />
        {(people.length > 0 || problems.length > 0) && (
          <div className="space-y-1 text-sm" aria-live="polite">
            <p className={tooMany ? "text-danger" : "text-ink"}>
              {people.length} pessoa{people.length === 1 ? "" : "s"} pronta{people.length === 1 ? "" : "s"}
              {tooMany ? `: o máximo é ${BULK_INVITE_MAX} por vez.` : "."}
              {guessed > 0 && !tooMany && <span className="text-ink-muted"> {guessed} sem nome na lista: o nome foi tirado do e-mail (a pessoa ajusta no perfil).</span>}
            </p>
            {problems.length > 0 && (
              <ul className="space-y-0.5 text-danger">
                {problems.map((p) => (
                  <li key={p.line} className="break-words">
                    Linha {p.line} ({p.text}): {p.reason} Fica de fora.
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

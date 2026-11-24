import { describe, expect, it } from "vitest";
import { dbUrl, useTestDb } from "../support/db.js";

describe.skipIf(!dbUrl)("PgAuditRepository", () => {
  const { repos, factory, pool } = useTestDb();

  it("grava, lista do mais recente ao mais antigo, pagina e filtra; o nome fica se a conta for excluída", async () => {
    const admin = await factory.user({ name: "Padre João", roles: ["admin"] });
    const base = { actorId: admin.id, actorName: "Padre João", targetLabel: null, details: {} };
    await repos.audit.record({ ...base, action: "flag.create", targetType: "flag", targetId: "1" });
    await repos.audit.record({ ...base, action: "user.block", targetType: "user", targetId: "u1", details: { reason: "Duplicada" } });
    await repos.audit.record({ ...base, action: "song.update", targetType: "song", targetId: "7", targetLabel: "A".repeat(300) });

    const all = await repos.audit.list({ page: 1, pageSize: 2 });
    expect(all.total).toBe(3);
    expect(all.entries.map((e) => e.action)).toEqual(["song.update", "user.block"]);
    expect(all.entries[0].targetLabel).toHaveLength(200);
    expect(all.entries[1].details).toEqual({ reason: "Duplicada" });
    expect((await repos.audit.list({ page: 2, pageSize: 2 })).entries.map((e) => e.action)).toEqual(["flag.create"]);
    expect(await repos.audit.list({ page: 9, pageSize: 2 })).toEqual({ entries: [], total: 3 });
    expect((await repos.audit.list({ targetType: "user", targetId: "u1", page: 1, pageSize: 10 })).total).toBe(1);

    await repos.users.delete(admin.id);
    const after = await repos.audit.list({ page: 1, pageSize: 10 });
    expect(after.entries.every((e) => e.actorId === null && e.actorName === "Padre João")).toBe(true);
    await expect(pool.query("INSERT INTO audit_log (actor_name, action, target_type) VALUES ('x', 'y', 'mass')")).rejects.toThrow();
  });
});

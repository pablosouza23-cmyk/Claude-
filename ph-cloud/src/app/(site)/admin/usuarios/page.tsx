import { desc, inArray } from "drizzle-orm";
import { formatDate } from "@/config/site";
import { ACTIVE_SUBSCRIPTION_STATUSES, getPlan } from "@/config/plans";
import { getDb, schema } from "@/server/db";

export default async function AdminUsersPage() {
  const db = await getDb();
  const users = await db
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email, role: schema.users.role, createdAt: schema.users.createdAt })
    .from(schema.users)
    .orderBy(desc(schema.users.createdAt))
    .limit(200);
  const subs = users.length
    ? await db
        .select({ userId: schema.subscriptions.userId, planId: schema.subscriptions.planId, status: schema.subscriptions.status })
        .from(schema.subscriptions)
        .where(inArray(schema.subscriptions.userId, users.map((u) => u.id)))
    : [];
  const planOf = new Map(subs.filter((s) => ACTIVE_SUBSCRIPTION_STATUSES.has(s.status)).map((s) => [s.userId, getPlan(s.planId).name]));
  return (
    <section>
      <h1 className="text-2xl font-bold">Usuários</h1>
      <p className="mt-1 text-sm text-muted">Os 200 cadastros mais recentes. Administradores são definidos pela variável ADMIN_EMAILS.</p>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-surface text-left text-xs text-muted">
            <tr>
              <th className="px-3 py-2.5 font-medium">Nome</th>
              <th className="px-3 py-2.5 font-medium">E-mail</th>
              <th className="px-3 py-2.5 font-medium">Plano</th>
              <th className="px-3 py-2.5 font-medium">Função</th>
              <th className="px-3 py-2.5 font-medium">Cadastro</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-3 py-2.5">{u.name}</td>
                <td className="px-3 py-2.5 text-muted">{u.email}</td>
                <td className="px-3 py-2.5">{planOf.get(u.id) ?? "Gratuito"}</td>
                <td className="px-3 py-2.5">{u.role === "admin" ? <span className="chip chip-accent">Admin</span> : "Usuário"}</td>
                <td className="px-3 py-2.5 text-muted">{formatDate(u.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

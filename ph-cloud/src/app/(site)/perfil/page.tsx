import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { DeleteAccountForm, PasswordForm, ProfileForm } from "@/components/account/ProfileForms";
import { Icon } from "@/components/ui/Icon";
import { formatDate, formatDateTime } from "@/config/site";
import { revokeOtherSessionsAction } from "@/server/auth/account-actions";
import { getSession } from "@/server/auth/session";
import { getDb, schema } from "@/server/db";
import { getUserPlan } from "@/modules/subscriptions/entitlements";

export const metadata: Metadata = { title: "Meu perfil" };

/** Resumo legível do navegador/aparelho a partir do User-Agent. */
function describeAgent(ua: string | null): string {
  if (!ua) return "Aparelho desconhecido";
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad|iPod/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Outro sistema";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Navegador";
  return `${browser} · ${os}`;
}

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/entrar?next=/perfil");
  const { user, sessionId } = session;
  const db = await getDb();
  const [plan, sessions] = await Promise.all([
    getUserPlan(user),
    db.select().from(schema.sessions).where(eq(schema.sessions.userId, user.id)).orderBy(desc(schema.sessions.lastSeenAt)),
  ]);
  const activeSessions = sessions.filter((s) => s.expiresAt > new Date());

  return (
    <div className="shell max-w-4xl py-10">
      <h1 className="text-3xl font-bold">Meu perfil</h1>
      <p className="mt-1 text-sm text-muted">
        {user.email} · conta criada em {formatDate(user.createdAt)}
      </p>

      <Section title="Perfil">
        <ProfileForm name={user.name} avatar={user.avatar} />
      </Section>

      <Section title="Plano">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-lg font-semibold">
              {plan.plan.name}
              {plan.adminOverride && <span className="chip chip-warning ml-2 align-middle">Admin: todos os benefícios liberados</span>}
            </p>
            {plan.subscription ? (
              <p className="text-sm text-muted">
                Status: {plan.subscription.status === "active" ? "ativa" : plan.subscription.status}
                {plan.subscription.currentPeriodEnd &&
                  ` · ${plan.subscription.cancelAtPeriodEnd ? "termina em" : "renova em"} ${formatDate(plan.subscription.currentPeriodEnd)}`}
              </p>
            ) : (
              <p className="text-sm text-muted">Sem assinatura ativa.</p>
            )}
          </div>
          <Link href="/planos" className="btn btn-secondary">
            {plan.subscription ? "Gerenciar assinatura" : "Ver planos"}
          </Link>
        </div>
      </Section>

      <Section title="Sessões ativas" description="Aparelhos com acesso à sua conta.">
        <ul className="divide-y divide-line rounded-xl border border-line">
          {activeSessions.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-3">
                <Icon name={/Mobile|Android|iPhone/.test(s.userAgent ?? "") ? "phone" : "monitor"} className="text-muted" />
                <div>
                  <p className="text-sm font-medium">{describeAgent(s.userAgent)}</p>
                  <p className="text-xs text-faint">Último acesso: {formatDateTime(s.lastSeenAt)}</p>
                </div>
              </div>
              {s.id === sessionId && <span className="chip chip-accent">Este aparelho</span>}
            </li>
          ))}
        </ul>
        {activeSessions.length > 1 && (
          <form action={revokeOtherSessionsAction} className="mt-4">
            <button className="btn btn-secondary btn-sm">Encerrar as outras sessões</button>
          </form>
        )}
      </Section>

      <Section title="Senha">
        <PasswordForm />
      </Section>

      <Section title="Seus dados (LGPD)" description="Baixe uma cópia dos dados que guardamos sobre você ou exclua sua conta.">
        <div className="flex flex-col gap-6">
          <a href="/api/me/export" className="btn btn-secondary w-fit" download>
            Baixar meus dados (JSON)
          </a>
          <DeleteAccountForm hasSubscription={Boolean(plan.subscription)} />
        </div>
      </Section>
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="card mt-6 p-5 md:p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

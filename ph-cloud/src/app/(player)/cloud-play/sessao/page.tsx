import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CloudSession } from "@/components/player/CloudSession";
import { checkBackend } from "@/modules/cloud-streaming/backend";
import { cloudMinutesThisMonth, startPlaySession } from "@/modules/analytics/service";
import { getUserPlan } from "@/modules/subscriptions/entitlements";
import { getCurrentUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Estação Cloud Play", robots: { index: false } };

export default async function CloudSessionPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar?next=/cloud-play/sessao");
  const [plan, backend] = await Promise.all([getUserPlan(user), checkBackend()]);
  const limit = plan.entitlements.cloudPlayMinutesPerMonth;
  if (limit <= 0) redirect("/planos");
  if (backend.state !== "online") {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-xl font-semibold">Estação indisponível</h1>
        <p className="mt-2 text-sm text-muted">{backend.state === "offline" ? `A estação não respondeu (${backend.error}).` : "Nenhuma estação está configurada."}</p>
        <Link href="/cloud-play" className="btn btn-secondary mt-5">
          Voltar
        </Link>
      </div>
    );
  }
  const used = await cloudMinutesThisMonth(user.id);
  if (used >= limit) redirect("/planos?status=limite");
  const sessionId = await startPlaySession({ userId: user.id, gameId: "estacao", kind: "cloud" });
  return <CloudSession url={backend.url} name={backend.name} sessionId={sessionId} mic={backend.mic} minutesLeft={limit - used} />;
}

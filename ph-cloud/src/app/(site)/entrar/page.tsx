import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/AuthForms";
import { AuthCard } from "@/components/auth/AuthCard";
import { safeNext } from "@/server/auth/actions";
import { getCurrentUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = await safeNext((await searchParams).next);
  if (await getCurrentUser()) redirect(next);
  return (
    <AuthCard title="Entrar no PH Cloud" subtitle="Seus favoritos, histórico e plano em qualquer aparelho.">
      <LoginForm next={next} />
      <p className="mt-6 text-center text-sm text-muted">
        Ainda não tem conta?{" "}
        <Link href={`/cadastrar${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-accent hover:underline">
          Criar conta grátis
        </Link>
      </p>
    </AuthCard>
  );
}

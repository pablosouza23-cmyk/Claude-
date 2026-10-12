import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth/AuthForms";
import { AuthCard } from "@/components/auth/AuthCard";
import { safeNext } from "@/server/auth/actions";
import { getCurrentUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Criar conta" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = await safeNext((await searchParams).next);
  if (await getCurrentUser()) redirect(next);
  return (
    <AuthCard title="Criar conta grátis" subtitle="Leva menos de um minuto. Não pedimos cartão para o plano Gratuito.">
      <RegisterForm next={next} />
      <p className="mt-6 text-center text-sm text-muted">
        Já tem conta?{" "}
        <Link href={`/entrar${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-accent hover:underline">
          Entrar
        </Link>
      </p>
    </AuthCard>
  );
}

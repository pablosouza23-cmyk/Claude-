import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/brand/Logo";
import { getCurrentUser } from "@/server/auth/session";
import { listNotifications } from "@/modules/notifications/service";
import { getUserPlan } from "@/modules/subscriptions/entitlements";
import { MobileDrawer, NavLinks, NotificationsMenu, SearchBox, UserMenu } from "./HeaderClient";
import { AccountSync } from "./AccountSync";

export async function Header() {
  const user = await getCurrentUser();
  const [notes, plan] = await Promise.all([listNotifications(user?.id ?? null, 15), getUserPlan(user)]);

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-bg/80 backdrop-blur-xl">
      <AccountSync loggedIn={Boolean(user)} />
      <a href="#conteudo" className="sr-only-focusable absolute left-3 top-3 z-50 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-ink">
        Pular para o conteúdo
      </a>
      <div className="shell flex h-16 items-center gap-3 md:gap-6">
        <Link href="/" aria-label="PH Cloud — página inicial" className="shrink-0">
          <Logo />
        </Link>
        <NavLinks />
        <div className="ml-auto flex items-center gap-1 md:gap-2">
          <Suspense fallback={<div className="h-10 w-10 md:w-64" />}>
            <SearchBox />
          </Suspense>
          <NotificationsMenu items={notes} loggedIn={Boolean(user)} />
          {user ? (
            <UserMenu name={user.name} email={user.email} avatar={user.avatar} isAdmin={user.role === "admin"} planName={plan.plan.name} />
          ) : (
            <Link href="/entrar" className="btn btn-primary btn-sm ml-1">
              Entrar
            </Link>
          )}
          <MobileDrawer />
        </div>
      </div>
    </header>
  );
}

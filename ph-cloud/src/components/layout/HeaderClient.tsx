"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { MOBILE_NAV, NAV_LINKS, formatDateTime } from "@/config/site";
import { avatarUrl } from "@/config/avatars";
import { Icon, type IconName } from "@/components/ui/Icon";
import { useDismiss } from "@/lib/use-dismiss";

const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="Principal" className="hidden xl:block">
      <ul className="flex items-center gap-1">
        {NAV_LINKS.map((l) => {
          const active = isActive(pathname, l.href);
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`relative rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                  active ? "text-text" : "text-muted hover:text-text"
                }`}
              >
                {l.label}
                {active && <span className="absolute inset-x-3 -bottom-[13px] h-[2px] rounded-full bg-accent" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function SearchBox() {
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();
  const [q, setQ] = useState(pathname === "/jogos" ? (params.get("q") ?? "") : "");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Atalho "/" para buscar (sem atrapalhar campos de texto).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key !== "/" || t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      e.preventDefault();
      setOpen(true);
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    router.push(term ? `/jogos?q=${encodeURIComponent(term)}` : "/jogos");
    setOpen(false);
  };

  return (
    <form role="search" onSubmit={submit} className="relative">
      <label htmlFor="busca-global" className="sr-only">
        Buscar jogos
      </label>
      <div className={`${open ? "flex" : "hidden"} absolute right-0 top-1/2 w-[min(78vw,320px)] -translate-y-1/2 md:static md:flex md:w-64 md:translate-y-0`}>
        <Icon name="search" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
        <input
          ref={inputRef}
          id="busca-global"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Buscar jogos"
          autoComplete="off"
          enterKeyHint="search"
          className="input !min-h-10 !rounded-full !bg-surface !py-2 !pl-10 text-sm"
        />
      </div>
      <button type="button" className={`btn btn-ghost btn-icon md:hidden ${open ? "invisible" : ""}`} aria-label="Buscar jogos" onClick={() => setOpen(true)}>
        <Icon name="search" />
      </button>
    </form>
  );
}

export type HeaderNotification = { id: string; title: string; body: string; link: string | null; createdAt: string; read: boolean };

const LOCAL_READ_KEY = "phc:notificacoes-lidas";
const READ_EVENT = "phc:notificacoes-lidas";
const EMPTY: string[] = [];
let readCache: { raw: string | null; list: string[] } = { raw: null, list: EMPTY };

function readLocalIds(): string[] {
  try {
    const raw = localStorage.getItem(LOCAL_READ_KEY);
    if (raw !== readCache.raw) readCache = { raw, list: raw ? (JSON.parse(raw) as string[]) : EMPTY };
    return readCache.list;
  } catch {
    return EMPTY;
  }
}

function subscribeLocalIds(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(READ_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(READ_EVENT, cb);
  };
}

export function NotificationsMenu({ items, loggedIn }: { items: HeaderNotification[]; loggedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const localRead = useSyncExternalStore(subscribeLocalIds, readLocalIds, () => EMPTY);
  const [serverRead, setServerRead] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const refs = useMemo(() => [btn, panel], []);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, refs, btn);

  const isRead = (n: HeaderNotification) => (loggedIn ? n.read || serverRead : localRead.includes(n.id));
  const unread = items.filter((n) => !isRead(n)).length;

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (!next || unread === 0) return;
    if (loggedIn) {
      setServerRead(true);
      fetch("/api/notifications/read", { method: "POST" }).catch(() => {});
    } else {
      try {
        localStorage.setItem(LOCAL_READ_KEY, JSON.stringify(items.map((i) => i.id)));
        window.dispatchEvent(new Event(READ_EVENT));
      } catch {
        /* armazenamento indisponível */
      }
    }
  };

  return (
    <div className="relative">
      <button
        ref={btn}
        type="button"
        className="btn btn-ghost btn-icon relative"
        aria-label={unread ? `Notificações (${unread} não lidas)` : "Notificações"}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={toggle}
      >
        <Icon name="bell" />
        {unread > 0 && (
          <span className="absolute right-2 top-2 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-ink">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          ref={panel}
          role="dialog"
          aria-label="Notificações"
          className="glass animate-fade-up absolute right-0 top-12 z-50 w-[min(92vw,360px)] overflow-hidden rounded-2xl shadow-2xl"
        >
          <div className="border-b border-line px-4 py-3 text-sm font-semibold">Notificações</div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">Nenhuma notificação por enquanto.</p>
          ) : (
            <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
              {items.map((n) => (
                <li key={n.id} className="px-4 py-3">
                  <p className="text-sm font-semibold">{n.title}</p>
                  <p className="mt-0.5 text-sm text-muted">{n.body}</p>
                  <div className="mt-1 flex items-center justify-between gap-2 text-xs text-faint">
                    <time dateTime={n.createdAt}>{formatDateTime(n.createdAt)}</time>
                    {n.link && (
                      <Link href={n.link} className="font-semibold text-accent hover:underline" onClick={close}>
                        Ver
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function UserMenu({ name, email, avatar, isAdmin, planName }: { name: string; email: string; avatar: string; isAdmin: boolean; planName: string }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const refs = useMemo(() => [btn, panel], []);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, refs, btn);

  const links: { href: string; label: string; icon: IconName }[] = [
    { href: "/perfil", label: "Meu perfil", icon: "user" },
    { href: "/biblioteca", label: "Minha biblioteca", icon: "library" },
    { href: "/configuracoes", label: "Configurações", icon: "settings" },
    { href: "/controle", label: "Testar controle", icon: "gamepad" },
    ...(isAdmin ? [{ href: "/admin", label: "Administração", icon: "shield" as IconName }] : []),
  ];

  return (
    <div className="relative">
      <button
        ref={btn}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Menu da conta de ${name}`}
        className="flex items-center gap-2 rounded-full p-1 pr-1 transition-colors hover:bg-white/5 md:pr-3"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatarUrl(avatar)} alt="" width={34} height={34} className="h-[34px] w-[34px] rounded-full ring-1 ring-white/10" />
        <span className="hidden max-w-[9rem] truncate text-sm font-medium md:block">{name}</span>
      </button>
      {open && (
        <div ref={panel} role="menu" className="glass animate-fade-up absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-2xl shadow-2xl">
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="truncate text-xs text-muted">{email}</p>
            <p className="mt-1.5">
              <span className="chip chip-accent">Plano {planName}</span>
            </p>
          </div>
          <ul className="py-1">
            {links.map((l) => (
              <li key={l.href}>
                <Link role="menuitem" href={l.href} onClick={close} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-white/5">
                  <Icon name={l.icon} size={18} className="text-muted" />
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <form action="/api/auth/logout" method="post" className="border-t border-line py-1">
            <button role="menuitem" type="submit" className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-white/5">
              <Icon name="logout" size={18} className="text-muted" />
              Sair
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export function MobileDrawer() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const refs = useMemo(() => [btn, panel], []);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, refs, btn);

  return (
    <div className="xl:hidden">
      <button ref={btn} type="button" className="btn btn-ghost btn-icon" aria-label={open ? "Fechar menu" : "Abrir menu"} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Icon name={open ? "x" : "menu"} />
      </button>
      {open && (
        <div ref={panel} className="glass animate-fade-up fixed inset-x-3 top-[4.5rem] z-50 rounded-2xl p-2 shadow-2xl">
          <nav aria-label="Menu">
            <ul>
              {NAV_LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    onClick={close}
                    aria-current={isActive(pathname, l.href) ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 text-[0.95rem] ${isActive(pathname, l.href) ? "bg-white/8 text-text" : "text-muted"}`}
                  >
                    <Icon name={l.icon} size={20} className={isActive(pathname, l.href) ? "text-accent" : ""} />
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}
    </div>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Navegação inferior" className="glass fixed inset-x-0 bottom-0 z-40 border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="grid grid-cols-5">
        {MOBILE_NAV.map((l) => {
          const active = isActive(pathname, l.href);
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[58px] flex-col items-center justify-center gap-1 text-[11px] font-medium ${active ? "text-accent" : "text-muted"}`}
              >
                <Icon name={l.icon} size={22} />
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

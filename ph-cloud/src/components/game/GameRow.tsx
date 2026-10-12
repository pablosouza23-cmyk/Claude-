"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

/* Fileira horizontal com rolagem por toque, roda do mouse, teclado e botões de seta. */
export function GameRow({ id, title, href, children, count }: { id: string; title: string; href?: string; children: ReactNode; count: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);

  const page = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.85, behavior: "smooth" });

  return (
    <section aria-labelledby={`row-${id}`} className="mt-10 first:mt-0">
      <div className="mb-3 flex items-end justify-between gap-4">
        <h2 id={`row-${id}`} className="text-lg font-semibold md:text-xl">
          {title}
          <span className="ml-2 align-middle text-sm font-normal text-faint">{count}</span>
        </h2>
        <div className="flex items-center gap-1">
          {href && (
            <Link href={href} className="mr-1 text-sm font-medium text-muted hover:text-accent">
              Ver tudo
            </Link>
          )}
          <button type="button" className="btn btn-ghost btn-icon btn-sm hidden md:inline-flex" aria-label={`Rolar ${title} para a esquerda`} disabled={edges.start} onClick={() => page(-1)}>
            <Icon name="chevronLeft" size={18} />
          </button>
          <button type="button" className="btn btn-ghost btn-icon btn-sm hidden md:inline-flex" aria-label={`Rolar ${title} para a direita`} disabled={edges.end} onClick={() => page(1)}>
            <Icon name="chevronRight" size={18} />
          </button>
        </div>
      </div>
      <div ref={ref} className="scroller -mx-1 px-1 py-1" role="list">
        {children}
      </div>
    </section>
  );
}

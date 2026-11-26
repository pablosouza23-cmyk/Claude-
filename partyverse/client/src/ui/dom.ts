/** Helpers mínimos de DOM. Todo texto vindo de jogadores passa por esc(). */
export function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

export function on(root: HTMLElement, sel: string, ev: string, fn: (e: Event, t: HTMLElement) => void): void {
  root.addEventListener(ev, (e) => {
    const t = (e.target as HTMLElement).closest(sel) as HTMLElement | null;
    if (t && root.contains(t)) fn(e, t);
  });
}

export function initials(name: string): string {
  return esc(name.slice(0, 1).toUpperCase());
}

export function colorFor(s: string): string {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 70% 55%)`;
}

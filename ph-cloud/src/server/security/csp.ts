/* Montagem da Content-Security-Policy. Função pura para poder ser testada. */

export type CspOptions = {
  nonce: string;
  dev: boolean;
  frameOrigins: string[];
  imageOrigins: string[];
  connectOrigins: string[];
};

export function buildAppCsp(o: CspOptions): string {
  const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))];
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", `'nonce-${o.nonce}'`, "'strict-dynamic'", ...(o.dev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    // Capas cadastradas pelo administrador podem vir de qualquer endereço https.
    "img-src": uniq(["'self'", "data:", "blob:", "https:", ...o.imageOrigins]),
    "font-src": ["'self'"],
    "connect-src": uniq(["'self'", ...o.connectOrigins, ...(o.dev ? ["ws:"] : [])]),
    "frame-src": uniq(["'self'", ...o.frameOrigins]),
    "media-src": ["'self'", "blob:"],
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    // Redirecionamentos de formulários (Server Actions) para o checkout e o portal do Stripe.
    "form-action": ["'self'", "https://checkout.stripe.com", "https://billing.stripe.com"],
    "frame-ancestors": ["'self'"],
  };
  const parts = Object.entries(directives).map(([k, v]) => `${k} ${v.join(" ")}`);
  if (!o.dev) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}

/** CSP dos documentos de jogo servidos em /g/ (jogos próprios, em iframe com sandbox). */
export function buildGameCsp(selfOrigin: string, parentOrigins: string[]): string {
  return [
    `default-src ${selfOrigin}`,
    `script-src ${selfOrigin}`,
    `style-src ${selfOrigin} 'unsafe-inline'`,
    `img-src ${selfOrigin} data: blob:`,
    `media-src ${selfOrigin} data: blob:`,
    `font-src ${selfOrigin}`,
    "connect-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    `frame-ancestors ${[...new Set(parentOrigins)].join(" ")}`,
  ].join("; ");
}

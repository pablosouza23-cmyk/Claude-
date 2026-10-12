import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  // Recursos que o PH Cloud não usa ficam desligados. Microfone, tela cheia e controle seguem o padrão
  // ("self") e só são delegados a iframes específicos pelo atributo allow.
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), payment=(), usb=(), serial=(), browsing-topics=()" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  agentRules: false,
  reactStrictMode: true,
  serverExternalPackages: ["@electric-sql/pglite"],
  // Migrações e jogos são lidos do disco em tempo de execução: inclui no pacote de deploy.
  outputFileTracingIncludes: { "/**": ["./drizzle/**/*", "./games/**/*"] },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

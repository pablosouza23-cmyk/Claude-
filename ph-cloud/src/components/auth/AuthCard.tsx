import { LogoMark } from "@/components/brand/Logo";

export function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="relative isolate overflow-hidden">
      <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-accent/10 blur-[120px]" />
      <div className="shell flex justify-center py-12 md:py-20">
        <div className="card w-full max-w-md p-6 shadow-2xl md:p-8">
          <LogoMark size={40} />
          <h1 className="mt-5 text-2xl font-bold">{title}</h1>
          <p className="mt-1.5 text-sm text-muted">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

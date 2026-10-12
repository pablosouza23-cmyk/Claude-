/* Marca original do PH Cloud: nuvem em traço contínuo com o triângulo de "jogar" ao centro. */

export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="phc-mark" x1="4" y1="6" x2="36" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7dffb3" />
          <stop offset="1" stopColor="#14b85a" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="38" height="38" rx="11" fill="#0d1513" stroke="rgba(62,232,135,.28)" />
      <path
        d="M12.4 29h15.4a6.8 6.8 0 0 0 1-13.5A8.6 8.6 0 0 0 12.3 14a7.6 7.6 0 0 0 .1 15z"
        fill="none"
        stroke="url(#phc-mark)"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <path d="M18 17.6v7.6l6.2-3.8z" fill="url(#phc-mark)" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <LogoMark size={34} />
      <span className="font-display text-[1.15rem] font-bold leading-none tracking-tight">
        PH <span className="text-accent">Cloud</span>
      </span>
    </span>
  );
}

/* Avatares originais disponíveis no perfil (arquivos em public/avatars). */

export const AVATARS = [
  { id: "pulse", label: "Pulso" },
  { id: "orbit", label: "Órbita" },
  { id: "bolt", label: "Raio" },
  { id: "wave", label: "Onda" },
  { id: "prism", label: "Prisma" },
  { id: "nova", label: "Nova" },
  { id: "grid", label: "Grade" },
  { id: "comet", label: "Cometa" },
] as const;

export type AvatarId = (typeof AVATARS)[number]["id"];

export const isAvatarId = (v: string): v is AvatarId => AVATARS.some((a) => a.id === v);

export const avatarUrl = (id: string) => `/avatars/${isAvatarId(id) ? id : "pulse"}.svg`;

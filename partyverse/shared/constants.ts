export const PROTOCOL_VERSION = 1;
/** Frequência de simulação do servidor (Hz). */
export const SERVER_TICK = 30;
/** Frequência de envio de snapshots (Hz). */
export const SNAPSHOT_RATE = 20;
/** Frequência com que o cliente envia sua posição (Hz). */
export const CLIENT_SEND_RATE = 20;
/** Atraso de interpolação dos jogadores remotos (ms). */
export const INTERP_DELAY = 110;
/** Tempo que um jogador desconectado mantém a vaga na sala/partida (ms). */
export const RECONNECT_GRACE_MS = 90_000;
export const MAX_ROOM_PLAYERS = 10;
export const MAX_LOBBY_SHARD = 40;
export const NAME_MIN = 3;
export const NAME_MAX = 16;

export type AnimName =
  | 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'sit' | 'drive' | 'carry' | 'carry-walk'
  | 'interact' | 'pick-up' | 'emote-yes' | 'emote-no' | 'wave' | 'die' | 'crouch' | 'tool';

export const EMOTES = ['wave', 'emote-yes', 'emote-no', 'dance'] as const;
export type EmoteId = (typeof EMOTES)[number];

export function sanitizeName(n: unknown): string | null {
  if (typeof n !== 'string') return null;
  const t = n.normalize('NFKC').replace(/[^\p{L}\p{N} _.-]/gu, '').trim();
  if (t.length < NAME_MIN || t.length > NAME_MAX) return null;
  return t;
}

export function sanitizeChat(s: unknown): string | null {
  if (typeof s !== 'string') return null;
  const t = s.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 120);
  return t.length ? t : null;
}

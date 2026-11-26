import type { GameId } from '../../../shared/minigames';

/** Ícones vetoriais (viewBox 24x24) — usados na UI (SVG) e nas placas 3D (Path2D). */
const GAME_ICONS: Record<GameId, string> = {
  mudanca: 'M2 6h12v10H2z M14 9h4.5L22 12.5V16h-8z M6 19.5a2 2 0 1 1 0.01 0z M17 19.5a2 2 0 1 1 0.01 0z M4 8h8v2H4z',
  roubo: 'M12 2 3 9l9 13 9-13z M7.5 9 12 4.5 16.5 9 12 18z',
  loja: 'M2 3h3l2.2 11h11l2.3-8H7 M9 20a1.6 1.6 0 1 1 0.01 0z M17 20a1.6 1.6 0 1 1 0.01 0z M6.5 5.5h14l-2.3 8H8.2z',
  hotel: 'M12 2c-4.4 0-8 3.6-8 8v12l2.7-2 2.6 2 2.7-2 2.7 2 2.6-2 2.7 2V10c0-4.4-3.6-8-8-8z M9 9.5a1.6 1.6 0 1 0 0.01 0z M15 9.5a1.6 1.6 0 1 0 0.01 0z',
  oficina: 'M21.7 6.3 18 10l-4-4 3.7-3.7A6 6 0 0 0 10 9.6L2.6 17a2.1 2.1 0 0 0 3 3L13 12.6A6 6 0 0 0 21.7 6.3z',
  nave: 'M12 1c3.5 2.5 5.5 6.5 5.5 11.5L20 16v4l-4-1.5h-8L4 20v-4l2.5-3.5C6.5 7.5 8.5 3.5 12 1z M12 8.5a2 2 0 1 0 0.01 0z M10 19.5h4l-2 3.5z',
};

export function gameIconPath(id: GameId): string {
  return GAME_ICONS[id];
}

export function gameIconSvg(id: GameId, color = '#fff'): string {
  return `<svg viewBox="0 0 24 24" fill="${color}" fill-rule="evenodd"><path d="${GAME_ICONS[id]}"/></svg>`;
}

const UI: Record<string, string> = {
  play: 'M7 4v16l13-8z',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 9c0-3.9 3.1-7 7-7s7 3.1 7 7v1H2zm15.5-9a3.5 3.5 0 1 0-1.2-6.8 6 6 0 0 1 0 6.6c.4.1.8.2 1.2.2zm1.3 2.1c1.9 1.2 3.2 3.4 3.2 5.9v1h-4v-1c0-2.3-.9-4.4-2.4-6 1.1-.1 2.2 0 3.2.1z',
  shop: 'M4 7h16l-1.2 13H5.2zM8 7a4 4 0 0 1 8 0h-2a2 2 0 0 0-4 0z',
  shirt: 'M8 3 3 6l2 4 2-1v12h10V9l2 1 2-4-5-3c-.5 1.7-2 3-4 3S8.5 4.7 8 3z',
  gear: 'M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7 7 0 0 0-1.7-1L15 3h-4l-.3 2.7a7 7 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7 7 0 0 0 1.7 1L11 21h4l.3-2.7a7 7 0 0 0 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z',
  trophy: 'M7 3h10v3h4c0 4-2 6-5 6.5A5 5 0 0 1 13 15v3h4v3H7v-3h4v-3a5 5 0 0 1-3-2.5C5 12 3 10 3 6h4zm-2 5c.3 1.5 1 2.5 2.2 3L7 8zm14 0h-2l-.2 3c1.2-.5 1.9-1.5 2.2-3z',
  chat: 'M4 4h16v12H8l-4 4z',
  jump: 'M12 3l7 8h-4v9H9v-9H5z',
  hand: 'M9 11V4.5a1.5 1.5 0 0 1 3 0V10V3.5a1.5 1.5 0 0 1 3 0V10V5a1.5 1.5 0 0 1 3 0v9c0 4-3 7-7 7-3 0-4.5-1.5-6-4l-2.5-4.5a1.5 1.5 0 0 1 2.6-1.5L7 13V7.5a1.5 1.5 0 0 1 3 0V11z',
  run: 'M13.5 5.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM9.8 8.9 7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3A7.3 7.3 0 0 0 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6z',
  wave: 'M7 12c0-3 1-6 1-6l2 .5-.5 5.5h1V4h2v8h1V5h2v7h1V7h2v8c0 3.3-2.7 6-6 6s-6-2.7-6-6z',
  close: 'M6 6l12 12M18 6 6 18',
  copy: 'M8 8h12v12H8zM4 4h12v2H6v10H4z',
  crown: 'M3 7l4.5 4L12 4l4.5 7L21 7l-2 12H5z',
};

export function icon(name: keyof typeof UI | string, color = 'currentColor'): string {
  const d = UI[name] ?? '';
  const stroke = name === 'close';
  return stroke
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round"><path d="${d}"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="${color}"><path d="${d}"/></svg>`;
}

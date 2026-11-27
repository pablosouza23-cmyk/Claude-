/** Dock de voz: ligar/desligar, silenciar o próprio microfone e quem está falando. */
import type { VoiceChat } from '../voice/Voice';
import { el, esc } from './dom';

const MIC = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11z"/></svg>';
const MIC_OFF = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 11h-2c0 .7-.2 1.4-.4 2l1.5 1.5c.6-1 .9-2.2.9-3.5zm-4 .2V5a3 3 0 0 0-5.9-.8L15 10.1v1.1zM4.3 3 3 4.3l6 6V11a3 3 0 0 0 4.4 2.7l1.6 1.6A5 5 0 0 1 7 11H5a7 7 0 0 0 6 6.9V21h2v-3.1c1-.1 1.9-.5 2.7-1l4 4 1.3-1.3z"/></svg>';

export class VoiceDock {
  readonly root: HTMLElement;
  private last = '';
  constructor(private voice: VoiceChat, private onOpen: () => void) {
    this.root = el('div', 'voice-dock');
    this.root.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('[data-v]') as HTMLElement | null;
      if (!b) return;
      if (b.dataset.v === 'main') {
        if (voice.state === 'off' || voice.state === 'denied' || voice.state === 'unsupported') this.onOpen();
        else if (voice.state === 'on') voice.setMicMuted(!voice.micMuted);
        else this.onOpen();
      }
      if (b.dataset.v === 'panel') this.onOpen();
    });
  }

  render(speakers: { name: string; self?: boolean }[]): void {
    const v = this.voice;
    const on = v.state === 'on';
    const listen = v.state === 'listen-only';
    const cls = on ? (v.micMuted ? 'muted' : v.selfSpeaking ? 'live talking' : 'live') : listen ? 'listen' : '';
    const title = on ? (v.micMuted ? 'Microfone silenciado (clique para falar)' : 'Microfone ligado (clique para silenciar)') : listen ? 'Só ouvindo — clique para opções' : 'Ativar chat de voz';
    const html = `<button class="vbtn ${cls}" data-v="main" title="${title}" aria-label="${title}">${on && !v.micMuted ? MIC : MIC_OFF}</button>
      ${on || listen ? `<button class="vbtn small" data-v="panel" title="Jogadores e volume">⋯</button>` : ''}
      <div class="speakers">${speakers.slice(0, 5).map((s) => `<span class="${s.self ? 'me' : ''}">🔊 ${esc(s.name)}</span>`).join('')}</div>`;
    if (html !== this.last) { this.root.innerHTML = html; this.last = html; }
  }
}

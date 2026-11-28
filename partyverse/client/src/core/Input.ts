import { settings } from './Settings';

type Btn = 'jump' | 'sprint' | 'interact' | 'action' | 'emote' | 'action2';

/**
 * Entrada unificada: teclado + mouse (PC) e joystick/botões virtuais (touch).
 * O jogo lê apenas este estado — não importa a origem.
 */
export class Input {
  enabled = true;
  /** movimento: x = direita, y = frente (-1..1) */
  readonly move = { x: 0, y: 0 };
  /** deltas de câmera acumulados desde o último consumo */
  look = { x: 0, y: 0 };
  zoom = 0;
  private keys = new Set<string>();
  private held = new Set<Btn>();
  private pressed = new Set<Btn>();
  private virt = { x: 0, y: 0, active: false };
  sprintToggle = false;
  private dragId: number | null = null;
  private dragLast = { x: 0, y: 0 };
  onKey: ((code: string) => void) | null = null;

  constructor(el: HTMLElement) {
    addEventListener('keydown', (e) => {
      if (isTyping(e.target)) return;
      if (e.code === 'Tab') e.preventDefault();
      this.onKey?.(e.code);
      if (!this.enabled) return;
      if (e.repeat) return;
      this.keys.add(e.code);
      const k = settings.data.keys;
      if (e.code === k.jump) this.down('jump');
      if (e.code === k.interact) this.down('interact');
      if (e.code === k.action) this.down('action');
      if (e.code === k.emote) this.down('emote');
      if (e.code === 'KeyR') this.down('action2');
      if (e.code === k.sprint || e.code === 'ShiftRight') this.held.add('sprint');
    });
    addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      const k = settings.data.keys;
      if (e.code === k.jump) this.up('jump');
      if (e.code === k.interact) this.up('interact');
      if (e.code === k.action) this.up('action');
      if (e.code === 'KeyR') this.up('action2');
      if (e.code === k.sprint || e.code === 'ShiftRight') this.held.delete('sprint');
    });
    addEventListener('blur', () => { this.keys.clear(); this.held.clear(); });

    el.addEventListener('contextmenu', (e) => e.preventDefault());
    // ---- toque: eventos de toque nativos (funcionam em Android e iPhone) ----
    let tid: number | null = null;
    let tlast = { x: 0, y: 0 };
    let pinchD = 0;
    const two = (t: TouchList) => (t.length >= 2 ? Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY) : 0);
    el.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (e.touches.length >= 2) { pinchD = two(e.touches); tid = null; return; }
      const t = e.changedTouches[0];
      tid = t.identifier;
      tlast = { x: t.clientX, y: t.clientY };
    }, { passive: false });
    el.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (e.touches.length >= 2 && pinchD) {
        const d = two(e.touches);
        this.zoom += (pinchD - d) * 0.02;
        pinchD = d;
        return;
      }
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier !== tid) continue;
        const sens = settings.data.sensitivity * 1.3;
        this.look.x += (t.clientX - tlast.x) * 0.0055 * sens;
        this.look.y += (t.clientY - tlast.y) * 0.0045 * sens * (settings.data.invertY ? -1 : 1);
        tlast = { x: t.clientX, y: t.clientY };
      }
    }, { passive: false });
    const tend = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) if (t.identifier === tid) tid = null;
      if (e.touches.length < 2) pinchD = 0;
      if (e.touches.length === 1 && tid === null) { tid = e.touches[0].identifier; tlast = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }
    };
    el.addEventListener('touchend', tend);
    el.addEventListener('touchcancel', tend);

    // ---- mouse / caneta ----
    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') return; // tratado pelos eventos de toque
      if (this.dragId !== null) return;
      this.dragId = e.pointerId;
      this.dragLast = { x: e.clientX, y: e.clientY };
      el.setPointerCapture?.(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch' || e.pointerId !== this.dragId) return;
      const s = settings.data.sensitivity;
      this.look.x += (e.clientX - this.dragLast.x) * 0.0055 * s;
      this.look.y += (e.clientY - this.dragLast.y) * 0.0045 * s * (settings.data.invertY ? -1 : 1);
      this.dragLast = { x: e.clientX, y: e.clientY };
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId === this.dragId) this.dragId = null;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('wheel', (e) => { this.zoom += Math.sign(e.deltaY) * 0.8; }, { passive: true });
  }

  /* botões virtuais (touch) */
  down(b: Btn): void { if (!this.held.has(b)) this.pressed.add(b); this.held.add(b); }
  up(b: Btn): void { this.held.delete(b); }
  setStick(x: number, y: number, active: boolean): void { this.virt = { x, y, active }; }

  /** consome um clique de botão (borda de subida) */
  take(b: Btn): boolean {
    const had = this.pressed.has(b);
    this.pressed.delete(b);
    return had && this.enabled;
  }
  isHeld(b: Btn): boolean { return this.enabled && this.held.has(b); }

  get sprint(): boolean { return this.enabled && (this.held.has('sprint') || this.sprintToggle); }

  update(): void {
    const k = settings.data.keys;
    let x = 0, y = 0;
    if (this.enabled) {
      if (this.keys.has(k.forward) || this.keys.has('ArrowUp')) y += 1;
      if (this.keys.has(k.back) || this.keys.has('ArrowDown')) y -= 1;
      if (this.keys.has(k.left) || this.keys.has('ArrowLeft')) x -= 1;
      if (this.keys.has(k.right) || this.keys.has('ArrowRight')) x += 1;
      if (this.virt.active) { x = this.virt.x; y = this.virt.y; }
    }
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    this.move.x = x;
    this.move.y = y;
    // Z/C giram a câmera (alternativa a arrastar o mouse)
    if (this.enabled) {
      if (this.keys.has('KeyZ')) this.look.x -= 0.045 * settings.data.sensitivity;
      if (this.keys.has('KeyC')) this.look.x += 0.045 * settings.data.sensitivity;
    }
    if (!this.enabled) { this.pressed.clear(); this.look.x = this.look.y = 0; }
  }

  consumeLook(): { x: number; y: number; zoom: number } {
    const r = { x: this.look.x, y: this.look.y, zoom: this.zoom };
    this.look.x = this.look.y = 0;
    this.zoom = 0;
    return r;
  }
}

export function isTyping(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}

import * as THREE from 'three';
import { settings, type Quality } from './Settings';

export interface QualityPreset {
  pixelRatio: number;
  shadows: boolean;
  shadowMapSize: number;
  antialias: boolean;
  drawDistance: number;
  particles: number;
  envMap: boolean;
  lodBias: number;
}

export const PRESETS: Record<Quality, QualityPreset> = {
  low: { pixelRatio: 1, shadows: false, shadowMapSize: 512, antialias: false, drawDistance: 140, particles: 0.35, envMap: false, lodBias: 0.6 },
  medium: { pixelRatio: 1.5, shadows: true, shadowMapSize: 1024, antialias: true, drawDistance: 260, particles: 0.7, envMap: true, lodBias: 1 },
  high: { pixelRatio: 2, shadows: true, shadowMapSize: 2048, antialias: true, drawDistance: 600, particles: 1, envMap: true, lodBias: 1.6 },
};

/**
 * Renderer com presets de qualidade e resolução dinâmica: se o FPS cair
 * abaixo de ~50 por alguns segundos, a escala de renderização é reduzida
 * gradualmente (e volta a subir quando há folga).
 */
export class Renderer {
  readonly gl: THREE.WebGLRenderer;
  preset: QualityPreset;
  dynScale = 1;
  private frameTimes: number[] = [];
  private lastAdjust = 0;
  fps = 60;

  constructor(host: HTMLElement) {
    this.preset = PRESETS[settings.data.quality];
    this.gl = new THREE.WebGLRenderer({ antialias: this.preset.antialias, powerPreference: 'high-performance', stencil: false });
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1.05;
    this.gl.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(this.gl.domElement);
    this.applyQuality();
    addEventListener('resize', () => this.resize());
    settings.on(() => this.applyQuality());
  }

  applyQuality(): void {
    this.preset = PRESETS[settings.data.quality];
    this.gl.shadowMap.enabled = this.preset.shadows;
    this.resize();
  }

  get pixelRatio(): number {
    const auto = settings.data.autoResolution ? this.dynScale : 1;
    return Math.max(0.5, Math.min(window.devicePixelRatio || 1, this.preset.pixelRatio) * settings.data.renderScale * auto);
  }

  resize(): void {
    this.gl.setPixelRatio(this.pixelRatio);
    this.gl.setSize(innerWidth, innerHeight, false);
  }

  /** chamado a cada quadro com o dt real */
  track(dt: number): void {
    this.frameTimes.push(dt);
    if (this.frameTimes.length > 60) this.frameTimes.shift();
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.fps = 1 / Math.max(1e-3, avg);
    const now = performance.now();
    if (!settings.data.autoResolution || now - this.lastAdjust < 2500 || this.frameTimes.length < 60) return;
    if (this.fps < 48 && this.dynScale > 0.55) {
      this.dynScale = Math.max(0.55, this.dynScale - 0.1);
      this.lastAdjust = now;
      this.resize();
    } else if (this.fps > 58 && this.dynScale < 1) {
      this.dynScale = Math.min(1, this.dynScale + 0.05);
      this.lastAdjust = now;
      this.resize();
    }
  }
}

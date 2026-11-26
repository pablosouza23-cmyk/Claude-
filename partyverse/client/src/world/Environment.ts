import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Renderer } from '../core/Renderer';
import { loadGLB } from '../core/Assets';

export interface SkyPreset {
  top: string; horizon: string; bottom: string;
  sun: string; sunIntensity: number; hemi: number; hemiSky: string; hemiGround: string;
  sunDir: [number, number, number];
  fog: [number, number];
  exposure: number;
}

export const SKIES: Record<string, SkyPreset> = {
  day: { top: '#3d8bff', horizon: '#bfe6ff', bottom: '#f7d9ff', sun: '#fff1d6', sunIntensity: 2.8, hemi: 1.25, hemiSky: '#dbeeff', hemiGround: '#8d7a6a', sunDir: [0.55, 0.8, 0.35], fog: [120, 520], exposure: 1.05 },
  golden: { top: '#4f63d8', horizon: '#ffb98a', bottom: '#ff8fb8', sun: '#ffd1a1', sunIntensity: 2.6, hemi: 1.1, hemiSky: '#ffd9c2', hemiGround: '#6b5a7a', sunDir: [-0.6, 0.45, 0.4], fog: [180, 900], exposure: 1.0 },
  dusk: { top: '#1d1b4f', horizon: '#ff8a6b', bottom: '#5a2d6e', sun: '#ffb08a', sunIntensity: 1.6, hemi: 0.9, hemiSky: '#9b8cff', hemiGround: '#3a2b40', sunDir: [0.3, 0.25, -0.6], fog: [70, 320], exposure: 1.05 },
  night: { top: '#05061a', horizon: '#1d2450', bottom: '#0b0b22', sun: '#9fb4ff', sunIntensity: 0.55, hemi: 0.5, hemiSky: '#5c6cff', hemiGround: '#1a1426', sunDir: [0.2, 0.7, 0.3], fog: [25, 120], exposure: 1.15 },
  space: { top: '#02020a', horizon: '#0b0f2e', bottom: '#000000', sun: '#ffffff', sunIntensity: 2.2, hemi: 0.45, hemiSky: '#8fa6ff', hemiGround: '#140f24', sunDir: [0.7, 0.4, 0.2], fog: [400, 3000], exposure: 1.0 },
};

/**
 * Céu em gradiente, sol com sombras que acompanham o jogador, névoa,
 * reflexos ambientes (PMREM) e nuvens.
 */
export class Environment {
  readonly group = new THREE.Group();
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  private skyMat: THREE.ShaderMaterial;
  private sky: THREE.Mesh;
  private clouds: THREE.Group = new THREE.Group();
  private envTex: THREE.Texture | null = null;
  private preset!: SkyPreset;
  private stars: THREE.Points | null = null;

  constructor(private scene: THREE.Scene, private renderer: Renderer) {
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, bottom: { value: new THREE.Color() },
        sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunColor: { value: new THREE.Color() },
      },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`,
      fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunColor; varying vec3 vDir;
        void main(){ float h = vDir.y; vec3 c = h > 0.0 ? mix(horizon, top, pow(smoothstep(0.0, 0.75, h), 0.8)) : mix(horizon, bottom, smoothstep(0.0, -0.4, h));
          float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0); c += sunColor * (pow(s, 600.0) * 2.0 + pow(s, 12.0) * 0.18);
          gl_FragColor = vec4(c, 1.0); }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), this.skyMat);
    this.sky.scale.setScalar(4000);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    this.group.add(this.sky);

    this.hemi = new THREE.HemisphereLight();
    this.group.add(this.hemi);
    this.sun = new THREE.DirectionalLight();
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    const sc = this.sun.shadow.camera;
    sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 1; sc.far = 200;
    this.group.add(this.sun, this.sun.target);
    this.group.add(this.clouds);
    scene.add(this.group);
    this.setSky('day');
  }

  setSky(name: keyof typeof SKIES): void {
    const p = SKIES[name];
    this.preset = p;
    this.skyMat.uniforms.top.value.set(p.top);
    this.skyMat.uniforms.horizon.value.set(p.horizon);
    this.skyMat.uniforms.bottom.value.set(p.bottom);
    this.skyMat.uniforms.sunColor.value.set(p.sun);
    this.skyMat.uniforms.sunDir.value.set(...p.sunDir).normalize();
    this.hemi.color.set(p.hemiSky);
    this.hemi.groundColor.set(p.hemiGround);
    this.hemi.intensity = p.hemi;
    this.sun.color.set(p.sun);
    this.sun.intensity = p.sunIntensity;
    this.scene.fog = new THREE.Fog(p.horizon, p.fog[0], p.fog[1]);
    this.renderer.gl.toneMappingExposure = p.exposure;
    if (name === 'night' || name === 'space') this.addStars(); else if (this.stars) { this.stars.removeFromParent(); this.stars = null; }
    this.applyQuality();
  }

  applyQuality(): void {
    const q = this.renderer.preset;
    this.sun.castShadow = q.shadows;
    if (this.sun.shadow.mapSize.x !== q.shadowMapSize) {
      this.sun.shadow.mapSize.set(q.shadowMapSize, q.shadowMapSize);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null as never;
    }
    if (q.envMap && !this.envTex) {
      const pm = new THREE.PMREMGenerator(this.renderer.gl);
      this.envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
      pm.dispose();
    }
    this.scene.environment = q.envMap ? this.envTex : null;
    this.scene.environmentIntensity = 0.35;
    const fog = this.scene.fog as THREE.Fog;
    if (fog) fog.far = Math.min(this.preset.fog[1], q.drawDistance * 1.6);
  }

  private addStars(): void {
    if (this.stars) return;
    const n = 1500;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3().randomDirection();
      v.y = Math.abs(v.y) * 0.9 + 0.05;
      v.normalize().multiplyScalar(3000);
      pos.set([v.x, v.y, v.z], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 }));
    this.stars.frustumCulled = false;
    this.group.add(this.stars);
  }

  /** nuvens Kenney espalhadas em anel (instanciadas por nuvem) */
  async addClouds(count: number, radius: [number, number], height: [number, number], scale: [number, number], seed = 1): Promise<void> {
    const g = await loadGLB('kenney/platformer/cloud.glb');
    let s = seed;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const base = g.scene.children[0] as THREE.Mesh;
    const geo = (base.isMesh ? base : (g.scene.getObjectByProperty('isMesh', true) as THREE.Mesh)).geometry;
    const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#c9d8ff', emissiveIntensity: 0.25 });
    const inst = new THREE.InstancedMesh(geo, m, count);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const a = rnd() * Math.PI * 2;
      const r = radius[0] + rnd() * (radius[1] - radius[0]);
      dummy.position.set(Math.cos(a) * r, height[0] + rnd() * (height[1] - height[0]), Math.sin(a) * r);
      const sc = scale[0] + rnd() * (scale[1] - scale[0]);
      dummy.scale.set(sc * (1 + rnd()), sc * 0.7, sc);
      dummy.rotation.y = rnd() * Math.PI;
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.castShadow = false;
    inst.receiveShadow = false;
    this.clouds.add(inst);
  }

  clearClouds(): void {
    for (const c of [...this.clouds.children]) this.clouds.remove(c);
  }

  /** mantém a sombra centrada no foco (jogador) */
  update(dt: number, focus: THREE.Vector3): void {
    const d = this.preset.sunDir;
    const snap = 2;
    const fx = Math.round(focus.x / snap) * snap, fy = Math.round(focus.y / snap) * snap, fz = Math.round(focus.z / snap) * snap;
    this.sun.position.set(fx + d[0] * 80, fy + d[1] * 80, fz + d[2] * 80);
    this.sun.target.position.set(fx, fy, fz);
    this.sky.position.copy(focus);
    this.clouds.rotation.y += dt * 0.004;
  }

  dispose(): void {
    this.group.removeFromParent();
  }
}

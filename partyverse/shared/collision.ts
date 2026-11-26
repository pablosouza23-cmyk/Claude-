/**
 * Colisão e controlador de personagem compartilhados entre cliente e servidor.
 * O mesmo código roda nos dois lados: o cliente prediz o movimento e o servidor
 * valida usando exatamente as mesmas regras (sem divergência de física).
 */

export interface BoxCollider {
  kind: 'box';
  /** centro */
  x: number; y: number; z: number;
  /** meia-extensão */
  hx: number; hy: number; hz: number;
  /** rotação em Y (rad) */
  rot?: number;
  /** id opcional (portas dinâmicas etc.) */
  id?: string;
  /** colisor desabilitado (ex.: porta aberta) */
  disabled?: boolean;
  /** só bloqueia, não serve de chão (ex.: paredes de vidro finas) */
  noFloor?: boolean;
}

export interface CylCollider {
  kind: 'cyl';
  x: number; z: number; r: number;
  y0: number; y1: number;
  id?: string;
  disabled?: boolean;
}

export type Collider = BoxCollider | CylCollider;

export interface CharacterState {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  grounded: boolean;
}

export interface MoveInput {
  /** direção desejada no plano (já em espaço do mundo), magnitude 0..1 */
  mx: number; mz: number;
  sprint: boolean;
  jump: boolean;
  /** multiplicador de velocidade (carregando objeto pesado etc.) */
  speedMul?: number;
}

export const CHAR = {
  radius: 0.38,
  height: 1.75,
  walkSpeed: 4.4,
  sprintSpeed: 7.2,
  accel: 38,
  airAccel: 12,
  jumpVel: 7.4,
  gravity: 24,
  stepHeight: 0.45,
  maxFall: 40,
};

/** Grade espacial simples para acelerar consultas de colisão. */
export class CollisionWorld {
  readonly colliders: Collider[] = [];
  private grid = new Map<string, Collider[]>();
  private cell = 4;
  /** chão infinito opcional */
  groundY: number | null = 0;

  constructor(colliders: Collider[] = [], groundY: number | null = 0) {
    this.groundY = groundY;
    for (const c of colliders) this.add(c);
  }

  add(c: Collider): void {
    this.colliders.push(c);
    const [minX, minZ, maxX, maxZ] = bounds2D(c);
    for (let gx = Math.floor(minX / this.cell); gx <= Math.floor(maxX / this.cell); gx++)
      for (let gz = Math.floor(minZ / this.cell); gz <= Math.floor(maxZ / this.cell); gz++) {
        const k = gx + ',' + gz;
        let arr = this.grid.get(k);
        if (!arr) this.grid.set(k, (arr = []));
        arr.push(c);
      }
  }

  byId(id: string): Collider | undefined {
    return this.colliders.find((c) => c.id === id);
  }

  query(x: number, z: number, r: number, out: Set<Collider>): Set<Collider> {
    out.clear();
    for (let gx = Math.floor((x - r) / this.cell); gx <= Math.floor((x + r) / this.cell); gx++)
      for (let gz = Math.floor((z - r) / this.cell); gz <= Math.floor((z + r) / this.cell); gz++) {
        const arr = this.grid.get(gx + ',' + gz);
        if (arr) for (const c of arr) if (!c.disabled) out.add(c);
      }
    return out;
  }
}

function bounds2D(c: Collider): [number, number, number, number] {
  if (c.kind === 'cyl') return [c.x - c.r, c.z - c.r, c.x + c.r, c.z + c.r];
  const rot = c.rot ?? 0;
  const cs = Math.abs(Math.cos(rot)), sn = Math.abs(Math.sin(rot));
  const ex = c.hx * cs + c.hz * sn;
  const ez = c.hx * sn + c.hz * cs;
  return [c.x - ex, c.z - ez, c.x + ex, c.z + ez];
}

export function colliderTop(c: Collider): number {
  return c.kind === 'box' ? c.y + c.hy : c.y1;
}
export function colliderBottom(c: Collider): number {
  return c.kind === 'box' ? c.y - c.hy : c.y0;
}

/**
 * Empurra um círculo (x,z,r) para fora do colisor no plano XZ.
 * Retorna o vetor de correção ou null se não houver sobreposição.
 */
export function pushOut2D(x: number, z: number, r: number, c: Collider): [number, number] | null {
  if (c.kind === 'cyl') {
    const dx = x - c.x, dz = z - c.z;
    const d2 = dx * dx + dz * dz;
    const rr = r + c.r;
    if (d2 >= rr * rr) return null;
    const d = Math.sqrt(d2) || 1e-6;
    const p = rr - d;
    return [(dx / d) * p, (dz / d) * p];
  }
  const rot = c.rot ?? 0;
  const cs = Math.cos(rot), sn = Math.sin(rot);
  // para o espaço local da caixa
  const dx = x - c.x, dz = z - c.z;
  const lx = dx * cs - dz * sn;
  const lz = dx * sn + dz * cs;
  const qx = Math.max(-c.hx, Math.min(c.hx, lx));
  const qz = Math.max(-c.hz, Math.min(c.hz, lz));
  let ox = lx - qx, oz = lz - qz;
  const d2 = ox * ox + oz * oz;
  let px: number, pz: number;
  if (d2 > 1e-10) {
    if (d2 >= r * r) return null;
    const d = Math.sqrt(d2);
    const p = r - d;
    px = (ox / d) * p;
    pz = (oz / d) * p;
  } else {
    // centro dentro da caixa: sai pelo lado mais próximo
    const ex = c.hx - Math.abs(lx), ez = c.hz - Math.abs(lz);
    if (ex < ez) { px = Math.sign(lx || 1) * (ex + r); pz = 0; }
    else { px = 0; pz = Math.sign(lz || 1) * (ez + r); }
  }
  // de volta ao mundo (rotação inversa)
  return [px * cs + pz * sn, -px * sn + pz * cs];
}

/** O círculo está sobre a área (em XZ) do colisor? */
export function overlaps2D(x: number, z: number, r: number, c: Collider): boolean {
  if (c.kind === 'cyl') {
    const dx = x - c.x, dz = z - c.z;
    return dx * dx + dz * dz < (r + c.r) * (r + c.r);
  }
  const rot = c.rot ?? 0;
  const cs = Math.cos(rot), sn = Math.sin(rot);
  const dx = x - c.x, dz = z - c.z;
  const lx = dx * cs - dz * sn;
  const lz = dx * sn + dz * cs;
  const qx = Math.max(-c.hx, Math.min(c.hx, lx));
  const qz = Math.max(-c.hz, Math.min(c.hz, lz));
  const ox = lx - qx, oz = lz - qz;
  return ox * ox + oz * oz < r * r;
}

const tmpSet = new Set<Collider>();

/** Altura do chão sob a posição (considerando degraus até stepHeight acima dos pés). */
export function groundHeight(world: CollisionWorld, x: number, y: number, z: number, r: number, step: number): number {
  let g = world.groundY ?? -Infinity;
  world.query(x, z, r, tmpSet);
  for (const c of tmpSet) {
    if (c.kind === 'box' && c.noFloor) continue;
    const top = colliderTop(c);
    if (top <= y + step && top > g && overlaps2D(x, z, r * 0.7, c)) g = top;
  }
  return g;
}

/**
 * Avança o personagem um passo de simulação. Determinístico e sem alocação.
 */
export function stepCharacter(s: CharacterState, input: MoveInput, dt: number, world: CollisionWorld): void {
  const mul = input.speedMul ?? 1;
  const maxSpeed = (input.sprint ? CHAR.sprintSpeed : CHAR.walkSpeed) * mul;
  let mx = input.mx, mz = input.mz;
  const ml = Math.hypot(mx, mz);
  if (ml > 1) { mx /= ml; mz /= ml; }
  const tx = mx * maxSpeed, tz = mz * maxSpeed;
  const acc = (s.grounded ? CHAR.accel : CHAR.airAccel) * dt;
  const dvx = tx - s.vx, dvz = tz - s.vz;
  const dl = Math.hypot(dvx, dvz);
  if (dl <= acc) { s.vx = tx; s.vz = tz; }
  else { s.vx += (dvx / dl) * acc; s.vz += (dvz / dl) * acc; }

  if (input.jump && s.grounded) {
    s.vy = CHAR.jumpVel;
    s.grounded = false;
  }

  // horizontal
  s.x += s.vx * dt;
  s.z += s.vz * dt;
  const r = CHAR.radius;
  for (let pass = 0; pass < 3; pass++) {
    world.query(s.x, s.z, r + 0.1, tmpSet);
    let moved = false;
    for (const c of tmpSet) {
      const top = colliderTop(c), bot = colliderBottom(c);
      // obstáculos baixos são degraus (tratados pelo chão); acima da cabeça ignora
      if (top <= s.y + CHAR.stepHeight || bot >= s.y + CHAR.height) continue;
      const p = pushOut2D(s.x, s.z, r, c);
      if (p) {
        s.x += p[0]; s.z += p[1];
        // remove a componente de velocidade contra a parede
        const pl = Math.hypot(p[0], p[1]);
        if (pl > 1e-6) {
          const nx = p[0] / pl, nz = p[1] / pl;
          const vn = s.vx * nx + s.vz * nz;
          if (vn < 0) { s.vx -= vn * nx; s.vz -= vn * nz; }
        }
        moved = true;
      }
    }
    if (!moved) break;
  }

  // vertical
  s.vy = Math.max(-CHAR.maxFall, s.vy - CHAR.gravity * dt);
  const prevY = s.y;
  s.y += s.vy * dt;
  // teto
  if (s.vy > 0) {
    world.query(s.x, s.z, r, tmpSet);
    for (const c of tmpSet) {
      const bot = colliderBottom(c);
      if (bot >= prevY + CHAR.height - 0.01 && bot < s.y + CHAR.height && overlaps2D(s.x, s.z, r * 0.7, c)) {
        s.y = bot - CHAR.height;
        s.vy = 0;
      }
    }
  }
  const step = s.grounded ? CHAR.stepHeight : Math.max(0.05, prevY - s.y + 0.05);
  const g = groundHeight(world, s.x, Math.max(prevY, s.y), s.z, r, step);
  if (s.y <= g + (s.grounded && s.vy <= 0 ? 0.2 : 0)) {
    if (s.vy <= 0) {
      s.y = g;
      s.vy = 0;
      s.grounded = true;
    }
  } else {
    s.grounded = false;
  }
}

/** Resolve uma posição (sem movimento) para fora de paredes — usado pelo servidor na validação. */
export function resolvePosition(world: CollisionWorld, x: number, y: number, z: number): [number, number] {
  const r = CHAR.radius;
  for (let pass = 0; pass < 3; pass++) {
    world.query(x, z, r, tmpSet);
    let moved = false;
    for (const c of tmpSet) {
      const top = colliderTop(c), bot = colliderBottom(c);
      if (top <= y + CHAR.stepHeight || bot >= y + CHAR.height) continue;
      const p = pushOut2D(x, z, r * 0.9, c);
      if (p) { x += p[0]; z += p[1]; moved = true; }
    }
    if (!moved) break;
  }
  return [x, z];
}

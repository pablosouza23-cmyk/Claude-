import { CollisionWorld } from '../../../shared/collision';
import { buildLobbyLayout } from '../../../shared/maps/lobby';
import type { Session } from '../Session';
import { World, type WPlayer } from './World';

const layout = buildLobbyLayout();

export class LobbyWorld extends World {
  constructor() {
    super('lobby', new CollisionWorld(layout.colliders, 0));
  }

  spawnPoint(_s: Session) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * layout.spawn.r;
    return { x: layout.spawn.x + Math.cos(a) * r, y: 0, z: layout.spawn.z + Math.sin(a) * r, yaw: layout.spawn.yaw };
  }

  onInteract(p: WPlayer, id: string): void {
    const z = layout.zones.find((zz) => zz.id === id);
    if (!z) return;
    if (Math.hypot(p.x - z.x, p.z - z.z) > z.r + 1.5) return;
    if (z.kind === 'seat') {
      p.anim = 'sit';
    }
  }
}

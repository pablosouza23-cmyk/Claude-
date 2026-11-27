import * as THREE from 'three';
import { CollisionWorld } from '../../../shared/collision';
import { GAMES } from '../../../shared/minigames';
import { audio } from '../core/Audio';
import { LobbyScene } from '../world/lobby/LobbyScene';
import type { LocalPlayer } from './LocalPlayer';
import type { Interactable } from './types';
import { View } from './View';

export class LobbyView extends View {
  private scene = new LobbyScene();
  private col!: CollisionWorld;

  async load(progress: (p: number, msg: string) => void): Promise<void> {
    progress(0.2, 'Montando a Praça PARTYVERSE…');
    this.app.env.setSky('day');
    this.app.env.clearClouds();
    await this.app.env.addClouds(60, [70, 320], [-60, 30], [8, 22], 3);
    progress(0.5, 'Plantando árvores…');
    await this.scene.build(this.app.renderer.preset.particles);
    this.root.add(this.scene.group);
    this.col = new CollisionWorld(this.scene.layout.colliders, 0);
    progress(0.9, 'Quase lá…');
    audio.setMood('lobby');
  }

  dispose(): void {
    audio.stopLoop('ambience');
    audio.stopLoop('fountain');
    super.dispose();
  }

  colFor(): CollisionWorld { return this.col; }
  cameraWorlds() { return [{ col: this.col }]; }

  interactables(lp: LocalPlayer): Interactable[] {
    const out: Interactable[] = [];
    for (const z of this.scene.layout.zones) {
      const pos = new THREE.Vector3(z.x, z.y, z.z);
      let label = z.label;
      let use: () => void;
      switch (z.kind) {
        case 'seat':
          if (lp.benchSeat) continue;
          use = () => { lp.benchSeat = { x: z.x, z: z.z, yaw: z.yaw ?? 0 }; };
          break;
        case 'shop': use = () => this.app.ui.open('shop'); break;
        case 'wardrobe': use = () => this.app.ui.open('wardrobe'); break;
        case 'friends': use = () => this.app.ui.open('friends'); break;
        case 'rooms': use = () => this.app.ui.open('play'); break;
        case 'game':
          label = `${GAMES[z.game!].name}`;
          use = () => this.app.ui.open('play', { game: z.game });
          break;
        default: continue;
      }
      out.push({ id: z.id, pos, r: z.r, label, use });
    }
    return out;
  }

  update(dt: number): void {
    this.scene.update(dt);
    // água da fonte: mais alta perto dela
    const lp = this.app.local;
    if (lp) {
      const p = lp.worldPos(new THREE.Vector3());
      const d = Math.hypot(p.x, p.z);
      audio.loop('fountain', 'noise:water', Math.max(0, 0.14 * (1 - d / 16)));
      // ambiente da praça (CC0) — chamado por quadro: começa assim que o áudio é liberado e o arquivo carrega
      audio.loop('ambience', 'ambience', 0.25);
    }
  }

  onDepartures(rows: Parameters<LobbyScene['updateDepartures']>[0]): void {
    this.scene.updateDepartures(rows);
  }
}

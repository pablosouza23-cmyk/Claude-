/**
 * Cena 3D da Praça PARTYVERSE, construída a partir de shared/maps/lobby.ts.
 */
import * as THREE from 'three';
import { buildLobbyLayout, type LobbyLayout } from '../../../../shared/maps/lobby';
import { GAMES, type GameId } from '../../../../shared/minigames';
import { canvasTexture, mat, mesh, model, rbox } from '../../core/Assets';
import { Batcher, addBush, addFlowerbed, addTree, balloonCluster, bench, islandTopTexture, lamp, place, signPlane, signTexture } from '../props';
import { buildTrain, type TrainParts } from '../TrainModel';
import { gameIconPath } from '../../ui/icons';

export class LobbyScene {
  readonly group = new THREE.Group();
  readonly layout: LobbyLayout = buildLobbyLayout();
  private water: THREE.Mesh | null = null;
  private jets: THREE.Points | null = null;
  private balloons: THREE.Object3D[] = [];
  private holos: THREE.Object3D[] = [];
  private train: TrainParts | null = null;
  private departures: THREE.CanvasTexture | null = null;
  private t = 0;

  async build(particles: number): Promise<void> {
    const L = this.layout;
    const R = L.islandRadius;
    const batch = new Batcher();

    // ---------------- ilha ----------------
    const topTex = islandTopTexture(2048, R + 2, (c, px) => {
      const s = (v: number) => (v / (2 * (R + 2))) * 2048;
      // praça central em anéis
      for (let r = 18; r > 0; r -= 2) {
        c.fillStyle = (r / 2) % 2 ? '#e9dcc4' : '#dccbb0';
        c.beginPath(); c.arc(px(0), px(0), s(r), 0, Math.PI * 2); c.fill();
      }
      c.strokeStyle = 'rgba(160,130,100,0.35)';
      c.lineWidth = 2;
      for (let a = 0; a < 48; a++) {
        const ang = (a / 48) * Math.PI * 2;
        c.beginPath(); c.moveTo(px(Math.cos(ang) * 4), px(Math.sin(ang) * 4)); c.lineTo(px(Math.cos(ang) * 18), px(Math.sin(ang) * 18)); c.stroke();
      }
      // caminhos
      const path = (x0: number, z0: number, x1: number, z1: number, w: number) => {
        c.strokeStyle = '#e2d2b6'; c.lineWidth = s(w); c.lineCap = 'round';
        c.beginPath(); c.moveTo(px(x0), px(z0)); c.lineTo(px(x1), px(z1)); c.stroke();
        c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = s(0.25);
        c.setLineDash([s(1), s(1)]); c.beginPath(); c.moveTo(px(x0), px(z0)); c.lineTo(px(x1), px(z1)); c.stroke(); c.setLineDash([]);
      };
      path(0, 0, 0, -27, 6); // estação
      path(0, 0, -24, 0, 5); // loja
      path(0, 0, 24, 0, 5); // galeria
      path(0, 0, 0, 40, 6); // portal
      // área da galeria
      c.fillStyle = '#d7c5ea';
      c.beginPath(); c.arc(px(0), px(0), s(31), -0.75, 0.75); c.arc(px(0), px(0), s(22), 0.75, -0.75, true); c.fill();
      // piso da loja
      c.fillStyle = '#f1e6ff';
      c.fillRect(px(-36), px(-6), s(12), s(12));
    });
    const top = new THREE.Mesh(new THREE.CircleGeometry(R + 2, 96), new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.95 }));
    top.rotation.x = -Math.PI / 2;
    top.receiveShadow = true;
    this.group.add(top);
    // borda e rocha da ilha flutuante
    const rim = mesh(new THREE.CylinderGeometry(R + 2, R + 1.2, 1.2, 96, 1, true), mat('#6fae4c', 0.9), false);
    rim.position.y = -0.6;
    this.group.add(rim);
    this.group.add(floatingRock(R + 1.2, 26, 3));

    // ---------------- objetos ----------------
    for (const p of L.props) {
      switch (p.type) {
        case 'tree': addTree(batch, p.x, p.z, p.scale ?? 1, p.rot ?? 0, false); break;
        case 'treeTall': addTree(batch, p.x, p.z, p.scale ?? 1, p.rot ?? 0, true); break;
        case 'bush': addBush(batch, p.x, p.z, p.scale ?? 1, p.rot ?? 0); break;
        case 'flowerbed': addFlowerbed(batch, p.x, p.z, (p.rot ?? 0) + Math.PI / 2); break;
        case 'fence':
          batch.add('fpost', rbox(0.22, 1.3, 0.22, 0.05), mat('#ffffff', 0.6), { x: p.x, y: 0.65, z: p.z }, p.rot ?? 0);
          batch.add('frail', rbox(4.9, 0.12, 0.1, 0.04), mat('#ffc93c', 0.5, 0.2), { x: p.x, y: 1.15, z: p.z }, p.rot ?? 0);
          batch.add('frail2', rbox(4.9, 0.1, 0.08, 0.03), mat('#ffffff', 0.6), { x: p.x, y: 0.6, z: p.z }, p.rot ?? 0);
          break;
        case 'bench': this.group.add(place(bench(), p.x, 0, p.z, 0, p.rot ?? 0)); break;
        case 'lamp': this.group.add(place(lamp(), p.x, 0, p.z)); break;
        case 'fountain': this.buildFountain(particles); break;
        case 'building': {
          const b = await model(`kenney/city/${p.model}.glb`, p.scale ?? 9);
          b.position.set(p.x, 0, p.z);
          b.rotation.y = p.rot ?? 0;
          this.group.add(b);
          break;
        }
        case 'station': this.buildStation(); break;
        case 'trainDocked': {
          this.train = buildTrain({ interior: true, particles });
          this.train.root.position.set(p.x, p.y ?? 0.4, p.z);
          this.train.root.rotation.y = p.rot ?? 0;
          this.train.setDoors(0);
          this.group.add(this.train.root);
          break;
        }
        case 'shop': this.buildShop(p.x, p.z); break;
        case 'counter': this.group.add(place(this.counter(), p.x, 0, p.z, 0, p.rot ?? 0)); break;
        case 'mirror': this.group.add(place(this.mirror(), p.x, 0, p.z, 0, p.rot ?? 0)); break;
        case 'mannequin': this.group.add(place(this.mannequin(), p.x, 0, p.z, 0, p.rot ?? 0)); break;
        case 'kiosk': this.group.add(place(this.kiosk(p.game!), p.x, 0, p.z, 0, p.rot ?? 0)); break;
        case 'arch': this.group.add(place(this.arch(), p.x, 0, p.z)); break;
        case 'board': this.group.add(place(this.board(p.color === 'friends'), p.x, p.y ?? 0, p.z, 0, p.rot ?? 0)); break;
        case 'stage': this.group.add(place(this.stage(), p.x, 0, p.z, 0, p.rot ?? 0)); break;
        case 'balloon': {
          const b = balloonCluster(p.color ?? '#ff4fa3');
          b.position.set(p.x, p.y ?? 8, p.z);
          b.userData.base = p.y ?? 8;
          this.balloons.push(b);
          this.group.add(b);
          break;
        }
      }
    }
    batch.build(this.group);
    // ilhas distantes decorativas
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      const r = 150 + (i % 3) * 60;
      const isl = new THREE.Group();
      const s = 8 + (i % 3) * 5;
      const grass = mesh(new THREE.CylinderGeometry(s, s * 0.9, 1.2, 24), mat('#79c257', 0.9), false);
      isl.add(grass);
      const rock = floatingRock(s * 0.9, s * 1.4, 1);
      rock.position.y = -0.6;
      isl.add(rock);
      const b2 = new Batcher();
      for (let k = 0; k < 5; k++) addTree(b2, Math.cos(k * 1.3) * s * 0.5, Math.sin(k * 1.7) * s * 0.5, 1.3, k, k % 2 === 0, 0.6);
      b2.build(isl);
      isl.position.set(Math.cos(a) * r, -10 + (i % 4) * 9, Math.sin(a) * r);
      isl.userData.bob = i;
      this.holos.push(isl);
      this.group.add(isl);
    }
  }

  /* ------------------------------ peças ------------------------------ */

  private buildFountain(particles: number): void {
    const g = new THREE.Group();
    const stone = mat('#e8e2d6', 0.8);
    const stoneDark = mat('#cfc5b4', 0.85);
    const basin = mesh(new THREE.CylinderGeometry(3.6, 3.8, 0.9, 48), stone);
    basin.position.y = 0.45;
    g.add(basin);
    const rim = mesh(new THREE.TorusGeometry(3.55, 0.18, 10, 64), stoneDark);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.92;
    g.add(rim);
    const waterM = new THREE.MeshPhysicalMaterial({ color: '#3fc7ff', roughness: 0.05, metalness: 0.1, transmission: 0, transparent: true, opacity: 0.85, clearcoat: 1, emissive: '#0a5d8a', emissiveIntensity: 0.25 });
    this.water = new THREE.Mesh(new THREE.CircleGeometry(3.35, 48), waterM);
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = 0.8;
    g.add(this.water);
    g.add(place(mesh(new THREE.CylinderGeometry(0.7, 0.9, 2.2, 24), stone), 0, 1.6, 0));
    g.add(place(mesh(new THREE.CylinderGeometry(1.8, 1.4, 0.35, 32), stoneDark), 0, 2.6, 0));
    const w2 = new THREE.Mesh(new THREE.CircleGeometry(1.6, 32), waterM);
    w2.rotation.x = -Math.PI / 2;
    w2.position.y = 2.78;
    g.add(w2);
    // estrela de bronze no topo
    const star = mesh(new THREE.OctahedronGeometry(0.55, 0), mat('#ffc93c', 0.2, 0.9));
    star.position.y = 3.6;
    star.userData.spin = true;
    this.holos.push(star);
    g.add(star);
    // jatos d'água (partículas)
    const n = Math.floor(220 * particles);
    if (n > 0) {
      const pos = new Float32Array(n * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const pm = new THREE.PointsMaterial({ color: '#bfefff', size: 0.16, transparent: true, opacity: 0.8, depthWrite: false });
      this.jets = new THREE.Points(geo, pm);
      this.jets.userData.n = n;
      this.jets.userData.phase = Float32Array.from({ length: n }, () => Math.random());
      g.add(this.jets);
    }
    this.group.add(g);
  }

  private buildStation(): void {
    const g = new THREE.Group();
    g.position.set(0, 0, -31.5);
    const slab = mesh(rbox(40, 0.4, 11, 0.12), mat('#d8d2e8', 0.8));
    slab.position.y = 0.2;
    g.add(slab);
    // faixa tátil amarela
    g.add(place(mesh(new THREE.BoxGeometry(40, 0.02, 0.5), mat('#ffc93c', 0.6)), 0, 0.41, -5.0));
    // cobertura
    const roofM = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.75, clearcoat: 1 });
    const roof = mesh(new THREE.CylinderGeometry(9, 9, 40, 32, 1, true, -0.55, 1.1), roofM);
    roof.rotation.z = Math.PI / 2;
    roof.rotation.y = 0;
    roof.position.set(0, -1.2, -2);
    roof.scale.set(1, 1, 0.75);
    roof.castShadow = false;
    g.add(roof);
    for (const px of [-16, -8, 8, 16]) {
      g.add(place(mesh(new THREE.CylinderGeometry(0.3, 0.35, 6.4, 14), mat('#7c5cff', 0.35, 0.3)), px, 3.6, -2));
      g.add(place(mesh(rbox(0.9, 0.3, 0.9, 0.08), mat('#ffc93c', 0.3, 0.7)), px, 0.55, -2));
    }
    // placa
    const sign = signPlane(signTexture('ESTAÇÃO PARTYVERSE', { sub: 'Trem Voador • Todas as experiências' }), 12, 3);
    sign.position.set(0, 6.6, 1.2);
    g.add(sign);
    // trilho magnético
    const rail = mesh(rbox(70, 0.5, 2.4, 0.15), mat('#3b4252', 0.4, 0.6));
    rail.position.set(0, -0.6, -9);
    g.add(rail);
    for (let i = -6; i <= 6; i++) g.add(place(mesh(rbox(0.5, 0.2, 2.8, 0.05), mat('#39d0ff', 0.3, 0, '#39d0ff', 1.6), false), i * 5.5, -0.3, -9));
    // painel de partidas (atualizado com as salas em viagem)
    this.departures = canvasTexture(1024, 512, (c) => this.drawDepartures(c, []));
    this.group.add(g);
  }

  private drawDepartures(c: CanvasRenderingContext2D, rows: { code: string; game: GameId; players: number }[]): void {
    c.fillStyle = '#101433';
    c.fillRect(0, 0, 1024, 512);
    c.fillStyle = '#ffc93c';
    c.font = '64px Lilita, system-ui';
    c.fillText('PARTIDAS', 40, 84);
    c.font = '700 34px monospace';
    c.fillStyle = '#7f8bd6';
    c.fillText('SALA   DESTINO              JOG', 40, 150);
    const list = rows.length ? rows : [];
    list.slice(0, 6).forEach((r, i) => {
      c.fillStyle = i % 2 ? '#e7ecff' : '#ffffff';
      c.fillText(`${r.code}  ${GAMES[r.game].destination.toUpperCase().padEnd(20).slice(0, 20)} ${String(r.players).padStart(2)}`, 40, 210 + i * 52);
    });
    if (!list.length) { c.fillStyle = '#7f8bd6'; c.fillText('Nenhuma viagem no momento', 40, 220); }
  }

  updateDepartures(rows: { code: string; game: GameId; players: number }[]): void {
    if (!this.departures) return;
    const ctx = (this.departures.image as HTMLCanvasElement).getContext('2d')!;
    this.drawDepartures(ctx, rows);
    this.departures.needsUpdate = true;
  }

  private board(friends: boolean): THREE.Group {
    const g = new THREE.Group();
    g.add(place(mesh(rbox(3.4, 2.6, 0.3, 0.1), mat('#2b2440', 0.5)), 0, 1.9, 0));
    for (const x of [-1.4, 1.4]) g.add(place(mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.2, 8), mat('#2b2440', 0.5)), x, 0.6, 0));
    const tex = friends
      ? signTexture('MURAL DE AMIGOS', { w: 1024, h: 768, bg: '#ff4fa3', sub: 'Adicione amigos e convide para jogar!' })
      : (this.departures ?? signTexture('PARTIDAS'));
    const screen = signPlane(tex, 3.1, friends ? 2.3 : 1.55, 0.6);
    screen.position.set(0, 1.95, 0.16);
    g.add(screen);
    return g;
  }

  private buildShop(x: number, z: number): void {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const wall = mat('#fff7fb', 0.8);
    const trim = mat('#ff4fa3', 0.45);
    const glass = new THREE.MeshPhysicalMaterial({ color: '#cfe9ff', transparent: true, opacity: 0.25, roughness: 0.05, depthWrite: false });
    // piso
    g.add(place(mesh(new THREE.BoxGeometry(12, 0.06, 12), mat('#f6eefc', 0.6)), 0, 0.03, 0));
    // paredes (combina com os colisores do layout)
    g.add(place(mesh(rbox(12.5, 5, 0.5, 0.1), wall), 0, 2.5, -6));
    g.add(place(mesh(rbox(0.5, 5, 12.5, 0.1), wall), -6, 2.5, 0));
    // parede sul com vitrine
    g.add(place(mesh(rbox(12.5, 1.2, 0.5, 0.1), wall), 0, 0.6, 6));
    g.add(place(mesh(rbox(12.5, 1.0, 0.5, 0.1), wall), 0, 4.5, 6));
    g.add(place(new THREE.Mesh(new THREE.PlaneGeometry(11.5, 2.8), glass), 0, 2.6, 6.1));
    // frente (leste) com porta
    for (const s of [-1, 1]) g.add(place(mesh(rbox(0.5, 5, 4.3, 0.1), wall), 6, 2.5, s * 3.85));
    g.add(place(mesh(rbox(0.5, 0.8, 3.4, 0.1), wall), 6, 4.6, 0));
    // telhado + toldo listrado
    g.add(place(mesh(rbox(13.2, 0.5, 13.2, 0.15), trim), 0, 5.2, 0));
    const awningTex = canvasTexture(256, 64, (c) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#ffffff' : '#ff4fa3'; c.fillRect(i * 32, 0, 32, 64); } });
    const awning = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.2), new THREE.MeshStandardMaterial({ map: awningTex, side: THREE.DoubleSide, roughness: 0.8 }));
    awning.position.set(7.0, 4.1, 0);
    awning.rotation.set(0, Math.PI / 2, 0);
    awning.rotateX(-0.6);
    awning.castShadow = true;
    g.add(awning);
    const sign = signPlane(signTexture('BOUTIQUE', { sub: 'Roupas • Acessórios • Estilo', bg: '#2b2440' }), 6, 1.5);
    sign.position.set(6.3, 5.9, 0);
    sign.rotation.y = Math.PI / 2;
    g.add(sign);
    // araras de roupa
    for (const rz of [-4.8, 4.8]) {
      g.add(place(mesh(new THREE.CylinderGeometry(0.04, 0.04, 4, 8), mat('#c0c4cc', 0.3, 0.8)), 1.5, 1.9, rz, 0, 0, Math.PI / 2));
      for (let i = 0; i < 7; i++) g.add(place(mesh(rbox(0.12, 0.9, 0.6, 0.05), mat(['#ff4fa3', '#7c5cff', '#39d0ff', '#ffc93c', '#2fc97a', '#ff8a3d', '#ffffff'][i], 0.8)), -0.2 + i * 0.55, 1.4, rz));
    }
    this.group.add(g);
  }

  private counter(): THREE.Group {
    const g = new THREE.Group();
    g.add(place(mesh(rbox(3.6, 1.1, 1.0, 0.1), mat('#7c5cff', 0.4)), 0, 0.55, 0));
    g.add(place(mesh(rbox(3.8, 0.1, 1.2, 0.04), mat('#ffffff', 0.3)), 0, 1.15, 0));
    g.add(place(mesh(rbox(0.6, 0.4, 0.06, 0.02), mat('#101433', 0.3, 0, '#39d0ff', 0.6)), 0.8, 1.45, 0, -0.2));
    return g;
  }

  private mirror(): THREE.Group {
    const g = new THREE.Group();
    g.add(place(mesh(rbox(0.25, 2.8, 2.0, 0.1), mat('#ffc93c', 0.3, 0.8)), 0, 1.4, 0));
    const glass = mesh(new THREE.PlaneGeometry(1.7, 2.4), new THREE.MeshStandardMaterial({ color: '#dff3ff', roughness: 0.02, metalness: 1 }), false);
    glass.position.set(0.14, 1.4, 0);
    glass.rotation.y = Math.PI / 2;
    g.add(glass);
    return g;
  }

  private mannequin(): THREE.Group {
    const g = new THREE.Group();
    const white = mat('#f4f4f4', 0.4);
    g.add(place(mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.15, 20), mat('#2b2440', 0.4)), 0, 0.08, 0));
    g.add(place(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 8), mat('#c0c4cc', 0.3, 0.8)), 0, 0.55, 0));
    g.add(place(mesh(rbox(0.65, 0.7, 0.4, 0.15), mat(['#ff4fa3', '#39d0ff', '#ffc93c'][Math.floor(Math.random() * 3)], 0.8)), 0, 1.3, 0));
    g.add(place(mesh(rbox(0.5, 0.45, 0.45, 0.15), white), 0, 1.95, 0));
    return g;
  }

  private kiosk(id: GameId): THREE.Group {
    const def = GAMES[id];
    const g = new THREE.Group();
    g.add(place(mesh(rbox(2.8, 0.5, 1.8, 0.15), mat('#2b2440', 0.5)), 0, 0.25, 0));
    g.add(place(mesh(rbox(2.4, 2.4, 0.4, 0.15), mat(def.color, 0.4)), 0, 1.7, -0.4));
    const tex = canvasTexture(512, 512, (c) => {
      const gr = c.createLinearGradient(0, 0, 0, 512);
      gr.addColorStop(0, def.color); gr.addColorStop(1, def.accent);
      c.fillStyle = gr;
      c.beginPath(); c.roundRect(0, 0, 512, 512, 60); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.95)';
      const p = new Path2D(gameIconPath(id));
      c.save(); c.translate(156, 70); c.scale(8, 8); c.fill(p); c.restore();
      c.textAlign = 'center';
      c.font = '62px Lilita, system-ui';
      c.fillStyle = '#ffffff';
      c.shadowColor = 'rgba(0,0,0,0.3)'; c.shadowOffsetY = 4;
      c.fillText(def.name.toUpperCase(), 256, 372, 480);
      c.font = '700 30px system-ui';
      c.fillText(`${def.min}–${def.max} jogadores`, 256, 430);
      if (!def.playable) { c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(0, 456, 512, 56); c.fillStyle = '#fff'; c.font = '700 26px system-ui'; c.fillText('EM CONSTRUÇÃO', 256, 494); }
    });
    const screen = signPlane(tex, 2.1, 2.1, 0.5);
    screen.position.set(0, 1.75, -0.18);
    g.add(screen);
    // holograma flutuante
    const holo = mesh(new THREE.OctahedronGeometry(0.35, 0), mat(def.accent, 0.2, 0.3, def.accent, 1.2), false);
    holo.position.set(0, 3.45, -0.4);
    holo.userData.spin = true;
    this.holos.push(holo);
    g.add(holo);
    const ring = mesh(new THREE.TorusGeometry(0.9, 0.04, 8, 40), mat(def.accent, 0.3, 0, def.accent, 1.5), false);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 0.52, 0.3);
    g.add(ring);
    return g;
  }

  private arch(): THREE.Group {
    const g = new THREE.Group();
    for (const s of [-1, 1]) {
      g.add(place(mesh(rbox(1.2, 6.5, 1.2, 0.25), mat(s < 0 ? '#7c5cff' : '#ff4fa3', 0.4)), s * 5.2, 3.25, 0));
      g.add(place(mesh(new THREE.SphereGeometry(0.7, 20, 14), mat('#ffc93c', 0.2, 0.8)), s * 5.2, 7.0, 0));
    }
    const sign = signPlane(signTexture('PARTYVERSE', { w: 1024, h: 220 }), 10, 2.15, 0.45);
    sign.position.set(0, 5.6, 0.62);
    g.add(sign);
    const back = sign.clone();
    back.rotation.y = Math.PI;
    back.position.z = -0.62;
    g.add(back);
    g.add(place(mesh(rbox(10.6, 2.3, 1.0, 0.2), mat('#2b2440', 0.5)), 0, 5.6, 0));
    return g;
  }

  private stage(): THREE.Group {
    const g = new THREE.Group();
    g.add(place(mesh(rbox(9, 0.6, 6, 0.15), mat('#2b2440', 0.5)), 0, 0.3, 0));
    g.add(place(mesh(rbox(9.2, 0.08, 6.2, 0.03), mat('#ffc93c', 0.3, 0.6)), 0, 0.62, 0));
    for (const s of [-1, 1]) {
      g.add(place(mesh(rbox(1.2, 2.2, 1.0, 0.1), mat('#1d1838', 0.6)), s * 3.6, 1.7, -2.2));
      for (const y of [1.2, 2.2]) g.add(place(mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.05, 20), mat('#7c5cff', 0.3, 0, '#7c5cff', 0.8)), s * 3.6, y, -1.68, Math.PI / 2));
    }
    const dj = mesh(rbox(2.6, 1.0, 1.0, 0.1), mat('#ff4fa3', 0.4));
    dj.position.set(0, 1.1, -1.6);
    g.add(dj);
    const truss = mat('#c0c4cc', 0.3, 0.8);
    for (const s of [-1, 1]) g.add(place(mesh(new THREE.CylinderGeometry(0.08, 0.08, 5, 8), truss), s * 4.4, 3.1, -2.8));
    g.add(place(mesh(new THREE.CylinderGeometry(0.08, 0.08, 8.8, 8), truss), 0, 5.6, -2.8, 0, 0, Math.PI / 2));
    for (let i = 0; i < 5; i++) {
      const spot = mesh(new THREE.ConeGeometry(0.22, 0.4, 12), mat(['#ff4fa3', '#39d0ff', '#ffc93c', '#2fc97a', '#7c5cff'][i], 0.3, 0, ['#ff4fa3', '#39d0ff', '#ffc93c', '#2fc97a', '#7c5cff'][i], 2), false);
      spot.position.set(-3.2 + i * 1.6, 5.35, -2.8);
      g.add(spot);
    }
    return g;
  }

  /* ------------------------------ animação ------------------------------ */

  update(dt: number): void {
    this.t += dt;
    const t = this.t;
    for (const b of this.balloons) b.position.y = b.userData.base + Math.sin(t * 0.8 + b.position.x) * 0.6;
    for (const h of this.holos) {
      if (h.userData.spin) { h.rotation.y += dt * 1.2; h.position.y += Math.sin(t * 2 + h.id) * 0.002; }
      else if (h.userData.bob !== undefined) h.position.y += Math.sin(t * 0.3 + h.userData.bob) * 0.01;
    }
    if (this.water) (this.water.material as THREE.MeshPhysicalMaterial).emissiveIntensity = 0.22 + Math.sin(t * 2) * 0.05;
    if (this.jets) {
      const pos = this.jets.geometry.attributes.position as THREE.BufferAttribute;
      const ph = this.jets.userData.phase as Float32Array;
      const n = this.jets.userData.n as number;
      for (let i = 0; i < n; i++) {
        const k = (ph[i] + t * 0.55) % 1;
        const a = (i / n) * Math.PI * 2 * 7;
        const r = 0.3 + k * 1.3;
        pos.setXYZ(i, Math.cos(a) * r, 2.9 + Math.sin(k * Math.PI) * 1.6 - k * 0.6, Math.sin(a) * r);
      }
      pos.needsUpdate = true;
    }
    this.train?.update(dt, t);
    if (this.train) this.train.root.position.y = 0.4 + Math.sin(t * 1.3) * 0.05;
  }
}

/** base rochosa de ilha flutuante (cone irregular com cores por vértice) */
export function floatingRock(radius: number, depth: number, seed: number): THREE.Mesh {
  const geo = new THREE.ConeGeometry(radius, depth, 28, 6, true);
  geo.rotateX(Math.PI);
  geo.translate(0, -depth / 2, 0);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors: number[] = [];
  const c1 = new THREE.Color('#9a7b5f'), c2 = new THREE.Color('#6d5442'), c3 = new THREE.Color('#5f8f45');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const n = Math.sin(x * 0.7 + seed) * Math.cos(z * 0.6 + seed * 2) * 0.5 + Math.sin(y * 0.9 + x * 0.2) * 0.5;
    if (y < -0.5) {
      pos.setX(i, x * (1 + n * 0.12));
      pos.setZ(i, z * (1 + n * 0.12));
    }
    const k = Math.min(1, -y / depth);
    const c = y > -1.2 ? c3 : c1.clone().lerp(c2, k + n * 0.15);
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }));
  m.receiveShadow = true;
  return m;
}

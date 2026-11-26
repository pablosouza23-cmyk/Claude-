import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHAR, CollisionWorld, stepCharacter, type CharacterState } from '../../shared/collision';
import { trainPose, trainLocalToWorld, trainWorldToLocal, DEPART_POSE, type TrainSchedule } from '../../shared/train';
import { planMudanca, buildMudancaMap, ITEMS } from '../../shared/games/mudanca';
import { levelFromXp, computeReward } from '../../shared/progression';
import { validateOutfit, randomOutfit, DEFAULT_OWNED } from '../../shared/cosmetics';
import { sanitizeName } from '../../shared/constants';

const s0 = (): CharacterState => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, grounded: true });

test('personagem não atravessa parede', () => {
  const w = new CollisionWorld([{ kind: 'box', x: 2, y: 1, z: 0, hx: 0.2, hy: 1, hz: 5 }], 0);
  const s = s0();
  for (let i = 0; i < 120; i++) stepCharacter(s, { mx: 1, mz: 0, sprint: true, jump: false }, 1 / 60, w);
  assert.ok(s.x < 2 - 0.2 - CHAR.radius + 0.02, `x=${s.x}`);
});

test('personagem sobe degrau baixo e não sobe muro alto', () => {
  const step = new CollisionWorld([{ kind: 'box', x: 2, y: 0.15, z: 0, hx: 1, hy: 0.15, hz: 2 }], 0);
  const s = s0();
  let maxY = 0;
  for (let i = 0; i < 90; i++) { stepCharacter(s, { mx: 1, mz: 0, sprint: false, jump: false }, 1 / 60, step); maxY = Math.max(maxY, s.y); }
  assert.ok(Math.abs(maxY - 0.3) < 0.01 && s.x > 3, `maxY=${maxY} x=${s.x}`);
  const wall = new CollisionWorld([{ kind: 'box', x: 2, y: 0.6, z: 0, hx: 1, hy: 0.6, hz: 2 }], 0);
  const s2 = s0();
  for (let i = 0; i < 90; i++) stepCharacter(s2, { mx: 1, mz: 0, sprint: false, jump: false }, 1 / 60, wall);
  assert.equal(s2.y, 0);
  assert.ok(s2.x < 1, `bloqueado x=${s2.x}`);
});

test('pulo e gravidade', () => {
  const w = new CollisionWorld([], 0);
  const s = s0();
  stepCharacter(s, { mx: 0, mz: 0, sprint: false, jump: true }, 1 / 60, w);
  assert.ok(s.vy > 0 && !s.grounded);
  for (let i = 0; i < 120; i++) stepCharacter(s, { mx: 0, mz: 0, sprint: false, jump: false }, 1 / 60, w);
  assert.ok(s.grounded && s.y === 0);
});

test('trem: pose determinística e conversões local<->mundo', () => {
  const sch: TrainSchedule = { from: DEPART_POSE, to: { x: 0, y: 0.4, z: -32, yaw: 0, pitch: 0, roll: 0 }, departAt: 1000, arriveAt: 33000, phase: 'flight', doorsOpen: false, seed: 1 };
  assert.deepEqual(trainPose(sch, 0), { ...DEPART_POSE });
  assert.equal(trainPose(sch, 40000).x, 0);
  const a = trainPose(sch, 17000), b = trainPose(sch, 17000);
  assert.deepEqual(a, b);
  assert.ok(a.y > 60, 'voa acima das estações');
  const [wx, wy, wz] = trainLocalToWorld(a, 3, 0, 1);
  const [lx, , lz] = trainWorldToLocal(a, wx, wy, wz);
  assert.ok(Math.abs(lx - 3) < 1e-9 && Math.abs(lz - 1) < 1e-9);
});

test('Mudança: missão muda com o nº de jogadores e dificuldade', () => {
  const p2 = planMudanca(2, 'medio'), p4 = planMudanca(4, 'medio');
  assert.equal(p2.layout, 'compacta');
  assert.equal(p4.layout, 'sobrado');
  assert.ok(p4.items.length > p2.items.length);
  assert.ok(p4.items.includes('piano'));
  assert.ok(planMudanca(3, 'facil').timeSec > planMudanca(3, 'dificil').timeSec);
  assert.ok(planMudanca(3, 'dificil').quota > planMudanca(3, 'facil').quota);
  const m4 = buildMudancaMap(p4);
  assert.equal(m4.houses[0].floors, 2);
  assert.ok(m4.itemSpots.some((s) => s.floor === 1), 'há itens no 2º andar');
  for (const k of p4.items) assert.ok(ITEMS[k]);
});

test('progressão e recompensas', () => {
  assert.equal(levelFromXp(0).level, 1);
  assert.ok(levelFromXp(5000).level > 5);
  const solo = computeReward(true, 3, 'medio', 0), friends = computeReward(true, 3, 'medio', 2);
  assert.ok(friends.xp > solo.xp && friends.friendBonus);
});

test('visual só aceita itens possuídos e cores válidas', () => {
  const fb = randomOutfit(0.5);
  const o = validateOutfit({ ...fb, hat: 'hat-crown', topColor: 'javascript:alert(1)' }, new Set(DEFAULT_OWNED), fb);
  assert.equal(o.hat, fb.hat);
  assert.equal(o.topColor, fb.topColor);
  assert.equal(sanitizeName('<script>'), 'script');
  assert.equal(sanitizeName('ab'), null);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CollisionWorld, stepCharacter } from '../../shared/collision';
import { buildNaveMap, planNave, rolesFor, usePoint, SHIP_FLOOR } from '../../shared/games/nave';
import { planSummary } from '../../shared/plans';

test('Nave: o desenho muda com o nº de jogadores e a dificuldade', () => {
  const p2 = planNave(2, 'medio'), p4 = planNave(4, 'medio'), p6 = planNave(6, 'medio'), p9 = planNave(9, 'medio');
  assert.equal(p2.layout, 'pequena');
  assert.equal(p4.layout, 'media');
  assert.equal(p6.layout, 'grande');
  assert.equal(p9.layout, 'cruzador');
  assert.equal(p2.maxConcurrent, 1, '2 jogadores: falhas sequenciais');
  assert.ok(p6.duo && !p4.duo, 'tarefas de 2 pessoas a partir de 6');
  assert.ok(p9.farEvents && !p6.farEvents);
  assert.ok(planNave(4, 'facil').failEvery[0] > planNave(4, 'dificil').failEvery[0]);
  assert.ok(planNave(4, 'facil').startFuel > planNave(4, 'dificil').startFuel);
  assert.ok(planNave(4, 'facil').hints && !planNave(4, 'dificil').hints);
  assert.deepEqual(planSummary('nave', 4, 'medio'), p4.lines);
  const m2 = buildNaveMap(p2.layout), m4 = buildNaveMap(p4.layout), m6 = buildNaveMap(p6.layout), m9 = buildNaveMap(p9.layout);
  const modules = (m: ReturnType<typeof buildNaveMap>) => m.rooms.filter((r) => r.id !== 'eclusa' && !r.corridor).length;
  assert.equal(modules(m2), 2);
  assert.equal(modules(m4), 4);
  assert.equal(modules(m6), 6);
  assert.ok(modules(m9) >= 8);
  assert.equal(m9.stations.filter((s) => s.kind === 'engine').length, 2);
  assert.equal(rolesFor(10).length, 10);
  assert.equal(new Set(rolesFor(6).map((r) => r.id)).size, 6);
});

test('Nave: consoles e spawns são alcançáveis e a eclusa começa aberta', () => {
  for (const layout of ['pequena', 'media', 'grande', 'cruzador'] as const) {
    const m = buildNaveMap(layout);
    const w = new CollisionWorld(m.colliders, null);
    const settle = (x: number, z: number) => {
      const st = { x, y: SHIP_FLOOR, z, vx: 0, vy: 0, vz: 0, grounded: true };
      for (let i = 0; i < 30; i++) stepCharacter(st, { mx: 0, mz: 0, sprint: false, jump: false }, 1 / 60, w);
      return st;
    };
    for (const s of m.stations) {
      const u = usePoint(s);
      const st = settle(u.x, u.z);
      assert.ok(Math.hypot(st.x - u.x, st.z - u.z) < 0.05 && Math.abs(st.y - SHIP_FLOOR) < 0.01, `${layout}/${s.id}: ponto de uso bloqueado (${st.x.toFixed(2)},${st.y.toFixed(2)},${st.z.toFixed(2)})`);
    }
    for (const sp of m.spawns) {
      const st = settle(sp.x, sp.z);
      assert.ok(Math.hypot(st.x - sp.x, st.z - sp.z) < 0.05 && Math.abs(st.y - SHIP_FLOOR) < 0.01, `${layout}: spawn bloqueado em ${sp.x},${sp.z}`);
    }
    // caminhar pela passarela, até dentro da nave
    const st = { x: 0, y: SHIP_FLOOR, z: -19.5, vx: 0, vy: 0, vz: 0, grounded: true };
    for (let i = 0; i < 60 * 5; i++) stepCharacter(st, { mx: 0, mz: 1, sprint: false, jump: false }, 1 / 60, w);
    assert.ok(st.z > -9.5 && Math.abs(st.y - SHIP_FLOOR) < 0.01, `${layout}: não entrou pela eclusa (z=${st.z.toFixed(2)})`);
    const door = w.byId('nave-airlock')!;
    assert.ok(door.disabled);
    door.disabled = false;
    const out = { x: 0, y: SHIP_FLOOR, z: -19.5, vx: 0, vy: 0, vz: 0, grounded: true };
    for (let i = 0; i < 60 * 5; i++) stepCharacter(out, { mx: 0, mz: 1, sprint: false, jump: false }, 1 / 60, w);
    assert.ok(out.z < -14, `${layout}: eclusa fechada deveria bloquear`);
  }
});

// Prueba de punta a punta contra el stack levantado. Usar un proyecto aparte: crea datos de prueba.
// BASE_URL=http://localhost:8081 ADMIN_EMAIL=... ADMIN_PASSWORD=... node tests/e2e.mjs
import assert from 'node:assert/strict';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8080';
const run = Date.now();

async function call(path, { token, method = 'GET', body, expect = 200 } = {}) {
  const response = await fetch(`${BASE_URL}/api${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  assert.equal(response.status, expect, `${method} ${path}: ${text}`);
  return { data: text ? JSON.parse(text) : null, servedBy: response.headers.get('x-served-by') };
}

const register = async (name) => {
  const body = { name, email: `${name}-${run}@prueba.test`, password: 'prueba-123' };
  return (await call('/auth/register', { method: 'POST', body, expect: 201 })).data;
};

const step = (message) => console.log(`ok  ${message}`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const replicas = new Set();
for (let i = 0; i < 12; i += 1) replicas.add((await call('/health')).servedBy);
assert.ok(replicas.size >= 2, 'el balanceador debería repartir entre réplicas');
step(`balanceo: ${replicas.size} réplicas respondieron`);

await call('/matches', { expect: 401 });
step('rutas protegidas sin token devuelven 401');

const admin = (
  await call('/auth/login', {
    method: 'POST',
    body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD },
  })
).data;
const ana = await register('ana');
const beto = await register('beto');
const carla = await register('carla');

await call('/matches', { token: ana.token, method: 'POST', body: {}, expect: 403 });
step('un usuario normal no puede administrar');

const kickoff = new Date(Date.now() + 4000).toISOString();
const created = [];
for (const [home, away] of [['A', 'B'], ['C', 'D'], ['E', 'F']]) {
  const body = { home: `${home}-${run}`, away: `${away}-${run}`, kickoff_at: kickoff };
  created.push((await call('/matches', { token: admin.token, method: 'POST', body, expect: 201 })).data);
}
const predict = (user, match, home_score, away_score, expect = 200) =>
  call(`/matches/${match.id}/prediction`, {
    token: user.token,
    method: 'PUT',
    body: { home_score, away_score },
    expect,
  });

await call(`/matches/${created[0].id}/result`, {
  token: admin.token,
  method: 'PUT',
  body: { home_score: 1, away_score: 0 },
  expect: 409,
});
step('no se carga resultado antes del inicio');

await predict(ana, created[0], 0, 0);
await predict(ana, created[0], 2, 1); // la edición reemplaza la predicción
await predict(ana, created[1], 3, 1);
await predict(ana, created[2], 1, 1);
await predict(beto, created[0], 0, 3);
await predict(beto, created[1], 2, 0);
await predict(carla, created[0], 1, 0);
await predict(ana, created[0], 31, 0, 400);
step('predicciones guardadas y validadas');

const room = (await call('/rooms', { token: ana.token, method: 'POST', body: { name: 'Sala' }, expect: 201 })).data;
await call(`/rooms/${room.id}`, { token: beto.token, expect: 404 });
step('la sala no es visible sin invitación');
await call('/rooms/join', { token: beto.token, method: 'POST', body: { code: 'NOEXISTE' }, expect: 404 });
await call('/rooms/join', { token: beto.token, method: 'POST', body: { code: room.invite_code } });
await call('/rooms/join', { token: beto.token, method: 'POST', body: { code: room.invite_code } });
step('unirse por invitación es repetible sin duplicar');

await sleep(4500);
await predict(carla, created[1], 1, 0, 409);
step('predicción rechazada después del inicio');

const results = [[2, 1], [2, 0], [1, 1]];
for (const [index, [home_score, away_score]] of results.entries()) {
  await call(`/matches/${created[index].id}/result`, {
    token: admin.token,
    method: 'PUT',
    body: { home_score, away_score },
  });
}

// Ana: exacto 10, ganador+diferencia 5, empate exacto 8 y racha +2 = 25. Solo cuentan estos tres partidos.
const detail = (await call(`/rooms/${room.id}`, { token: ana.token })).data;
assert.equal(detail.ranking.length, 2);
assert.equal(detail.ranking[0].name, 'ana');
assert.equal(detail.ranking[0].points, 25);
assert.equal(detail.ranking[0].exact_hits, 2);
assert.equal(detail.ranking[0].streak_points, 2);
// Beto: falla el primero y acierta exacto el segundo = 10.
assert.equal(detail.ranking[1].name, 'beto');
assert.equal(detail.ranking[1].points, 10);
step('puntajes de la sala correctos: ana 25, beto 10');

await call(`/matches/${created[0].id}/result`, {
  token: admin.token,
  method: 'PUT',
  body: { home_score: 0, away_score: 3 },
});
const corrected = (await call(`/rooms/${room.id}`, { token: ana.token })).data;
assert.equal(corrected.ranking[0].name, 'beto');
assert.equal(corrected.ranking[0].points, 20);
step('corregir un resultado recalcula el ranking');

await call(`/rooms/${room.id}/members/me`, { token: beto.token, method: 'DELETE', expect: 204 });
await call(`/rooms/${room.id}`, { token: beto.token, expect: 404 });
await call(`/rooms/${room.id}/members/me`, { token: ana.token, method: 'DELETE', expect: 204 });
step('salir de la sala funciona');

console.log('\nTodas las pruebas pasaron');

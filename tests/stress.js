// Prueba de estrés: usuarios concurrentes que ven partidos, predicen y consultan el ranking.
import { check, sleep } from 'k6';
import http from 'k6/http';

const BASE_URL = __ENV.BASE_URL;
const PEAK = Number(__ENV.PEAK ?? 300);
const USERS = 50;
const json = (token) => ({
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
});

export const options = {
  setupTimeout: '180s',
  stages: [
    { duration: '20s', target: Math.round(PEAK / 3) },
    { duration: '30s', target: PEAK },
    { duration: '30s', target: PEAK },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
  },
};

export function setup() {
  const login = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: __ENV.ADMIN_EMAIL, password: __ENV.ADMIN_PASSWORD }),
    json(),
  );
  const admin = login.json('token');
  const kickoff = new Date(Date.now() + 7 * 24 * 3_600_000).toISOString();
  const match = http.post(
    `${BASE_URL}/api/matches`,
    JSON.stringify({ home: 'Estrés A', away: 'Estrés B', stage: 'Prueba', kickoff_at: kickoff }),
    json(admin),
  );

  const run = Date.now();
  const tokens = [];
  for (let i = 0; i < USERS; i += 1) {
    const response = http.post(
      `${BASE_URL}/api/auth/register`,
      JSON.stringify({ name: `Carga ${i}`, email: `carga-${run}-${i}@prueba.test`, password: 'prueba-123' }),
      json(),
    );
    tokens.push(response.json('token'));
  }
  return { tokens, matchId: match.json('id') };
}

export default function ({ tokens, matchId }) {
  const token = tokens[__VU % tokens.length];
  const params = json(token);

  check(http.get(`${BASE_URL}/api/matches`, params), { 'partidos 200': (r) => r.status === 200 });
  check(
    http.put(
      `${BASE_URL}/api/matches/${matchId}/prediction`,
      JSON.stringify({ home_score: __ITER % 5, away_score: __VU % 5 }),
      params,
    ),
    { 'predicción 200': (r) => r.status === 200 },
  );
  check(http.get(`${BASE_URL}/api/ranking`, params), { 'ranking 200': (r) => r.status === 200 });
  sleep(0.5);
}

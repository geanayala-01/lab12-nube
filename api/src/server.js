import crypto from 'node:crypto';
import os from 'node:os';
import bcrypt from 'bcryptjs';
import express from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import { DEFAULT_RULES, scoreUser } from './scoring.js';

const { ADMIN_EMAIL, ADMIN_PASSWORD, DATABASE_URL, JWT_SECRET } = process.env;
const PORT = Number(process.env.PORT ?? 3000);
const RULES = { ...DEFAULT_RULES, cumulative: process.env.SCORING_CUMULATIVE !== 'false' };
const HOSTNAME = os.hostname();

const pool = new pg.Pool({ connectionString: DATABASE_URL, max: Number(process.env.DB_POOL ?? 10) });
const app = express();

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const isScore = (value) => Number.isInteger(value) && value >= 0 && value <= 30;
const signToken = (user) =>
  jwt.sign({ id: user.id, name: user.name, isAdmin: user.is_admin }, JWT_SECRET, { expiresIn: '7d' });

function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0 || id > 2_147_483_647) throw new HttpError(404, 'No encontrado');
  return id;
}

function requireAuth(req, _res, next) {
  const token = req.headers.authorization?.replace(/^Bearer /, '');
  try {
    req.user = jwt.verify(token, JWT_SECRET);
  } catch {
    throw new HttpError(401, 'Sesión no válida');
  }
  next();
}

function requireAdmin(req, _res, next) {
  if (!req.user.isAdmin) throw new HttpError(403, 'Solo para administradores');
  next();
}

async function requireMember(roomId, userId) {
  const { rowCount } = await pool.query(
    'SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2',
    [roomId, userId],
  );
  if (!rowCount) throw new HttpError(404, 'Sala no encontrada');
}

const RANKING_COLUMNS = `
  u.id, u.name,
  COALESCE(SUM(s.total), 0)::int AS points,
  (COUNT(s.match_id) FILTER (WHERE s.exact))::int AS exact_hits,
  (COUNT(s.match_id) FILTER (WHERE s.winner))::int AS winner_hits,
  COALESCE(SUM(s.streak_bonus), 0)::int AS streak_points,
  COALESCE(SUM(s.early_bonus), 0)::int AS early_points,
  (RANK() OVER (
    ORDER BY COALESCE(SUM(s.total), 0) DESC, COUNT(s.match_id) FILTER (WHERE s.exact) DESC
  ))::int AS position`;

// Recalcula todo desde cero: corregir un resultado deja la tabla consistente.
async function recalculateScores(client) {
  await client.query('SELECT pg_advisory_xact_lock(1)');
  const { rows: matches } = await client.query(
    'SELECT * FROM matches WHERE finished ORDER BY kickoff_at, id',
  );
  const { rows: predictions } = await client.query(
    'SELECT p.* FROM predictions p JOIN matches m ON m.id = p.match_id WHERE m.finished',
  );

  const byUser = new Map();
  for (const prediction of predictions) {
    if (!byUser.has(prediction.user_id)) byUser.set(prediction.user_id, new Map());
    byUser.get(prediction.user_id).set(prediction.match_id, prediction);
  }

  const rows = [...byUser].flatMap(([userId, userPredictions]) =>
    scoreUser(matches, userPredictions, RULES).map((row) => ({ userId, ...row })),
  );

  await client.query('DELETE FROM scores');
  await client.query(
    `INSERT INTO scores (user_id, match_id, exact, winner, diff, base, early_bonus, streak_bonus, total)
     SELECT * FROM unnest($1::int[], $2::int[], $3::bool[], $4::bool[], $5::bool[], $6::int[], $7::int[], $8::int[], $9::int[])`,
    [
      rows.map((r) => r.userId),
      rows.map((r) => r.matchId),
      rows.map((r) => r.exact),
      rows.map((r) => r.winner),
      rows.map((r) => r.diff),
      rows.map((r) => r.base),
      rows.map((r) => r.earlyBonus),
      rows.map((r) => r.streakBonus),
      rows.map((r) => r.total),
    ],
  );
}

app.use(express.json());
app.use((_req, res, next) => {
  res.setHeader('X-Served-By', HOSTNAME);
  next();
});

app.get('/api/health', async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok', servedBy: HOSTNAME });
});

app.get('/api/rules', (_req, res) => res.json(RULES));

app.post('/api/auth/register', async (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  if (!name || name.length > 60) throw new HttpError(400, 'Ingresa un nombre de hasta 60 caracteres');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Correo no válido');
  if (password.length < 6) throw new HttpError(400, 'La contraseña debe tener al menos 6 caracteres');

  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO NOTHING RETURNING *`,
    [name, email, await bcrypt.hash(password, 10)],
  );
  if (!rows.length) throw new HttpError(409, 'Ese correo ya está registrado');
  res.status(201).json({ token: signToken(rows[0]), user: { id: rows[0].id, name, isAdmin: false } });
});

app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(String(req.body?.password ?? ''), user.password_hash))) {
    throw new HttpError(401, 'Correo o contraseña incorrectos');
  }
  res.json({ token: signToken(user), user: { id: user.id, name: user.name, isAdmin: user.is_admin } });
});

app.get('/api/matches', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT m.*, m.kickoff_at <= now() AS locked,
            p.home_score AS my_home, p.away_score AS my_away, p.updated_at AS my_updated_at,
            s.base, s.early_bonus, s.streak_bonus, s.total
     FROM matches m
     LEFT JOIN predictions p ON p.match_id = m.id AND p.user_id = $1
     LEFT JOIN scores s ON s.match_id = m.id AND s.user_id = $1
     ORDER BY m.kickoff_at, m.id`,
    [req.user.id],
  );
  res.json(rows);
});

app.post('/api/matches', requireAuth, requireAdmin, async (req, res) => {
  const home = String(req.body?.home ?? '').trim();
  const away = String(req.body?.away ?? '').trim();
  const stage = String(req.body?.stage ?? '').trim() || 'Fase liga';
  const kickoff = new Date(req.body?.kickoff_at);
  if (!home || !away || Number.isNaN(kickoff.getTime())) {
    throw new HttpError(400, 'Completa equipos y fecha');
  }
  const { rows } = await pool.query(
    'INSERT INTO matches (home, away, stage, kickoff_at) VALUES ($1, $2, $3, $4) RETURNING *',
    [home, away, stage, kickoff],
  );
  res.status(201).json(rows[0]);
});

app.put('/api/matches/:id/result', requireAuth, requireAdmin, async (req, res) => {
  const matchId = parseId(req.params.id);
  const { home_score: home, away_score: away } = req.body ?? {};
  if (!isScore(home) || !isScore(away)) throw new HttpError(400, 'Marcador no válido');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rowCount } = await client.query(
      `UPDATE matches SET home_score = $1, away_score = $2, finished = TRUE
       WHERE id = $3 AND kickoff_at <= now()`,
      [home, away, matchId],
    );
    if (!rowCount) throw new HttpError(409, 'El partido no existe o todavía no empieza');
    await recalculateScores(client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  res.json({ ok: true });
});

app.put('/api/matches/:id/prediction', requireAuth, async (req, res) => {
  const matchId = parseId(req.params.id);
  const { home_score: home, away_score: away } = req.body ?? {};
  if (!isScore(home) || !isScore(away)) throw new HttpError(400, 'Marcador no válido');

  // El cierre se valida en la misma consulta para que no dependa del reloj de cada réplica.
  const { rows } = await pool.query(
    `INSERT INTO predictions (user_id, match_id, home_score, away_score)
     SELECT $1::int, m.id, $3::int, $4::int FROM matches m WHERE m.id = $2 AND m.kickoff_at > now()
     ON CONFLICT (user_id, match_id)
     DO UPDATE SET home_score = EXCLUDED.home_score, away_score = EXCLUDED.away_score, updated_at = now()
     RETURNING *`,
    [req.user.id, matchId, home, away],
  );
  if (!rows.length) throw new HttpError(409, 'Las predicciones de este partido están cerradas');
  res.json(rows[0]);
});

app.get('/api/ranking', requireAuth, async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT ${RANKING_COLUMNS}
     FROM users u LEFT JOIN scores s ON s.user_id = u.id
     WHERE NOT u.is_admin
     GROUP BY u.id ORDER BY position, u.name LIMIT 100`,
  );
  res.json(rows);
});

app.get('/api/rooms', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT r.id, r.name, r.invite_code, r.owner_id,
            (SELECT COUNT(*)::int FROM room_members WHERE room_id = r.id) AS members
     FROM rooms r JOIN room_members rm ON rm.room_id = r.id
     WHERE rm.user_id = $1 ORDER BY r.created_at DESC`,
    [req.user.id],
  );
  res.json(rows);
});

app.post('/api/rooms', requireAuth, async (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  if (!name || name.length > 60) throw new HttpError(400, 'Ingresa un nombre de hasta 60 caracteres');

  const inviteCode = crypto.randomBytes(5).toString('hex').toUpperCase();
  const { rows } = await pool.query(
    `WITH room AS (
       INSERT INTO rooms (name, invite_code, owner_id) VALUES ($1, $2, $3) RETURNING *
     ), member AS (
       INSERT INTO room_members (room_id, user_id) SELECT id, owner_id FROM room
     )
     SELECT * FROM room`,
    [name, inviteCode, req.user.id],
  );
  res.status(201).json(rows[0]);
});

app.post('/api/rooms/join', requireAuth, async (req, res) => {
  const code = String(req.body?.code ?? '').trim().toUpperCase();
  const { rows } = await pool.query('SELECT id, name FROM rooms WHERE invite_code = $1', [code]);
  if (!rows.length) throw new HttpError(404, 'Código de invitación no válido');
  await pool.query(
    'INSERT INTO room_members (room_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [rows[0].id, req.user.id],
  );
  res.json(rows[0]);
});

app.get('/api/rooms/:id', requireAuth, async (req, res) => {
  const roomId = parseId(req.params.id);
  await requireMember(roomId, req.user.id);
  const [{ rows: rooms }, { rows: ranking }] = await Promise.all([
    pool.query('SELECT * FROM rooms WHERE id = $1', [roomId]),
    pool.query(
      `SELECT ${RANKING_COLUMNS}
       FROM room_members rm
       JOIN users u ON u.id = rm.user_id
       LEFT JOIN scores s ON s.user_id = u.id
       WHERE rm.room_id = $1
       GROUP BY u.id ORDER BY position, u.name`,
      [roomId],
    ),
  ]);
  res.json({ ...rooms[0], ranking });
});

// Si sale quien creó la sala, la sala se elimina para todos.
app.delete('/api/rooms/:id/members/me', requireAuth, async (req, res) => {
  const roomId = parseId(req.params.id);
  await requireMember(roomId, req.user.id);
  await pool.query('DELETE FROM rooms WHERE id = $1 AND owner_id = $2', [roomId, req.user.id]);
  await pool.query('DELETE FROM room_members WHERE room_id = $1 AND user_id = $2', [roomId, req.user.id]);
  res.status(204).end();
});

app.use((_req, _res, next) => next(new HttpError(404, 'Ruta no encontrada')));

app.use((error, _req, res, _next) => {
  const status = error.status ?? 500;
  if (status === 500) console.error(error);
  res.status(status).json({ error: status === 500 ? 'Error interno' : error.message });
});

async function seedAdmin() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) return;
  await pool.query(
    `INSERT INTO users (name, email, password_hash, is_admin) VALUES ('Administrador', $1, $2, TRUE)
     ON CONFLICT (email) DO NOTHING`,
    [ADMIN_EMAIL.toLowerCase(), await bcrypt.hash(ADMIN_PASSWORD, 10)],
  );
}

await seedAdmin();
const server = app.listen(PORT, () => console.log(`API ${HOSTNAME} en el puerto ${PORT}`));

process.on('SIGTERM', () => server.close(() => pool.end().then(() => process.exit(0))));

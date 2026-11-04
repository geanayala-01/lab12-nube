CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_admin      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE matches (
  id         SERIAL PRIMARY KEY,
  home       TEXT NOT NULL,
  away       TEXT NOT NULL,
  stage      TEXT NOT NULL DEFAULT 'Fase liga',
  kickoff_at TIMESTAMPTZ NOT NULL,
  home_score INT,
  away_score INT,
  finished   BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX matches_kickoff_idx ON matches (kickoff_at, id);

CREATE TABLE predictions (
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_id   INT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  home_score INT NOT NULL CHECK (home_score BETWEEN 0 AND 30),
  away_score INT NOT NULL CHECK (away_score BETWEEN 0 AND 30),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, match_id)
);
CREATE INDEX predictions_match_idx ON predictions (match_id);

-- Puntos ya calculados por usuario y partido; se regeneran al cargar un resultado.
CREATE TABLE scores (
  user_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_id     INT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  exact        BOOLEAN NOT NULL,
  winner       BOOLEAN NOT NULL,
  diff         BOOLEAN NOT NULL,
  base         INT NOT NULL,
  early_bonus  INT NOT NULL,
  streak_bonus INT NOT NULL,
  total        INT NOT NULL,
  PRIMARY KEY (user_id, match_id)
);

CREATE TABLE rooms (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  owner_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE room_members (
  room_id   INT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);
CREATE INDEX room_members_user_idx ON room_members (user_id);

-- UEFA Champions League 2026/27, fase liga, jornada 4: miércoles 4 de noviembre de 2026.
-- Horarios oficiales 18:45 y 21:00 CET (UTC+1).
INSERT INTO matches (home, away, stage, kickoff_at) VALUES
  ('AEK Atenas',        'Real Madrid',     'Jornada 4', '2026-11-04 18:45:00+01'),
  ('Fenerbahçe',        'Liverpool',       'Jornada 4', '2026-11-04 18:45:00+01'),
  ('Borussia Dortmund', 'Real Betis',      'Jornada 4', '2026-11-04 21:00:00+01'),
  ('Porto',             'Napoli',          'Jornada 4', '2026-11-04 21:00:00+01'),
  ('PSV Eindhoven',     'Club Brugge',     'Jornada 4', '2026-11-04 21:00:00+01'),
  ('RB Leipzig',        'Manchester City', 'Jornada 4', '2026-11-04 21:00:00+01'),
  ('Lens',              'Como',            'Jornada 4', '2026-11-04 21:00:00+01'),
  ('Slavia Praga',      'Arsenal',         'Jornada 4', '2026-11-04 21:00:00+01'),
  ('Viking',            'Sabah',           'Jornada 4', '2026-11-04 21:00:00+01');

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_RULES, scorePrediction, scoreUser } from '../src/scoring.js';

const KICKOFF = '2026-11-04T20:00:00Z';
const HOUR = 3_600_000;

const match = (home_score, away_score, id = 1) => ({ id, home_score, away_score, kickoff_at: KICKOFF });
const prediction = (home_score, away_score, hoursBefore = 1) => ({
  home_score,
  away_score,
  updated_at: new Date(new Date(KICKOFF).getTime() - hoursBefore * HOUR),
});

describe('scorePrediction', () => {
  it('marcador exacto suma exacto, ganador y diferencia', () => {
    const score = scorePrediction(prediction(2, 1), match(2, 1));
    assert.deepEqual(score, { exact: true, winner: true, diff: true, base: 10, earlyBonus: 0 });
  });

  it('ganador y diferencia sin marcador exacto (ejemplo de la guía: 3-1 y 2-0)', () => {
    const score = scorePrediction(prediction(3, 1), match(2, 0));
    assert.equal(score.exact, false);
    assert.equal(score.diff, true);
    assert.equal(score.base, 5);
  });

  it('solo ganador', () => {
    assert.equal(scorePrediction(prediction(3, 0), match(1, 0)).base, 3);
  });

  it('el visitante ganador también cuenta', () => {
    assert.equal(scorePrediction(prediction(0, 2), match(1, 3)).base, 5);
  });

  it('la misma diferencia a favor del otro equipo no da puntos', () => {
    assert.equal(scorePrediction(prediction(2, 0), match(0, 2)).base, 0);
  });

  it('acertar un empate da ganador pero no diferencia', () => {
    const score = scorePrediction(prediction(1, 1), match(0, 0));
    assert.equal(score.winner, true);
    assert.equal(score.diff, false);
    assert.equal(score.base, 3);
  });

  it('empate exacto suma exacto y ganador', () => {
    assert.equal(scorePrediction(prediction(1, 1), match(1, 1)).base, 8);
  });

  it('fallo total da cero', () => {
    assert.equal(scorePrediction(prediction(2, 0), match(0, 1)).base, 0);
  });

  it('modo no acumulable toma solo la regla mayor', () => {
    const rules = { ...DEFAULT_RULES, cumulative: false };
    assert.equal(scorePrediction(prediction(2, 1), match(2, 1), rules).base, 5);
    assert.equal(scorePrediction(prediction(3, 1), match(2, 0), rules).base, 3);
  });
});

describe('predicción anticipada', () => {
  it('más de 24 horas suma 1', () => {
    assert.equal(scorePrediction(prediction(1, 0, 25), match(2, 0)).earlyBonus, 1);
  });

  it('exactamente 24 horas no suma', () => {
    assert.equal(scorePrediction(prediction(1, 0, 24), match(2, 0)).earlyBonus, 0);
  });

  it('último minuto solo recibe puntos base', () => {
    const score = scorePrediction(prediction(1, 0, 10 / 60), match(2, 0));
    assert.equal(score.base, 3);
    assert.equal(score.earlyBonus, 0);
  });

  it('una predicción fallida no recibe el extra', () => {
    assert.equal(scorePrediction(prediction(0, 1, 48), match(2, 0)).earlyBonus, 0);
  });
});

describe('scoreUser', () => {
  const played = (count) => Array.from({ length: count }, (_, i) => match(1, 0, i + 1));
  const predictions = (ids, value = prediction(2, 0)) => new Map(ids.map((id) => [id, value]));
  const bonuses = (rows) => rows.map((row) => row.streakBonus);

  it('suma 2 en el tercer acierto seguido', () => {
    assert.deepEqual(bonuses(scoreUser(played(3), predictions([1, 2, 3]))), [0, 0, 2]);
  });

  it('suma 2 por cada bloque de 3 aciertos', () => {
    const rows = scoreUser(played(6), predictions([1, 2, 3, 4, 5, 6]));
    assert.deepEqual(bonuses(rows), [0, 0, 2, 0, 0, 2]);
  });

  it('un fallo corta la racha', () => {
    const map = predictions([1, 2, 4, 5, 6]);
    map.set(3, prediction(0, 1));
    assert.deepEqual(bonuses(scoreUser(played(6), map)), [0, 0, 0, 0, 0, 2]);
  });

  it('no predecir un partido corta la racha', () => {
    const rows = scoreUser(played(4), predictions([1, 2, 4]));
    assert.deepEqual(bonuses(rows), [0, 0, 0]);
  });

  it('el total junta base, anticipada y racha', () => {
    const map = predictions([1, 2, 3], prediction(1, 0, 30));
    const rows = scoreUser(played(3), map);
    assert.deepEqual(rows.map((row) => row.total), [11, 11, 13]);
  });
});

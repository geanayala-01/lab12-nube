export const DEFAULT_RULES = {
  exact: 5,
  winner: 3,
  diff: 2,
  streakEvery: 3,
  streakBonus: 2,
  earlyBonus: 1,
  earlyHours: 24,
  // true: las reglas se suman. false: solo cuenta la regla de mayor valor.
  cumulative: true,
};

const outcome = (home, away) => Math.sign(home - away);

export function scorePrediction(prediction, match, rules = DEFAULT_RULES) {
  const { home_score: ph, away_score: pa } = prediction;
  const { home_score: rh, away_score: ra } = match;

  const exact = ph === rh && pa === ra;
  const winner = outcome(ph, pa) === outcome(rh, ra);
  // En un empate no hay margen de victoria, así que esta regla no aplica.
  const diff = winner && rh !== ra && ph - pa === rh - ra;

  const earned = [exact && rules.exact, winner && rules.winner, diff && rules.diff].map(Number);
  const base = rules.cumulative
    ? earned.reduce((sum, points) => sum + points, 0)
    : Math.max(...earned);

  const anticipationMs = new Date(match.kickoff_at) - new Date(prediction.updated_at);
  const isEarly = anticipationMs > rules.earlyHours * 3_600_000;
  const earlyBonus = base > 0 && isEarly ? rules.earlyBonus : 0;

  return { exact, winner, diff, base, earlyBonus };
}

// `matches` debe venir en orden cronológico y solo con partidos terminados.
export function scoreUser(matches, predictionsByMatch, rules = DEFAULT_RULES) {
  const rows = [];
  let streak = 0;

  for (const match of matches) {
    const prediction = predictionsByMatch.get(match.id);
    if (!prediction) {
      streak = 0;
      continue;
    }

    const score = scorePrediction(prediction, match, rules);
    streak = score.winner ? streak + 1 : 0;
    const streakBonus = streak > 0 && streak % rules.streakEvery === 0 ? rules.streakBonus : 0;

    rows.push({
      matchId: match.id,
      ...score,
      streakBonus,
      total: score.base + score.earlyBonus + streakBonus,
    });
  }

  return rows;
}

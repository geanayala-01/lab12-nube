'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import Shell from '../Shell';

const formatKickoff = (date) =>
  new Date(date).toLocaleString('es-PE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

function MatchCard({ match, onSaved }) {
  const [home, setHome] = useState(match.my_home ?? '');
  const [away, setAway] = useState(match.my_away ?? '');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  async function save() {
    setError('');
    setStatus('');
    try {
      await api(`/matches/${match.id}/prediction`, {
        method: 'PUT',
        body: { home_score: Number(home), away_score: Number(away) },
      });
      setStatus('Guardado');
      onSaved();
    } catch (failure) {
      setError(failure.message);
      onSaved();
    }
  }

  const hasPrediction = match.my_home !== null;

  return (
    <article className="card">
      <div className="match">
        <span className="team home">{match.home}</span>
        {match.finished ? (
          <span className="final">{match.home_score} - {match.away_score}</span>
        ) : (
          <span className="score-inputs">
            <input
              className="goal"
              type="number"
              min="0"
              max="30"
              aria-label={`Goles de ${match.home}`}
              value={home}
              disabled={match.locked}
              onChange={(event) => setHome(event.target.value)}
            />
            -
            <input
              className="goal"
              type="number"
              min="0"
              max="30"
              aria-label={`Goles de ${match.away}`}
              value={away}
              disabled={match.locked}
              onChange={(event) => setAway(event.target.value)}
            />
          </span>
        )}
        <span className="team">{match.away}</span>
      </div>
      <div className="match-foot">
        <span>{match.stage} · {formatKickoff(match.kickoff_at)}</span>
        {match.finished ? (
          <span>
            {hasPrediction ? `Tu predicción: ${match.my_home} - ${match.my_away} ` : 'Sin predicción '}
            {match.total !== null && (
              <>
                <span className="chip">base {match.base}</span>
                {match.early_bonus > 0 && <span className="chip">anticipada +{match.early_bonus}</span>}
                {match.streak_bonus > 0 && <span className="chip">racha +{match.streak_bonus}</span>}
                <strong className="ok">{match.total} pts</strong>
              </>
            )}
          </span>
        ) : match.locked ? (
          <span>Cerrado, esperando resultado</span>
        ) : (
          <span>
            {error && <span className="error">{error} </span>}
            {status && <span className="ok">{status} </span>}
            <button disabled={home === '' || away === ''} onClick={save}>
              {hasPrediction ? 'Actualizar' : 'Guardar'}
            </button>
          </span>
        )}
      </div>
    </article>
  );
}

function Matches() {
  const [matches, setMatches] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api('/matches').then(setMatches).catch((failure) => setError(failure.message));
  }, []);

  useEffect(load, [load]);

  return (
    <>
      <h1>Partidos</h1>
      <p className="sub">Las predicciones se cierran al inicio de cada partido. Horarios en tu hora local.</p>
      {error && <p className="error">{error}</p>}
      {matches?.map((match) => <MatchCard key={match.id} match={match} onSaved={load} />)}
    </>
  );
}

export default function MatchesPage() {
  return <Shell>{() => <Matches />}</Shell>;
}

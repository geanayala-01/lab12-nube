'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import Shell from '../Shell';

function ResultRow({ match, onSaved }) {
  const [home, setHome] = useState(match.home_score ?? '');
  const [away, setAway] = useState(match.away_score ?? '');
  const [error, setError] = useState('');

  async function save() {
    setError('');
    try {
      await api(`/matches/${match.id}/result`, {
        method: 'PUT',
        body: { home_score: Number(home), away_score: Number(away) },
      });
      onSaved();
    } catch (failure) {
      setError(failure.message);
    }
  }

  return (
    <div className="card">
      <div className="match">
        <span className="team home">{match.home}</span>
        <span className="score-inputs">
          <input
            className="goal"
            type="number"
            min="0"
            max="30"
            aria-label={`Goles de ${match.home}`}
            value={home}
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
            onChange={(event) => setAway(event.target.value)}
          />
        </span>
        <span className="team">{match.away}</span>
      </div>
      <div className="match-foot">
        <span>
          {new Date(match.kickoff_at).toLocaleString('es-PE')}
          {match.finished && <span className="ok"> · Resultado cargado</span>}
        </span>
        <span>
          {error && <span className="error">{error} </span>}
          <button disabled={home === '' || away === '' || !match.locked} onClick={save}>
            {match.finished ? 'Corregir' : 'Guardar resultado'}
          </button>
        </span>
      </div>
    </div>
  );
}

function Admin() {
  const empty = { home: '', away: '', stage: '', kickoff_at: '' };
  const [matches, setMatches] = useState([]);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api('/matches').then(setMatches).catch((failure) => setError(failure.message));
  }, []);

  useEffect(load, [load]);

  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  async function create(event) {
    event.preventDefault();
    setError('');
    try {
      await api('/matches', {
        method: 'POST',
        body: { ...form, kickoff_at: new Date(form.kickoff_at).toISOString() },
      });
      setForm(empty);
      load();
    } catch (failure) {
      setError(failure.message);
    }
  }

  return (
    <>
      <h1>Administración</h1>
      <p className="sub">Crea partidos y carga resultados. Los puntos se recalculan al guardar.</p>

      <h2>Nuevo partido</h2>
      <form className="card form" onSubmit={create}>
        <div className="row">
          <input placeholder="Local" aria-label="Local" value={form.home} onChange={update('home')} required />
          <input placeholder="Visitante" aria-label="Visitante" value={form.away} onChange={update('away')} required />
        </div>
        <div className="row">
          <input placeholder="Fase" aria-label="Fase" value={form.stage} onChange={update('stage')} />
          <input
            type="datetime-local"
            aria-label="Fecha y hora"
            value={form.kickoff_at}
            onChange={update('kickoff_at')}
            required
          />
        </div>
        {error && <p className="error">{error}</p>}
        <button>Crear partido</button>
      </form>

      <h2>Resultados</h2>
      {matches.map((match) => <ResultRow key={match.id} match={match} onSaved={load} />)}
    </>
  );
}

export default function AdminPage() {
  return <Shell>{() => <Admin />}</Shell>;
}

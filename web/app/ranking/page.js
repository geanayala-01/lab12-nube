'use client';

import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import Shell, { Ranking } from '../Shell';

function GlobalRanking({ myId }) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/ranking').then(setRows).catch((failure) => setError(failure.message));
  }, []);

  return (
    <>
      <h1>Ranking general</h1>
      <p className="sub">Todos los participantes y sus puntos acumulados.</p>
      {error && <p className="error">{error}</p>}
      <Ranking rows={rows} myId={myId} />
    </>
  );
}

export default function RankingPage() {
  return <Shell>{(session) => <GlobalRanking myId={session.user.id} />}</Shell>;
}

'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import Shell, { Ranking } from '../../Shell';

function Room({ myId }) {
  const { id } = useParams();
  const router = useRouter();
  const [room, setRoom] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api(`/rooms/${id}`).then(setRoom).catch((failure) => setError(failure.message));
  }, [id]);

  if (error) return <p className="error">{error}</p>;
  if (!room) return null;

  const isOwner = room.owner_id === myId;
  const inviteUrl = `${window.location.origin}/unirse/${room.invite_code}`;

  async function copy() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
  }

  async function leave() {
    const warning = isOwner
      ? 'Creaste esta sala: si sales, se elimina para todos. ¿Continuar?'
      : '¿Salir de esta sala?';
    if (!window.confirm(warning)) return;
    await api(`/rooms/${id}/members/me`, { method: 'DELETE' });
    router.push('/salas');
  }

  return (
    <>
      <h1>{room.name}</h1>
      <p className="sub">{room.ranking.length} participantes</p>

      <div className="card">
        <p style={{ marginTop: 0 }}>
          Código de invitación: <span className="code">{room.invite_code}</span>
        </p>
        <div className="row">
          <input readOnly value={inviteUrl} aria-label="Enlace de invitación" />
          <button onClick={copy}>{copied ? 'Copiado' : 'Copiar enlace'}</button>
        </div>
      </div>

      <h2>Tabla de la sala</h2>
      <Ranking rows={room.ranking} myId={myId} />

      <button className="ghost" onClick={leave}>{isOwner ? 'Eliminar sala' : 'Salir de la sala'}</button>
    </>
  );
}

export default function RoomPage() {
  return <Shell>{(session) => <Room myId={session.user.id} />}</Shell>;
}

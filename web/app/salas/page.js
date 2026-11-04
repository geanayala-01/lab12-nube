'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import Shell from '../Shell';

function Rooms() {
  const router = useRouter();
  const [rooms, setRooms] = useState([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api('/rooms').then(setRooms).catch((failure) => setError(failure.message));
  }, []);

  useEffect(load, [load]);

  async function submit(event, path, body) {
    event.preventDefault();
    setError('');
    try {
      const room = await api(path, { method: 'POST', body });
      router.push(`/salas/${room.id}`);
    } catch (failure) {
      setError(failure.message);
    }
  }

  return (
    <>
      <h1>Salas</h1>
      <p className="sub">Crea un grupo, invita a tus amigos y compitan en su propio ranking.</p>
      {error && <p className="error">{error}</p>}

      <div className="card">
        <form className="row" onSubmit={(event) => submit(event, '/rooms', { name })}>
          <input
            placeholder="Nombre de la sala"
            aria-label="Nombre de la sala"
            value={name}
            maxLength={60}
            onChange={(event) => setName(event.target.value)}
            required
          />
          <button>Crear sala</button>
        </form>
      </div>
      <div className="card">
        <form className="row" onSubmit={(event) => submit(event, '/rooms/join', { code })}>
          <input
            placeholder="Código de invitación"
            aria-label="Código de invitación"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            required
          />
          <button>Unirme</button>
        </form>
      </div>

      <h2>Mis salas</h2>
      {rooms.length === 0 && <p className="sub">Todavía no estás en ninguna sala.</p>}
      {rooms.map((room) => (
        <Link key={room.id} href={`/salas/${room.id}`} className="card room-link">
          <strong>{room.name}</strong>
          <span className="who">{room.members} {room.members === 1 ? 'participante' : 'participantes'}</span>
        </Link>
      ))}
    </>
  );
}

export default function RoomsPage() {
  return <Shell>{() => <Rooms />}</Shell>;
}

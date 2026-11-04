'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import Shell from '../../Shell';

function Join() {
  const { code } = useParams();
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    api('/rooms/join', { method: 'POST', body: { code } })
      .then((room) => router.replace(`/salas/${room.id}`))
      .catch((failure) => setError(failure.message));
  }, [code, router]);

  return error ? <p className="error">{error}</p> : <p className="sub">Uniéndote a la sala...</p>;
}

export default function JoinPage() {
  return <Shell>{() => <Join />}</Shell>;
}

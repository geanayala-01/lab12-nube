'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, getSession, saveSession } from '../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const destination = () => {
    const next = new URLSearchParams(window.location.search).get('next');
    return next?.startsWith('/') && !next.startsWith('//') ? next : '/partidos';
  };

  useEffect(() => {
    if (getSession()) router.replace(destination());
  }, [router]);

  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const path = mode === 'login' ? '/auth/login' : '/auth/register';
      saveSession(await api(path, { method: 'POST', body: form }));
      router.replace(destination());
    } catch (failure) {
      setError(failure.message);
      setBusy(false);
    }
  }

  return (
    <main>
      <div className="card login">
        <h1>Pronostica</h1>
        <p className="sub">Predice la Champions, suma puntos y compite en tus salas.</p>
        <div className="tabs">
          <button className={mode === 'login' ? undefined : 'ghost'} onClick={() => setMode('login')}>
            Ingresar
          </button>
          <button className={mode === 'register' ? undefined : 'ghost'} onClick={() => setMode('register')}>
            Crear cuenta
          </button>
        </div>
        <form className="form" onSubmit={submit}>
          {mode === 'register' && (
            <label>
              Nombre
              <input value={form.name} onChange={update('name')} required maxLength={60} />
            </label>
          )}
          <label>
            Correo
            <input type="email" value={form.email} onChange={update('email')} required />
          </label>
          <label>
            Contraseña
            <input type="password" value={form.password} onChange={update('password')} required minLength={6} />
          </label>
          {error && <p className="error">{error}</p>}
          <button disabled={busy}>{mode === 'login' ? 'Ingresar' : 'Crear cuenta'}</button>
        </form>
      </div>
      <p className="foot">Ejercicio educativo. No involucra dinero real.</p>
    </main>
  );
}

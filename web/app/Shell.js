'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clearSession, getSession } from '../lib/api';

export function Ranking({ rows, myId }) {
  return (
    <div className="card table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Participante</th>
            <th>Exactos</th>
            <th>Aciertos</th>
            <th>Racha</th>
            <th>Anticipada</th>
            <th>Puntos</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={row.id === myId ? 'me' : undefined}>
              <td>{row.position}</td>
              <td>{row.name}</td>
              <td>{row.exact_hits}</td>
              <td>{row.winner_hits}</td>
              <td>+{row.streak_points}</td>
              <td>+{row.early_points}</td>
              <td className="points">{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Shell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState(null);

  useEffect(() => {
    const current = getSession();
    if (!current) {
      router.replace(`/?next=${encodeURIComponent(pathname)}`);
      return;
    }
    setSession(current);
  }, [pathname, router]);

  if (!session) return null;

  const links = [
    ['/partidos', 'Partidos'],
    ['/salas', 'Salas'],
    ['/ranking', 'Ranking'],
    ...(session.user.isAdmin ? [['/admin', 'Admin']] : []),
  ];

  return (
    <>
      <header className="topbar">
        <Link className="brand" href="/partidos">Pronostica</Link>
        <nav className="nav">
          {links.map(([href, label]) => (
            <Link key={href} href={href} className={pathname.startsWith(href) ? 'active' : undefined}>
              {label}
            </Link>
          ))}
        </nav>
        <span className="who">{session.user.name}</span>
        <button
          className="ghost"
          onClick={() => {
            clearSession();
            router.replace('/');
          }}
        >
          Salir
        </button>
      </header>
      <main>{children(session)}</main>
      <p className="foot">Ejercicio educativo. No involucra dinero real.</p>
    </>
  );
}

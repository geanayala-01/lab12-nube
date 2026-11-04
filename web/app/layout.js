import './globals.css';

export const metadata = {
  title: 'Pronostica',
  description: 'Predice los partidos de la Champions con tus amigos. Ejercicio educativo, sin dinero real.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}

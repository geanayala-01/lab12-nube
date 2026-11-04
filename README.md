# Pronostica

Aplicación para predecir partidos de la UEFA Champions League y acumular puntos en salas privadas.
Ejercicio educativo: no involucra dinero real.

Laboratorio 12 de Desarrollo de Soluciones en la Nube (Tecsup). La guía plantea el Mundial; esta versión usa la jornada 4 de la Champions 2026/27.

## Cómo ejecutarla

Requiere Docker Desktop.

```bash
cp .env.example .env
```

Cambia las claves de `.env` y levanta todo:

```bash
docker compose up -d --build
```

Abre http://localhost:8080. El administrador es el correo y la clave `ADMIN_*` de `.env`.

## Servicios

| Servicio | Tecnología | Función |
|---|---|---|
| `nginx` | Nginx 1.28 | Balanceador y punto de entrada |
| `api` ×3 | Node.js, Express | Lógica y puntuación, sin estado |
| `web` | Next.js | Interfaz |
| `db` | PostgreSQL 17 | Datos |

## Funcionalidad

- Registro e ingreso con JWT.
- Predicción por partido, editable hasta el inicio.
- Salas con código y enlace de invitación, cada una con su tabla.
- Ranking general de participantes.
- Panel de admin para crear partidos y cargar o corregir resultados.

## Escalar

```bash
docker compose up -d --scale api=5 --no-recreate
```

Nginx detecta las réplicas nuevas sin reiniciarse. La cabecera `X-Served-By` muestra qué réplica respondió.

## Pruebas

Unitarias de puntuación:

```bash
cd api && npm install && npm test
```

Punta a punta, en un proyecto aparte porque crea datos de prueba:

```bash
set -a; . ./.env; set +a; HTTP_PORT=8081 docker compose -p pronostica-test up -d --build --wait
```

```bash
set -a; . ./.env; set +a; BASE_URL=http://localhost:8081 node tests/e2e.mjs
```

Estrés con k6, comparando 1 y 3 réplicas. También usa un proyecto aparte y lo elimina al terminar:

```bash
bash tests/run-stress.sh 1500
```

## Documentación

- [Arquitectura y reglas](docs/arquitectura.md)
- [Pruebas y resultados](docs/pruebas.md)

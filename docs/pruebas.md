# Pruebas realizadas

Ejecutadas el 4 de noviembre de 2026 en una Mac con Docker Desktop (10 CPU y 7.7 GB asignados).

## Unitarias de puntuación

`api/test/scoring.test.js`: 18 pruebas, 18 aprobadas. Cubren las cinco reglas, empates, el límite de 24 horas, cortes de racha y el modo no acumulable.

## Punta a punta

`tests/e2e.mjs` contra el stack completo, pasando por Nginx. Todas aprobadas:

| Caso | Resultado |
|---|---|
| Balanceo | 3 réplicas respondieron; 45 peticiones repartidas 15, 15 y 15 |
| Rutas sin token | 401 |
| Usuario normal administrando | 403 |
| Resultado antes del inicio | 409 |
| Predicción después del inicio | 409 |
| Marcador fuera de rango | 400 |
| Sala sin invitación | 404 |
| Unirse dos veces | No duplica al miembro |
| Puntajes de una sala | Ana 25 y Beto 10, como se calculó a mano |
| Corregir un resultado | El ranking se recalcula: Beto pasa a 20 y a primer lugar |
| Salir de la sala | La sala deja de ser visible |

## Estrés con k6

`tests/stress.js`. Cada usuario virtual consulta partidos, guarda una predicción, consulta el ranking y espera 0.5 s. La carga sube a 500 usuarios en 20 s, a 1500 en 30 s, se mantiene 30 s y baja en 10 s. Cada corrida usó una base de datos limpia.

Se hicieron tres corridas con 1500 usuarios pico, porque la latencia con 3 réplicas varió entre ellas. La corrida 2 tuvo `docker stats` y otras tareas activas en la misma Mac; la 3 corrió sin otras tareas.

| Corrida | Pet./s con 1 | Pet./s con 3 | p95 con 1 | p95 con 3 |
|---|---|---|---|---|
| 1 | 2437 | 5429 | 404.1 ms | 36.6 ms |
| 2 | 2416 | 4561 | 409.4 ms | 307.9 ms |
| 3 | 2367 | 5243 | 410.5 ms | 76.7 ms |

Ninguna corrida tuvo peticiones fallidas. Con 3 réplicas el sistema atendió entre 1.9 y 2.2 veces más peticiones por segundo. La latencia p95 siempre mejoró, pero entre 1.3 y 11 veces, así que la mejora en capacidad es el resultado más estable.

En la corrida 2, cada réplica llegó a su límite de CPU en el pico (unos 50 %), con 1 y con 3 réplicas. Con 3 réplicas, PostgreSQL llegó a unos 190 % de CPU.

A 300 usuarios pico no hubo diferencia real: ambas configuraciones rondaron 1100 peticiones por segundo con p95 de unos 7 ms, porque una sola réplica aún no se saturaba.

Datos crudos de las corridas 2 y 3: `docs/resultados/`. Los de la corrida 1 no se conservaron.

**Limitaciones:** k6, Nginx, las réplicas y PostgreSQL comparten la misma máquina, así que los números sirven para comparar configuraciones, no como capacidad absoluta. No se buscó el punto de quiebre de 3 réplicas: a 1500 usuarios no falló ninguna petición. El login y el registro no entran en la carga medida.

## Tolerancia a fallos y escalamiento

| Prueba | Resultado |
|---|---|
| `docker kill` de una réplica | 15 de 15 peticiones siguientes respondieron 200 |
| Reparto después de la caída | 6 y 6 entre las dos réplicas restantes |
| Escalar a 5 réplicas | 5 réplicas respondieron sin reiniciar Nginx |

La prueba de caída usó peticiones `GET` de salud. Una escritura en curso en la réplica caída podría fallar, porque Nginx no reintenta peticiones no idempotentes.

## Interfaz

Recorrida en Chrome como participantes y como admin: registro, ingreso fallido, predicciones, cierre, salas, enlace de invitación, código inválido, panel de admin, resultados y ranking. Los puntajes de la demostración coincidieron con el cálculo manual (36, 12 y 10). Los horarios se muestran en hora local. En 390 px de ancho, partidos y sala no tienen desplazamiento horizontal.

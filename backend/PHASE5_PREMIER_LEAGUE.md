# Fase 5 — categoría real: títulos de la Premier League

## 1. Elección y definición

La primera categoría real es `premier-league-club-titles`.

Mide exactamente el número de campeonatos oficiales de la Premier League
ganados por cada club desde 1992/93 hasta la última temporada completada,
2025/26. El valor es un entero no negativo y se cuenta una vez cada título de
la competición. No se cuentan títulos de First Division anteriores a 1992/93,
FA Cup, League Cup, Community Shield ni ningún otro trofeo.

El universo es cerrado: incluye exclusivamente los clubes que ganaron al
menos una edición de la Premier League. Por tanto, una lista completa tiene
siete entidades y no se aplica el umbral genérico de 100 entidades.

El ranking ordena `raw_value` de mayor a menor. `rank` usa posiciones de
competición: Chelsea queda 3, Arsenal 4, Liverpool 5 y Blackburn/Leicester
comparten la posición 6. `score_value` es el `rank` con el tope vigente de 100.
En el juego, como gana la puntuación menor, una respuesta con un club de mejor
posición produce menos puntos.

## 2. Universo e identidades

| ID canónico | Nombre | Etiqueta de la fuente | Títulos | Posición | Grupo |
|---|---|---:|---:|---:|---:|
| `pl:club:12` | Manchester United | Man Utd | 13 | 1 | 1 |
| `pl:club:11` | Manchester City | Man City | 8 | 2 | 2 |
| `pl:club:4` | Chelsea | Chelsea | 5 | 3 | 3 |
| `pl:club:1` | Arsenal | Arsenal | 4 | 4 | 4 |
| `pl:club:10` | Liverpool | Liverpool | 2 | 5 | 5 |
| `pl:club:blackburn-rovers` | Blackburn Rovers | Blackburn Rovers | 1 | 6 | 6 |
| `pl:club:leicester-city` | Leicester City | Leicester City | 1 | 6 | 6 |

Los nombres abreviados `Man Utd` y `Man City` se resuelven a los nombres
canónicos y tienen identificadores externos explícitos en
`entity_external_ids`. No se crean entidades distintas para el nombre corto,
la variante comercial o el nombre de estadio. La migración registra además
los aliases de esas dos abreviaturas; no hay duplicados sin resolver.

La fuente oficial enumera exactamente siete ganadores. El importador rechaza
si cambia el número, el orden o un nombre no reconocido; esto evita aceptar
silenciosamente una página cambiada o una entidad nueva no revisada.

## 3. Fuentes y fechas

Fuente principal, consultada el 2026-09-08 y conservada en el snapshot
`src_1340965fe94636501db88739`:

- Premier League, [Wall of Champions / Most Premier League titles](https://www.premierleague.com/en/news/4288492).

Contrastes consultados el 2026-09-09 y registrados como snapshots de revisión
metadata-only (no se usan como una segunda métrica ni se mezclan valores):

- Premier League, [Premier League explained](https://www.premierleague.com/en/premier-league-explained): contrasta los siete clubes ganadores y la lista por temporada.
- Premier League, [Club, Manager & Player Records](https://www.premierleague.com/en/stats/records): contrasta las 13 victorias de Manchester United y sus temporadas.

La cobertura de temporada se interpreta con la definición de la propia
competición. Fuentes que hablan de títulos de la máxima categoría inglesa en
general, como los 20 títulos totales de Liverpool, no se combinan porque
incluyen First Division anterior a 1992/93.

## 4. Snapshot, ranking y reto

El snapshot de ranking existente es:

- ID: `rs_9f4c50c701ef1aba9264e03e`.
- `data_version`: `premier-league-club-titles-2026-09-08`.
- Estado: `draft`.
- Cobertura: `coverage_complete=true`, 7/7 entradas, 0 conflictos.
- Algoritmo: `ranking-v1`.

La migración `029_phase5_premier_league_club_titles.sql` añade la definición
versionada (v2), registra fuentes y fechas de contraste, conserva el hash del
snapshot y materializa el reto local
`daily_2026-09-09_premier-league-club-titles` con sus siete items.

Ese reto está en `draft`. No se publica porque:

1. La fuente y la categoría siguen marcadas `review_required` en el ledger de
   derechos.
2. Los siete escudos disponibles son candidatos `pending`, con
   `rights_basis=unknown`, sin verificación comercial ni autorización de uso
   de marca.
3. El motor de la fase 2 y el contrato online de la fase 3 modelan la partida
   de asignación como una matriz cuadrada de categorías distintas y
   decisiones. Una sola categoría real produce un reto de ordenación de siete
   clubes, no una matriz 7×7. No se fabrican seis categorías ni se duplica la
   categoría para forzar una publicación. El reto se mantiene en el modelo
   `challenges` de una categoría hasta que producto defina/adopte el modo
   `ranking_order` en el contrato online.

La migración es idempotente. El comando operativo para regenerar el reto draft
desde el snapshot más reciente es:

```bash
cd backend
npm run challenge:daily:draft -- \
  --date 2026-09-09 \
  --category premier-league-club-titles
```

Genera todos los miembros del universo cerrado ordenados por posición y nunca
lo promueve a `published`. El comando publicado existente sigue protegido por
las comprobaciones de snapshot, categoría, derechos e imágenes.

## 5. Derechos de imágenes y publicación

No se ha reutilizado ningún escudo como si tuviera licencia. La auditoría de
los siete clubes devuelve activos candidatos `pending` o `rejected`, con base
de derechos `unknown`. El dato futbolístico puede estar completo y aun así el
producto no estar autorizado para distribuir insignias.

Antes de publicar se requiere, por cada club, un activo primario `badge` con
licencia o permiso comercial documentado, evidencia URL, alcance de uso,
revisión registrada y `trademark_status=cleared`. Hasta entonces, el estado
final correcto del snapshot y del reto es `draft`.

## 6. Prueba

Prueba de datos y ranking sin red:

```bash
cd backend
npm test
npm run build
```

Con PostgreSQL local y las migraciones aplicadas:

```bash
npm run challenge:daily:draft -- \
  --date 2026-09-09 \
  --category premier-league-club-titles

docker exec backend-postgres-1 psql -U rango90 -d rango90 -c \
  "SELECT c.id, c.status, COUNT(ci.*) AS items
     FROM challenges c
     LEFT JOIN challenge_items ci ON ci.challenge_id = c.id
    WHERE c.id = 'daily_2026-09-09_premier-league-club-titles'
    GROUP BY c.id, c.status;"
```

El contrato online solo sirve retos `game_challenges` publicados, así que este
reto draft no aparece todavía en `GET /v1/challenges/daily`. La pantalla puede
probarse contra el contrato con un fixture publicado de fase 3; para hacer
jugable esta categoría desde la pantalla actual habrá que acordar primero la
extensión de contrato para `ranking_order` y luego publicar tras cerrar
derechos. No se modifica el frontend en esta fase.

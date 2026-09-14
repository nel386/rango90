# Candidato de producción 1 — UEFA Champions League, goles

Estado de cierre: **datos cerrados en `draft`; no publicable todavía**.

## Definición

`uefa-champions-league-goals` mide los goles de cada jugador en la tabla
histórica de goleadores de la Copa de Europa / UEFA Champions League desde
1955/56. El corte de fuente es la primera 200 filas reales. No se mezclan
clasificación previa, amistosos, ceros inferidos ni jugadores inventados.

La fuente conserva su posición original `sourceRank` 1–200. `ranking-v1`
calcula la posición competitiva: el mismo valor comparte `rank` y `tieGroup`,
y la posición siguiente salta el tamaño del empate. En este corte hay 200
entidades, 200 IDs externos únicos y la última posición competitiva es 195.

## Fuentes y evidencia

- Principal: [Transfermarkt — goleadores históricos](https://www.transfermarkt.com/champions-league/ewigetorschuetzenliste/pokalwettbewerb/CL/land_id/0/plus/0/galerie/0), snapshot `src_3d13003e2422e688ca3380ae`.
- Contraste oficial: [UEFA — Top goalscorers](https://www.uefa.com/uefachampionsleague/history/rankings/players/goals_scored/), snapshot `src_c9359c9f91bba9215af8fef6`, 100 filas.
- Contraste adicional: API-Football, snapshot `src_9f045034874eed9a0badd298`, ventana parcial 2000–2026; no completa el histórico.

El contraste UEFA encuentra conservadoramente 24 nombres coincidentes; 12
valores coinciden y 12 discrepan. El detalle inmutable está en
[`data/evidence/uefa-champions-league-goals-2026-09-12/official-contrast.json`](data/evidence/uefa-champions-league-goals-2026-09-12/official-contrast.json).
No se mezclan los valores ni se ocultan las discrepancias.

## Artefactos y snapshot

- Input reproducible de 200 filas:
  [`data/production/uefa-champions-league-goals-2026-09-12.json`](data/production/uefa-champions-league-goals-2026-09-12.json)
- Manifest de identidades:
  [`data/evidence/uefa-champions-league-goals-2026-09-12/identities.json`](data/evidence/uefa-champions-league-goals-2026-09-12/identities.json)
- Snapshot de ranking generado en PostgreSQL: `rs_870f1dff967bb160f2d132cc`.
- Snapshot de fuente generado en PostgreSQL: `src_257235808020fc330123b522`.
- Hash completo del snapshot de ranking:
  `870f1dff967bb160f2d132cc7d9ca1f2483b26d32681e6a55985efc744cc718b`.

La cobertura de datos es `coverage_complete=true`, `eligible_count=200`,
`unresolved_conflicts=12`, porque el contraste oficial conserva 12 diferencias
de valor. Esto bloquea la aprobación además de los derechos.

## Identidad y separación histórica

El manifest mantiene los 200 IDs de Transfermarkt como registros canónicos de
fuente cuando no existe un enlace cruzado exacto y revisado. La última pasada
del consolidator produjo `linked=0`, `conflicts=0`, `skipped=57`; no se aplican
fusiones por apellido ni heurísticas. La tabla histórica mantiene los jugadores
retirados para auditoría. `entity_game_profiles.playable_default` y
`entities.catalog_status` siguen siendo la autoridad del pool moderno; importar
este ranking no reactiva jugadores históricos.

En la auditoría local del 2026-09-13, 80/200 filas son jugables por la política
moderna y 77/80 tienen retrato legal publicable. El borrador de reto filtra
`catalog_status='active'` y `playable_default=true`, de forma que los
históricos excluidos no entran accidentalmente.

## Derechos, imágenes y reto

Los derechos del dato principal siguen `review_required`; no hay licencia de
redistribución comercial concedida en el expediente. Las imágenes del
proveedor no reciben derechos por estar enlazadas. Los retratos Commons son
una cola opcional independiente y solo se pueden publicar con licencia o
permiso, alcance comercial, atribución y revisión registrados. Si falta una
imagen, se puede usar un avatar propio de Rango 90, claramente no fotográfico
y no equivalente a un escudo, mientras se resuelve el medio.

No se publica el ranking ni el reto. El motor online actual exige una matriz
cuadrada de categorías y decisiones; con una sola categoría real no se duplica
la columna para fabricar un reto multicategoría. Esta categoría puede ser una
columna válida de un reto futuro cuando exista otra categoría real compatible,
se resuelvan las 12 discrepancias y se aprueben los derechos.

El borrador local `daily_2026-09-13_uefa-champions-league-goals` contiene 80
entidades activas y jugables y excluye los históricos. Su compatibilidad futura
con el motor está registrada en
[`data/evidence/uefa-champions-league-goals-2026-09-12/challenge-compatibility.json`](data/evidence/uefa-champions-league-goals-2026-09-12/challenge-compatibility.json).

Validación:

```bash
cd backend
npm run validate:production:champions-goals
npm run audit:data-readiness -- --category uefa-champions-league-goals
```

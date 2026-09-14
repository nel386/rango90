# Evidencia — UEFA Champions League, goles históricos

La categoría candidata es `uefa-champions-league-goals`. El valor publicado en
el corte de datos es el total de goles de la tabla histórica de Transfermarkt
para Copa de Europa / UEFA Champions League desde 1955/56, con clasificación y
eliminatorias de clasificación fuera del alcance declarado por la fuente. Se
conservan las primeras 200 filas reales: no se agregan jugadores a cero, filas
de relleno ni nombres de otra competición.

La fuente principal está archivada como `src_3d13003e2422e688ca3380ae` y su
entrada reproducible está en
`data/production/uefa-champions-league-goals-2026-09-12.json`. La posición de
fuente es la fila original 1–200. La posición de Rango 90 se calcula con
`ranking-v1`: valores iguales comparten `rank` y `tieGroup`, y el siguiente
valor salta las posiciones ocupadas por el empate.

## Contraste

UEFA publica una tabla oficial de 100 filas en
`src_c9359c9f91bba9215af8fef6`, pero no un corte público equivalente de 200 en
el snapshot auditado. El contraste conservador por nombre encuentra 24 pares;
12 tienen el mismo valor y 12 discrepan. El detalle está en
[`official-contrast.json`](official-contrast.json). No se mezclan los valores,
por lo que el resultado se mantiene en `draft` hasta resolver la diferencia de
corte/metodología.

API-Football queda como tercer contraste histórico parcial (`src_9f045034874eed9a0badd298`): sus datos empiezan en 2000 y no cubren la era completa de la categoría. No se usa para completar las 200 filas.

## Identidad y audiencia

Cada fila tiene `entityId` estable del proveedor y URL de perfil. La
consolidación automática por nombre exacto no produjo enlaces nuevos en el
último pase (`linked=0`, `conflicts=0`, `skipped=57`); los 200 IDs siguen siendo
únicos en el snapshot y no se fusionan homónimos. La ausencia de un enlace no
convierte un jugador histórico en jugable: el perfil global
`entity_game_profiles.playable_default` sigue gobernando el pool moderno. Los
jugadores históricos se conservan en el ranking y en la auditoría, pero no se
reactivan por importar este snapshot.

## Derechos y medios

El dato de Transfermarkt permanece `review_required`; no existe en este
expediente una licencia de redistribución comercial concedida a Rango 90. Las
URLs de imagen del proveedor no se consideran licencia. Los retratos de
Wikimedia Commons son una cola independiente: solo un archivo con identidad,
licencia abierta o permiso escrito, alcance comercial, atribución cuando
corresponda y revisión registrada puede convertirse en principal publicable.
Si falta retrato, la alternativa segura es un avatar propio de Rango 90 que no
imite una fotografía o un logo; no se usa para ocultar el bloqueo de derechos
del dato.

## Estado

El validador `npm run validate:production:champions-goals` confirma 200/200
filas, IDs externos únicos, valores positivos y ausencia de filas artificiales.
La categoría y el snapshot no deben promoverse a `approved`/`published` hasta
resolver las 12 discrepancias y documentar el derecho de redistribución de la
fuente principal. El comando `challenge:daily:draft` solo materializa las
entidades activas y `playable_default=true`; así no intenta reintroducir los
históricos excluidos. Ese borrador no es un reto online publicable: el contrato
actual exige una matriz cuadrada de categorías y decisiones. Una futura
categoría adicional deberá ser real, independiente y apta para el mismo
contrato; no se duplica esta categoría para forzar el reto. El detalle está en
[`challenge-compatibility.json`](challenge-compatibility.json).

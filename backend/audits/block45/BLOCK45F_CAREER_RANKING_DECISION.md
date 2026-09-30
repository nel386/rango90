# BLOQUE 45F — decisión técnica sin gasto de cuota

**Decisión: NO-GO para ranking de carrera global y para reanudar la tanda actual.** Revisión del código y artefactos locales del checkpoint `36574961077`; cero llamadas al proveedor. No se ejecutaron `load`, imports, escrituras PostgreSQL ni snapshots. El manifiesto/checkpoint y sus validadores no se modificaron.

## 1. Coste de expansión 2010–2026

El manifiesto auditado conserva 85/85 combinaciones de cinco ligas por 17 temporadas (2010–2026), 11.034 jugadores elegibles y 15.353 pares con estado terminal. El plan actual construye el producto cartesiano completo:

| Escenario | Pares totales | Ya resueltos | Consultas pendientes |
|---|---:|---:|---:|
| Código actual: cada jugador × 17 temporadas | 187.578 | 15.353 | **172.225** |
| Solo temporadas con fila positiva en la base de las cinco ligas | 52.476 | 5.410 coinciden con cobertura de expansión | **47.066** |

El segundo escenario ahorraría 125.159 consultas frente al plan actual, pero solo es un límite acotado a temporadas con actividad demostrada en las cinco ligas. No identifica temporadas en otras competiciones ni antes de 2010. La ausencia de una fila en la base de esas ligas no prueba que el jugador no estuviera activo en otra competición. No debe sustituir a un historial de carrera completo.

Para descubrir temporadas sin llamadas especulativas, `/players/teams` permitiría obtener actividad por jugador; sin embargo, los artefactos locales solo contienen una muestra histórica de 200/11.034, no el inventario completo necesario para calcular un coste exacto.

## 2. Campos de tarjetas

Los hechos guardados del checkpoint solo contienen `yellowCards`. No conservan `cards.red` ni `cards.yellowred`; por tanto, esas categorías no se pueden reconstruir para las 15.353 consultas ya procesadas sin las respuestas originales. No se volverán a consultar en esta tarea.

Para futuras respuestas, `factFromStats` conserva tres campos independientes: `yellowCards`, `redCards` (API `cards.red`) y `yellowRedCards` (API `cards.yellowred`, expulsión por segunda amarilla). Un valor ausente permanece `null`; no se convierte en cero ni se suma `yellowred` a `red`. Las filas con amarillas desconocidas pero roja conocida se conservan como hechos de tarjetas, pero no crean elegibilidad ni suman al ranking amarillo. La migración aditiva 095 persiste las dos categorías rojas.

La evidencia `competitionAttribution` se guarda completa dentro de `evidence` y se recupera al leer filas: referencia independiente, artefacto, IDs de atribución, hash del informe y hash de la respuesta auditada. La prueba de ida y vuelta confirma todos esos campos. La misma prueba cargó 093–094, insertó una fila legada, ejecutó 095 y leyó ambas filas en PostgreSQL efímera; no se tocó ninguna base real.

API-Football muestra `cards.yellow`, `cards.red` y `cards.yellowred` en su ejemplo oficial de estadísticas de jugador [guía oficial de API-Football](https://www.api-football.com/news/post/how-to-get-all-teams-and-players-from-a-league-id).

## 3. Cobertura anterior a 2010

La base empieza en 2010. El índice guardado tiene 22 pares candidato jugador-temporada anteriores a 2010; en 17 no consta revisión de `errors`, así que siguen fuera. No se generaliza `league.id=0`. La auditoría exacta mantiene **cuatro hechos amarillos** admitibles: Ramos 2007/08 (14), Parejo 2009/10 (6) y Ribéry 2007/08 (2) y 2009/10 (1). Los casos restantes están unresolved, sin probar o con ID nulo. Esos cuatro hechos tampoco demuestran cobertura global por liga/temporada. No hay hechos rojos históricos validados en los artefactos revisados.

## 4. Coste histórico y hechos admisibles

No existe un total defendible de peticiones para pre-2010 porque no está guardado el historial completo de temporadas de los 11.034 jugadores. El cálculo correcto es:

`11.034 consultas /players/teams + H consultas /players?id&season`

`H` es el número de pares únicos elegibles jugador-temporada anteriores a 2010 que devuelva el historial completo, descontando solo respuestas históricas ya verificadas y reutilizables. `H` no se puede calcular con la muestra existente. Como trabajo conocido pendiente, hay 17 pares con el campo `errors` sin evidencia de revisión; sus resúmenes no bastan para validar respuesta y exigirían recuperar evidencia válida. Así, **11.051 llamadas es solo el suelo de descubrimiento más esas 17 comprobaciones conocidas**, no el coste de completar la carrera; el total será `11.034 + H` y será mayor al incluir todas las temporadas históricas descubiertas.

Hechos históricos que pueden admitirse hoy con el criterio exacto: **4 amarillos**. No se admite ninguna fila adicional de ID cero por extrapolación y no hay rojas históricas validadas.

## 5. Veredicto

**NO-GO: con la evidencia disponible, API-Football solo sustenta un ranking parcial.** La expansión actual aún deja 172.225 llamadas en 2010–2026; acabarla no cubre pre-2010. El endpoint de historial ofrece una ruta para estimar temporadas, pero falta descargar y validar el inventario completo y probar estadística de tarjetas/cobertura histórica en cada competición y época. Para un ranking global defendible haría falta otra fuente con estadísticas históricas de tarjetas por jugador, temporada, equipo y competición, con identidad y cobertura verificables, para los casos que API-Football no clasifica o no devuelve. Hasta entonces, no usar etiqueta de carrera global, `load`, imports ni snapshots.

## Checks

- `npm run test:block45:card-types`: passed.
- `npm run test:block45:legacy-zero`: passed.
- `npm run test:block45:persistence` sobre PostgreSQL efímera: passed; comprobó fila anterior a 095, migración 095 y round-trip de atribución.
- `npx tsx src/tests/club-yellow-cards-career-ranking-engine.test.ts`: passed.
- `npx tsx src/tests/block45-provider-filter.test.ts`: passed.
- `npm run build`: passed (`tsc -p tsconfig.json`).
- `git diff --check`: passed.
- Revalidación local del checkpoint: `coverageHash`, `factsHash` y `manifestHash` coinciden; 85 combinaciones y prefijo de peticiones del padre confirmados en el artefacto del run.

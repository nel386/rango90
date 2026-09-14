# Investigación de fuente: goles globales de carrera

Fecha de comprobación: 2026-09-12.

## Resultado

No se ha encontrado una fuente que permita importar de forma responsable un top 200 de goles globales de carrera. Por tanto, este trabajo no modifica PostgreSQL ni sustituye el snapshot provisional existente de `club-career-goals`.

La condición de entrada fijada para una futura fuente es simultánea: 200 jugadores únicos, una definición única y documentada para todas las filas, identidad/procedencia reconciliable y permiso de redistribución para un juego comercial.

## Candidatos descartados

- **StrikerDuel**: es el candidato mejor definido y ofrece una licencia anual bajo petición. Sin embargo, declara 134 jugadores perfilados y publica un ranking de top 50. No alcanza el mínimo.
- **SportBaseline**: etiqueta el dato como goles sénior de club y selección, pero solo expone top 50 y no publica una licencia de redistribución localizada.
- **RSSSF**: su bloque amplio mezcla ligas regionales, reservas, amateur y distintos tipos de selecciones; el bloque top-level es preliminar y ninguno alcanza 200 filas.
- **IFFHS**: sirve como referencia top-level con un umbral de inclusión, no como export exhaustivo de 200 jugadores ni como licencia de redistribución para Rango 90.
- **salimt/football-datasets**: tiene muchas filas de rendimiento, pero no publica el ranking objetivo ni una licencia verificable; además declara datos procedentes de Transfermarkt.
- **football.db**: sí es dominio público, pero ofrece resultados/partidos y no una tabla exhaustiva de carrera de jugadores.

Los detalles, URLs, definición, licencia, recuentos y estados están en el JSON adyacente. El validador `backend/src/tools/validate-global-career-goals-source-review.ts` comprueba que el expediente no declare una fuente utilizable por debajo de 200 filas o sin derechos.

## Regla de no mezcla

No se han combinado RSSSF, IFFHS, SportBaseline, StrikerDuel ni datasets abiertos. Tampoco se ha usado API-Football en esta investigación.

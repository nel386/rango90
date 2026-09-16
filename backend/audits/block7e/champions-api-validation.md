# BLOQUE 7E — Validación real de API-Football para Champions League

> Auditoría técnica y documental. No es aprobación de datos ni de derechos. No modifica PostgreSQL, snapshots, fuentes, derechos, retos o imágenes.

- fecha: `2026-09-16`
- estado: **integration_pending**
- peticiones: **0**
- huella: `45192ce0dac078a56b05361eb722a6d4d2d8c51da6f0c396bfc22868529a6810`
- readyForApproval: **false**

## Resultado

API_FOOTBALL_KEY no está presente; no se ejecutaron llamadas de red.

## Credencial y proveedor

- Credencial: `API_FOOTBALL_KEY`; presente: **false**; persistida: **false**; impresa: **false**.
- Proveedor: **API-Football / API-Sports**.
- Plan: **not_verified**. El plan solo puede verificarse con el dashboard o contrato de la cuenta; la API key no se persiste ni revela el plan contractual.

## Consultas realizadas

| Endpoint | HTTP | OK | Resultados | Errores | Temporadas | Límite diario | Restantes | Límite/min | Restantes/min |
| --- | ---: | :---: | ---: | ---: | --- | ---: | ---: | ---: | ---: |

No se guardaron respuestas crudas; cada consulta conserva solo estado, conteos, límites, muestra mínima y huella sanitizada.

## Cobertura y reconstrucción

- Temporadas observadas: **ninguna**.
- Ventana v2: **not_run**.
- Goleadores: **not_run**.
- Ranking histórico completo: **not_run**.
- El endpoint de top scorers devuelve una lista limitada por temporada; esta prueba de bajo consumo no demuestra una reconstrucción acumulada completa desde 1955/56.

## Jugadores y valores observados

## Derechos y restricciones

- Evidencia terms: [fuente oficial](https://www.api-football.com/terms).
- Evidencia pricing: [fuente oficial](https://www.api-football.com/pricing).
- Evidencia rate_limits: [fuente oficial](https://www.api-football.com/news/post/how-ratelimit-works).
- Evidencia leagues_endpoint: [fuente oficial](https://www.api-football.com/documentation-v3#tag/Leagues/operation/get-leagues).
- Evidencia top_scorers_endpoint: [fuente oficial](https://www.api-football.com/documentation-v3#tag/Players/operation/get-players-topscorers).
- Almacenamiento: los términos públicos deben leerse junto con el contrato y no sustituyen la autorización de los titulares de la competición.
- Rankings derivados: **no autorizados** con la evidencia disponible.
- Atribución: pendiente de confirmación contractual.
- Restricciones comerciales: API-Football no concede por sí sola derechos comerciales de competiciones de terceros.
- Imágenes/logos: no consultados; el acceso a la API no demuestra derechos de publicación.

## Comparación con baseline

- Snapshot de comparación: `rs_870f1dff967bb160f2d132cc`, content_sha256 `870f1dff967bb160f2d132cc7d9ca1f2483b26d32681e6a55985efc744cc718b`.
- Comparación solo de diferencias; no se sustituyen valores ni se crea un snapshot.

## Puerta

| Condición | Estado |
| --- | --- |
| Credencial válida y consulta limitada | **integration_pending** |
| Cobertura completa 1955/56–corte v2 | **not_run** |
| Reconstrucción histórica completa | **not_run** |
| Derechos de almacenamiento/publicación derivados | **bloqueado** |
| Snapshot candidato | **no creado** |
| Importación o mutación | **0** |

Decisión: mantener Champions bloqueada. Para avanzar se necesita evidencia del plan/contrato, cobertura histórica completa y autorización expresa para almacenar y publicar el ranking derivado; la clave por sí sola no satisface esos requisitos.

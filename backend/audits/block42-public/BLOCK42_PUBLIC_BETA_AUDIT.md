# BLOQUE 42 — auditoría pública beta/lab

Fecha: 2026-09-21 UTC  
Commit desplegado: `4f062f6b832d5c9e5eb5e3d9a1118bdca8f3c1cf`

## Infraestructura

- Render: servicio existente `https://rango90.onrender.com`.
- GitHub Pages: `https://nel386.github.io/rango90/`.
- Base de datos: `RANGO90_DATABASE_URL` existente; no se creó otra base.
- Runtime técnico reportado: `official`.
- Producto: beta/lab único; el runtime técnico no bloquea el reto ni los rankings.
- API-Football durante la carga: 0 peticiones.
- Imágenes, derechos y snapshots oficiales: sin cambios.

## Carga materializada

Workflow: [materialize-beta-audited, run 35628007607](https://github.com/nel386/rango90/actions/runs/35628007607) — `success`.

| Datos | Antes | Después | Resultado |
|---|---:|---:|---|
| Champions hechos | 20.992 | 20.992 | preservados/idempotentes |
| Mundial hechos | 5.748 | 5.748 | preservados/idempotentes |
| Asistencias hechos | 0 | 230 | provisional activo |
| Tarjetas hechos | 0 | 1.247 | alcance observado |
| Snapshots oficiales publicados | 0 | 0 | bloqueados |

La segunda carga produjo 0 hechos nuevos, 0 conflictos y rollback de fixture verificado. El manifiesto indica `officialSnapshotsCreated=false`, `imagesTouched=false`, `rightsChanged=false` y `apiFootballRequests=0`.

Goles de clubes no se activaron: su artefacto verificado tenía conflictos de idempotencia; el endpoint conserva `ranking_not_available`.

## Huellas de artefactos

```text
a16a2f4a12ca6aa3ce8a43b39c621fe0cd71d5e0d52ea8756e8317e8814b64f6  BLOCK17_FACTS_AFTER.json
03cb81278c86411b7539a1b237457b73fea51cf87aa4c07e9c437ca5b4be9a21  BLOCK17_HISTORICAL_SNAPSHOT_CANDIDATE.json
d6cc5fb17b266a498fd07d84ae20b2569b3f61cae03f5a87447be310a1bbcf41  BLOCK17_WEEKLY_SNAPSHOT_CANDIDATE.json
49d5201d13b51eeec3e91bdbbbc7775f67e744ad9529bb5d3821a56eab5aaec4  BLOCK20_FACTS.json
8ae7c3fa06b156f395d4fa5d03a7a7646facc44e77f4957dc2cf28645c8a5be0  BLOCK20_SNAPSHOTS.json
89a4be86f6abd9db8c61d6548389715cb9825a46f1909aed62e423d691550f40  BLOCK27_FACTS_AFTER.json
52ee01f270bf591e5d3fe809c4ebe9585a899dce8f923ca7324ef1a7b2bca32  BLOCK27_ACTIVE_SNAPSHOT_CANDIDATE.json
6abbcf01aa003f1fe27bfce4651877e91c8581ff6e3f31e7fc0c4b96b2a57770  BLOCK31_FACTS_AFTER.json
57dcaac127998bb94e1d98c5015dcb6c120222b581a89e38e72322e9d1250638  BLOCK31_YELLOW_SNAPSHOT_CANDIDATE.json
79b2d63042126eb0c5c2eb5ebc785f1e02ff2821bec39dc6a2d34a4fc6c7026b  BLOCK31_RED_SNAPSHOT_CANDIDATE.json
```

## Endpoints públicos

- `GET /health`: **200**.
- `GET /v1/config`: **200**.
- `GET /v1/challenges/daily`: **200**, `provisionalData=true`, 5 decisiones.
- `POST /v1/games`: **201**, sesión jugable.
- Respuesta correcta: **200**, categoría elegida coincide con `bestCategorySlug`.
- Respuesta alternativa: **200**, `selectedRank=null` y mejor categoría explícita.
- Timeout real: **200**, `accepted=true`, `timedOut=true` después de 90 s.
- Error de red/reintento en navegador: **passed**, el primer request falla y “Reintentar carga” recupera el inicio.
- Abandono en navegador: **passed**, muestra `PARTIDA ABANDONADA` con reinicio/vuelta al inicio.
- `official_not_ready`: **0** respuestas públicas observadas.
- Históricos incompletos: `ranking_not_available`, sin tabla vacía ni ceros ficticios.

Rankings públicos con datos:

- Champions goles: 204 entradas.
- Mundial goles: 307 entradas.
- Champions asistencias activa: 42 entradas, provisional.
- Tarjetas amarillas: 350 entradas, provisional, 3/6 competiciones completas.
- Tarjetas rojas: 19 entradas, provisional, 3/6 competiciones completas.
- Goles de clubes histórico: `404 ranking_not_available`.
- Asistencias históricas: `404 ranking_not_available`.
- Competición de tarjetas pendiente por cuota: `quota_insufficient` y `snapshot_preserved`.

## Capturas reales

- [Móvil — inicio](mobile-home.png)
- [Móvil — reto](mobile-game.png)
- [Móvil — feedback](mobile-feedback.png)
- [Escritorio — inicio](desktop-home.png)
- [Escritorio — reto](desktop-game.png)

Los avisos de provisionalidad permanecen visibles. El reto muestra cinco categorías auditadas; títulos y goles de carrera sin datos no se presentan como disponibles.

## Despliegues

- Render: [run 35632038602](https://github.com/nel386/rango90/actions/runs/35632038602) — `success`.
- GitHub Pages: [run 35632031269](https://github.com/nel386/rango90/actions/runs/35632031269) — `success`.
- Materialización: [run 35628007607](https://github.com/nel386/rango90/actions/runs/35628007607) — `success`.


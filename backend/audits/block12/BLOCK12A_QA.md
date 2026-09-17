# BLOQUE 12A — QA móvil aislado

Este bloque añade un workflow manual, sin conexión a producción:

```text
.github/workflows/block12a-qa.yml
```

El workflow crea un contenedor PostgreSQL temporal en `127.0.0.1:55432`, aplica
migraciones, inserta fixtures con prefijo `block12-qa-${GITHUB_RUN_ID}`, levanta
el backend dos veces (`lab` y `official`) y sirve el frontend estático contra ese
backend. Al terminar elimina las fixtures y el contenedor con `if: always()`.
No usa `DATABASE_URL` real, Render, snapshots publicables ni derechos.

## Evidencia generada

Cada ejecución publica un artefacto `block12a-qa-evidence-*` con:

- `qa-report-lab.json` y `qa-report-official.json`, con `passed`, `failed` o
  `not_run` por pantalla;
- capturas PNG en viewport móvil `390 × 844`;
- trazas Playwright, respuestas de `/v1/*`, consola y red;
- logs de backend/frontend, health check, respuesta oficial y limpieza.

El workflow falla si falta una pantalla esperada o queda en `failed`/`not_run`.
Una dependencia ausente no se convierte en un resultado positivo.

## Flujos cubiertos

En laboratorio se capturan carga inicial, reto activo, respuesta correcta,
respuesta incorrecta con categoría correcta, avance y precarga, abandono,
reinicio, respuestas antiguas, timeout, error de red, ranking histórico y
separación entre filas históricas y jugadores jugables. En oficial se captura
`official_not_ready` y se comprueba que no aparecen el fallback del laboratorio,
`Modo laboratorio` ni `Datos provisionales`.

La fixture contiene siete jugadores jugables y una entidad únicamente histórica.
No contiene fuentes oficiales, derechos ni assets de imagen aprobados; las
imágenes del laboratorio usan exclusivamente el fallback determinista del API.

## Comprobación local previa

La comprobación local de API se ejecutó contra un PostgreSQL efímero y confirmó:

```text
seed de fixture: passed
reto lab: HTTP 200
reto official: HTTP 503 official_not_ready
contenedor efímero: eliminado al finalizar
```

La auditoría visual reproducible se considera cerrada únicamente cuando el
workflow manual termine en GitHub Actions y el artefacto contenga las capturas
reales. La publicación oficial sigue bloqueada por la ausencia de una fuente
autorizada, independientemente de este QA.

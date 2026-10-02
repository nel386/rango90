# BLOQUE 45H — Contrato del endpoint y propuesta de snapshot activo

Estado: **contrato corregido en el árbol local; propuesta preparada y no aplicada**. No se hicieron escrituras en PostgreSQL, despliegues a Render, llamadas nuevas a API-Football ni snapshots.

## Estado público comprobado

Consulta de solo lectura al endpoint público el 2 de octubre de 2026:

- Endpoint: `https://rango90.onrender.com/v1/rankings/club-career-yellow-cards?limit=200&dataset=active_season_weekly&competition=complete_scope`
- La respuesta todavía dice `Tarjetas amarillas globales en clubes — alcance observado` / `Global club yellow cards — observed scope`.
- Snapshot: `club-cards-yellow-snapshot-a17ece340d31a31960c00624c9078866`, generado el `2026-09-21T16:58:04.505Z`, 1.247 hechos y 350 filas devueltas.
- Alcance declarado en el cuerpo: temporada 2026; Premier League (39), La Liga (140) y Serie A (135) incluidas; Bundesliga (78), Ligue 1 (61) y Primeira Liga (94) fuera. Por tanto, no es una carrera global.
- Marcos Alonso aparece en puesto 19 con 2 amarillas.
- La vista publicada ya presenta el alcance como temporada observada, pero el API remoto aún conserva la etiqueta heredada. La vista utiliza el snapshot del API; no puede corregir su antigüedad ocultando la etiqueta.

El API público y la pantalla comparten actualmente snapshot, corte y alcance observado, pero **no la etiqueta**: la app la normaliza y el API no. El ranking del checkpoint verificado cambia a Marcos Alonso del puesto 19 al 31 con las mismas 2 amarillas.

## Contrato preparado en código

El endpoint de ranking y el catálogo ahora definen la categoría como `Tarjetas amarillas — temporada activa (alcance observado)` / `Yellow cards — active season (observed scope)`, con `scopeKind: club_active_season_observed`. La respuesta del ranking incluye `scopeDescriptor` con temporada, filtro, IDs incluidos/excluidos y `careerComplete: false`. La pantalla conserva y presenta el alcance, el `snapshotId` y `generatedAt` recibidos del endpoint.

Una prueba Fastify compara etiqueta, tipo de alcance, competiciones, snapshot y fecha entre `/v1/rankings/catalog` y `/v1/rankings/club-career-yellow-cards`. Otra prueba del repositorio verifica que esos mismos valores se conservan para la pantalla.

Esta corrección sigue sin estar desplegada: el API remoto continuará desalineado hasta que se autorice y publique el backend. El despliegue de Render queda retenido porque el `prestart` del servicio ejecuta migraciones; no se inicia sin autorización de escritura real.

## Snapshot candidato derivado del checkpoint 36574961077

El manifiesto, cobertura y hechos descargados del run verifican estos identificadores:

- Commit de origen: `73f2365eb84cbe23963ae882ec57a0721f149fdc`
- `manifestHash`: `b0ffddc63e0a0d71687642c743d3bb6358f912380040c58a8f9e0ee751caee16`
- `coverageHash`: `1437e95cc0450e2f78556b54b71ed20dad6ba999edc8f23c7a852f99193bc17e`
- `factsHash`: `119c843e9233aa74b1a34e34eb9f11cfd791b766c9831ed35a41aa3009df6dc2`
- Temporada 2026, 85/85 combinaciones base completas. En el alcance del snapshot activo `complete_scope`, las tres ligas tienen todas las páginas esperadas: Premier League 26/26 (511 hechos), La Liga 29/29 (573) y Serie A 30/30 (608). Las otras tres ligas siguen excluidas.

### Cambios propuestos en producción

La propuesta JSON enlazada abajo detalla cada hecho por clave de origen, evidencia, hash de respuesta e IDs. Totales exactos del artefacto:

| Cambio de hechos amarillos | Filas |
| --- | ---: |
| Conservar registro o añadir revisión de evidencia | 1.165 |
| Revisar valor amarillo | 82 |
| Insertar nuevo registro | 445 |
| Total del checkpoint | 1.692 |

Las 82 revisiones corresponden a valores amarillos cambiados entre los 1.247 registros solapados con el artefacto anterior. Los 445 registros nuevos deben llevar campos de tarjetas rojas en `NULL`/desconocido; no se les asignarán ceros. Para los registros anteriores deben preservarse los valores e identidad de tarjetas rojas. No se mezclan tipos de tarjeta.

El snapshot candidato tendría una fila nueva `active_weekly` amarilla para 2026, filtro `complete_scope`, 1.692 hechos observados y 481 entradas de ranking (481 jugadores con amarillas positivas). Frente al API actual: +131 jugadores, ninguno retirado; 349 filas cambian puesto, valor o empate y una permanece igual. Marcos Alonso: 19 → 31, valor 2; Raúl García: puesto 127, valor 1; Alberto Lopo no aparece. El ID y hash finales del snapshot quedan pendientes del materializador definitivo.

### Bloqueo de persistencia

La tabla `club_card_facts` tiene protección append-only y una clave lógica única. Por eso 82 valores revisados no se pueden aplicar como `UPDATE`, ni duplicar con la misma clave lógica. Antes de cualquier escritura hace falta diseñar y probar un mecanismo versionado/supersession que mantenga un único hecho efectivo y conserve el historial de evidencia. El artefacto describe los cambios pretendidos, pero **no es un script ejecutable de carga**. No se intentó conexión ni escritura a la base real.

## Verificaciones

- Fastify: endpoint y catálogo emiten el contrato local corregido y comparten snapshot/fecha.
- Repositorio frontend: conserva etiqueta, alcance, snapshot y fecha; la vista usa esos campos.
- Build backend, typecheck frontend y prueba focal del repositorio: pasan.
- Aún no hay verificación en el Render público del contrato corregido, porque el backend no se desplegó.

La carrera global permanece fuera de este cambio y bloqueada.

## Artefacto detallado

[Propuesta JSON por hecho y jugador](./BLOCK45H_ACTIVE_SNAPSHOT_UPDATE_DRAFT.json)

# BLOQUE 45H — reproducción de Marcos Alonso

## Reproducción publicada antes del cambio

- Pantalla: [https://nel386.github.io/rango90/es/](https://nel386.github.io/rango90/es/) → `90 Ranking` → `Ver rankings por categoría` → `Tarjetas amarillas en clubes · Alcance parcial`.
- Endpoint de solo lectura: [ranking activo de amarillas](https://rango90.onrender.com/v1/rankings/club-career-yellow-cards?limit=200&dataset=active_season_weekly&competition=complete_scope).
- Respuesta HTTP: `200`; snapshot `club-cards-yellow-snapshot-a17ece340d31a31960c00624c9078866`, generado el **21-09-2026 16:58:04 UTC**.
- Marcos Alonso: **puesto 19**, empate 3, **2 amarillas**. No es una fila de carrera.

El endpoint declara `dataset=active_weekly`, `scope=active`, temporada `2026`, filtro `complete_scope`, y solo tres competiciones incluidas: Premier League (39), LaLiga (140) y Serie A (135). Bundesliga, Ligue 1 y Primeira Liga están excluidas; el alcance no es mundial ni de carrera.

La fila identifica `player.id=2278`, LaLiga 2026 (`league=140`), equipo 538 (Celta Vigo) y `cards.yellow=2`. Está vinculada a `block31-api-140-2026-4`, `league:140:season:2026:player:2278:team:538` y SHA-256 de respuesta `d4260b539ec055f438d7db53bf5077ad83ed3273b0ee2ec7c05894927629b654`. El checkpoint validado posterior contiene el mismo jugador, competición, equipo y total en el hecho `club-yellow-card-fact-21148d89c154e83500267820163f9f67`.

## Comprobación de top 20 y controles

El corte por puesto 20 contiene **79 filas** al conservar todos los empates: puesto 1 con 4 amarillas; puesto 2 con 3; puesto 19 con 2. Las 79 filas tienen fuente confirmada, hash de respuesta y una combinación de temporada 2026 con liga 39, 140 o 135.

- **Raúl García (ID 146751):** puesto 80, 1 amarilla; LaLiga 2026, Osasuna (equipo 727). Queda fuera del top 20 en este alcance activo.
- **Alberto Lopo:** no aparece en este snapshot activo 2026. Eso no equivale a cero en su carrera; los fixtures de prueba no se usan como evidencia histórica.

Con el checkpoint `36574961077`, las mismas tres ligas y temporada 2026 ya tienen páginas completas y filas posteriores, capturadas entre el 28 de septiembre. Recalcular únicamente esas filas guardadas deja a Marcos en **puesto 31 con 2 amarillas**: hay 3 jugadores con 4 y 27 con 3 antes del grupo de 2. El snapshot de la API, del 21 de septiembre, solo tenía 1 jugador con 4 y 17 con 3 antes de ese grupo. No aparece duplicación ni colisión de identidad; el puesto distinto se explica por la fecha y el contenido más antiguo del snapshot publicado.

## Causa y corrección

La causa demostrada fue de **etiquetado y antigüedad**. El texto general de la app decía que el juego usaba rankings históricos y el modelo de categoría llamaba global/carrera a una entrada que el endpoint sirve como temporada activa parcial. Además, el snapshot público precede en una semana al checkpoint guardado más reciente.

La corrección publicada hace que la categoría se presente como **Tarjetas amarillas — temporada activa (alcance observado)**, elimina la afirmación genérica de que todos los rankings son históricos, y presenta el alcance y la fecha de corte del snapshot. El endpoint conserva su respuesta de solo lectura y muestra la fecha real del snapshot. La respuesta directa del API conserva una etiqueta heredada «Tarjetas amarillas globales en clubes — alcance observado»; el frontend la sustituye en esta categoría porque el payload identifica `dataset=active_weekly`, `season=2026` y `scope=active`. No se desplegó Render. No se recalculó ni escribió ningún snapshot de producción; por tanto, su puesto 19 sigue siendo el puesto del corte del 21 de septiembre, no del corte posterior del checkpoint.

La extracción mantiene `yellow`, `red` y `second_yellow` separados: la consulta del ranking amarillo toma `cards.yellow`; los subtipos de roja se conservan separados en origen y no se añaden a las amarillas. La respuesta informa `redTypesDifferentiated=true`.

## Verificación

- Prueba de regresión del normalizador de retos: una etiqueta entrante “global/carrera” de amarillas se reemplaza por temporada activa y alcance observado.
- Build frontend y backend, TypeScript, i18n, lint dirigido y pruebas de flujo/repositorio. CI de GitHub Pages: [run 37009501729](https://github.com/nel386/rango90/actions/runs/37009501729).
- Playwright después del cambio, endpoint real incluido: [escritorio](../../../artifacts/block45h/yellow-cards-active-scope-es-desktop.png), [móvil](../../../artifacts/block45h/yellow-cards-active-scope-es-mobile.png), [fila de Marcos en escritorio](../../../artifacts/block45h/yellow-cards-marcos-desktop.png), [fila de Marcos en móvil](../../../artifacts/block45h/yellow-cards-marcos-mobile.png). [Antes](../../../artifacts/block45h/yellow-cards-before-scope-fix.png). El script verifica categoría, endpoint 200, snapshot, alcance, puesto/valor de Marcos, controles Raúl García/Alberto Lopo y ausencia de overflow horizontal móvil.
- Sin consultas a API-Football, load, imports, escrituras PostgreSQL ni cambios en Render.

El informe JSON conserva los campos por fila, los hashes y la reconciliación del recálculo. Su hash canónico SHA-256 se excluye a sí mismo del cálculo.


Commit publicado: `351015a57dba63b16fe3c231383b78c2829c2121`. Informe JSON: `reportHash` usa SHA-256 del JSON canónico con claves ordenadas y sin ese campo. La interfaz pública ya presenta alcance de temporada; la etiqueta de la respuesta directa del backend sigue pendiente porque no se hizo despliegue de Render.


CI del commit de interfaz: los pasos frontend, Pages, Android, backend e integración HTTP pasaron; el workflow terminó en fallo únicamente en «Audit production dependencies» por la alerta preexistente de Next.js 16.3.4 (GHSA-vcvr-r3jv-pc5j; el informe recomienda 16.3.8). No se amplió este arreglo de ranking para cambiar dependencias ajenas al defecto.

# Rango 90 — auditoría actual y plan de recuperación

Fecha de revisión: 2026-09-16 UTC  
Objetivo: recuperar la confianza en los rankings y estabilizar la experiencia de juego sin rehacer la base de datos.

## 1. Veredicto ejecutivo

Rango 90 no necesita una reconstrucción total. Necesita separar tres estados que ahora se están mezclando:

1. datos de investigación o históricos;
2. datos provisionales para probar la aplicación;
3. datos aprobados que pueden sostener una partida y una clasificación.

El problema más grave no es que falle un componente visual. La aplicación está utilizando datos provisionales como si fueran rankings históricos mundiales. Un valor como `+4` puede ser correcto dentro de una ventana parcial importada, pero no significa necesariamente que el jugador sea el cuarto de la historia en esa categoría.

El orden de trabajo debe ser:

1. demostrar qué rankings son ciertos y cuáles no;
2. corregir identidades, alcance y semántica;
3. construir una matriz diaria respaldada solo por categorías aceptadas;
4. arreglar la velocidad y el feedback del juego;
5. mejorar la pantalla de rankings y hacer una auditoría visual móvil.

No se debe borrar la base ni empezar de cero.

## 2. Alcance y limitaciones de esta auditoría

Se revisaron:

- frontend Next.js/PWA;
- repositorio de datos del frontend;
- contrato Fastify/PostgreSQL;
- importadores, snapshots, identidades y catálogo jugable;
- rutas públicas de GitHub Pages y Render mediante HTTP;
- tests unitarios e integración disponibles;
- captura móvil proporcionada por el propietario.

No se pudo ejecutar una auditoría visual interactiva completa con navegador y captura paso a paso en este entorno. Por tanto, los defectos de comportamiento descritos en código y API deben confirmarse después en un móvil real, con red lenta y recarga de página.

## 3. Evidencia reproducible

### 3.1 Estado del código

- `npm run lint`: correcto.
- `npm run typecheck`: correcto.
- `cd backend && npm run build`: correcto.
- `cd backend && npm test`: correcto.
- `npm run verify:release-readiness`: falla.
- El fallo del guard de publicación observado fue:
  - `playable_outside_top200: 1709`;
  - `pending_portraits_outside_top200: 481`;
  - `duplicate_canonical_primary_portraits: 0`;
  - `published_challenge_decisions_outside_top200: 0`.

Que los tests pasen significa que el motor responde correctamente a fixtures y escenarios controlados. No demuestra que la base de producción contenga rankings históricos publicables.

### 3.2 Base de datos disponible en el workspace

La conexión configurada para la auditoría local devolvió:

- retos diarios actuales: `0`;
- snapshots `draft`: `161`;
- snapshots `superseded`: `1103`;
- categorías `approved`: `5`;
- categorías `draft`: `110`;
- categorías `retired`: `144`.

En particular, categorías marcadas como `approved` siguen teniendo snapshots `draft` y `coverage_complete=false`. La aprobación de la definición de una categoría no equivale a que exista un snapshot publicable.

El catálogo local también contiene perfiles jugables que ya no están dentro del top 200 de ningún ranking no superseded. El guard detecta esos elementos; no deben borrarse sin una decisión editorial, pero sí dejar de formar parte del pool jugable.

### 3.3 Backend público

La API pública responde en `https://rango90.onrender.com`:

- `/health`: `200`, base conectada y esquema preparado;
- `/v1/challenges/daily`: `200`, reto de fecha `2026-09-15`, con `testOnly: true`;
- el reto de prueba contiene 7 categorías y 7 decisiones;
- las categorías incluyen snapshots provisionales de tarjetas, títulos, goles de carrera y Champions League;
- varias decisiones aparecen con `imageStatus: unlicensed` o `imageStatus: fallback`;
- `/v1/categories`: devuelve `0` categorías publicadas;
- `/v1/rankings/club-career-yellow-cards`: `404 Published ranking not found`;
- `/v1/rankings/club-career-red-cards`: `404 Published ranking not found`;
- `/v1/rankings/uefa-champions-league-goals`: `404 Published ranking not found`.

Conclusión: el entorno público y el entorno local no están sirviendo el mismo estado de datos. El público está jugando contra una variante de laboratorio; la base local no tiene un reto diario materializado.

### 3.4 Código que explica los síntomas

#### El backend permite drafts de test en la misma ruta diaria

`backend/src/game-contract.ts` acepta tanto `status = 'published'` como `status = 'draft'` con `metadata.testOnly = 'true'`. Eso está bien para un laboratorio, pero la ruta pública no diferencia claramente laboratorio y producto.

#### El modo test permite imágenes no licenciadas

El mismo contrato devuelve la foto del proveedor API-Football cuando el reto es `testOnly`, y la marca como `unlicensed`. En producción normal utiliza fallback si no existe un asset aprobado.

#### El frontend valida solo cantidad, no calidad editorial

`src/data/game-repository.ts` comprueba que haya 7 categorías y 7 entidades, pero no rechaza un reto `testOnly`, un snapshot provisional ni una entidad con nombre o identidad sospechosa.

#### El botón de reintento inicia directamente la partida

`retryChallenge()` llama a `startDaily()`. Si la carga funciona, el usuario pasa directamente al juego. El texto “Reintentar” no coincide con el efecto real.

#### La siguiente imagen no se precarga

El jugador actual se renderiza con `loading="eager"`, pero no se precarga el siguiente. Después de la respuesta hay un `setTimeout` de 1200 ms y solo entonces se cambia de entidad.

#### El feedback de duelo se inventa en el frontend

En modo duelo se crea un feedback local con `bestCategorySlug` igual a la categoría elegida y sin puesto real. No se puede presentar como feedback correcto.

#### La pantalla “Ranking” no muestra rankings de categorías

El frontend llama a `getLeaderboard(challengeId)`, que es la clasificación de puntuaciones del reto. No existe en el repositorio frontend una operación para consultar y renderizar `/v1/rankings/:categorySlug` como tabla futbolística.

## 4. Diagnóstico por área

| Área | Estado | Prioridad | Diagnóstico |
|---|---|---:|---|
| Verdad de los rankings | No confiable | P0 | Snapshots parciales se presentan con nombres globales. |
| Identidad de jugadores | Riesgo alto | P0 | Existen múltiples namespaces y perfiles fuera del corte jugable. |
| Publicación | Bloqueada | P0 | No hay snapshots publicados ni reto diario oficial en la base local. |
| Entornos | Inconsistentes | P0 | Local y Render no contienen el mismo estado. |
| Imágenes | Parcial | P1 | Hay fallback, pero el modo test permite URLs no licenciadas. |
| Carga | Mala | P1 | Peticiones secuenciales, timeout de 30 s y falta de precarga. |
| Feedback | Incompleto | P1 | Es fugaz; en duelos no es real. |
| Ranking de producto | Confuso | P1 | “Ranking” mezcla clasificación del reto y ranking estadístico. |
| Motor | Razonable | P2 | Tests y validaciones del servidor están bastante avanzados. |
| Diseño visual | No concluyente | P2 | Falta prueba visual real en móvil y escritorio. |

## 5. Decisiones que deben mantenerse

- No borrar snapshots históricos ni evidencias.
- No modificar silenciosamente un snapshot ya utilizado por una partida.
- No completar rankings con ceros, padding o inferencias.
- No fusionar jugadores solo por nombre parecido.
- No utilizar una foto de proveedor sin permiso como imagen de producto final.
- No añadir más categorías hasta cerrar las actuales prioritarias.
- No ejecutar `cleanup-data-catalog --apply` sin revisar previamente el informe dry-run.
- No cambiar la mecánica principal mientras la fuente de verdad siga siendo dudosa.

## 6. Orden de ejecución

Los bloques están ordenados para que varios trabajadores puedan avanzar sin pisarse.

```text
BLOQUE 0  Auditoría y fotografía de datos       solo lectura
   ↓
BLOQUE 1  Identidad y catálogo jugable          migraciones/revisión
   ↓
BLOQUE 2  Rankings fiables y contratos de fuente  importación/validación
   ↓
BLOQUE 3  Reto diario reproducible              materialización/publicación
   ├──────────────→ BLOQUE 4  UX del juego        frontend/API
   └──────────────→ BLOQUE 5  Rankings y medios   frontend/media
                         ↓
                    BLOQUE 6  QA y release gate
```

Los bloques 4 y 5 pueden empezar con fixtures una vez que el contrato de salida del bloque 0 esté definido. La publicación real depende de los bloques 1–3.

# BLOQUES PARA REPARTIR A LOS TRABAJADORES

## BLOQUE 0 — Auditoría de verdad de datos

### Encargo

Construir una auditoría no destructiva que permita responder, categoría por categoría: “¿puedo afirmar públicamente que este ranking es correcto?”.

### Alcance

Analizar como mínimo las siete categorías de la matriz diaria elegida y, después, las categorías de mayor interés para el propietario.

### Tareas

1. Crear un comando reproducible, por ejemplo `npm run audit:ranking-truth`, con filtros por categoría y snapshot.
2. No modificar PostgreSQL durante la auditoría.
3. Para cada categoría, exportar Markdown, JSON y CSV con:
   - slug y definición;
   - entidad (`player`, `club`, `national_team`);
   - fuente y URL de evidencia;
   - snapshot de origen y snapshot de ranking;
   - fecha de recuperación y fecha de generación;
   - ventana temporal real;
   - scope declarado;
   - `coverage_complete`;
   - número de filas recibidas y número de entidades únicas;
   - filas con valor cero o negativo;
   - conflictos de identidad;
   - duplicados canónicos;
   - posiciones empatadas;
   - estado de derechos;
   - estado del asset visual;
   - top 20 con `entity_id`, nombre de origen, nombre canónico, valor, rank y score.
4. Comparar la etiqueta mostrada al usuario con el alcance real. Ejemplo: si el snapshot usa temporadas 2000–2026, no puede etiquetarse como “global de carrera” sin una advertencia explícita.
5. Generar una lista de anomalías, sin arreglarlas automáticamente:
   - jugador conocido ausente del top cuando la fuente lo debería contener;
   - jugador desconocido con posición alta sin evidencia suficiente;
   - misma persona en varios IDs canónicos;
   - mismo ID externo asignado a entidades distintas;
   - categoría que tiene 200 filas pero declara cobertura incompleta;
   - source snapshot que no coincide con el ranking;
   - imagen cuya identidad no coincide con el jugador.
6. Crear una clasificación editorial: `candidate`, `provisional`, `approved`, `retired`.

### No hacer

- No fusionar identidades.
- No recalcular rankings cambiando la fuente.
- No corregir nombres a mano dentro de esta tarea.
- No aprobar una categoría por tener exactamente 200 filas.

### Entregables

- comando reproducible;
- informe completo de las siete categorías;
- informe de anomalías agrupado por severidad;
- recomendación de las 3–5 categorías que sí merece la pena estabilizar primero;
- tests del auditor.

### Criterios de aceptación

- Dos ejecuciones consecutivas producen el mismo hash de salida si la base no cambia.
- Cada fila del top 20 se puede rastrear hasta un snapshot de fuente.
- Ninguna categoría aparece como “global” si su alcance es parcial.
- El informe permite decidir aprobar o retirar sin leer SQL manualmente.

## BLOQUE 1 — Identidad canónica y catálogo jugable

### Encargo

Eliminar la contaminación del pool jugable y resolver identidades únicamente con evidencia sólida, conservando todo el histórico.

### Tareas

1. Revisar las entidades presentes en rankings activos y en la matriz diaria.
2. Crear un informe de identidad con:
   - `source_entity_id`;
   - `canonical_entity_id`;
   - nombres y aliases;
   - fecha de nacimiento cuando exista;
   - IDs externos por proveedor;
   - equipo/selección de contexto;
   - número de rankings en los que aparece;
   - conflictos.
3. Detectar y bloquear automáticamente estos casos:
   - un ID externo que apunta a dos personas;
   - una persona canónica con dos nombres contradictorios sin alias revisado;
   - una entidad de jugador usada en categoría de club o selección;
   - alias excesivamente corto o ambiguo como `Rooney` sin nombre completo;
   - identidad que solo coincide por nombre normalizado.
4. Preparar migraciones revisadas para los casos confirmados. Cada migración debe incluir comentario, motivo, evidencia y rollback lógico.
5. Separar el estado de catálogo:
   - `active + playable`: puede aparecer en una partida;
   - `active + not playable`: se conserva para catálogo o revisión;
   - `excluded_from_game`: se conserva históricamente, no se sirve;
   - `retired`: no se usa en nuevas materializaciones.
6. Reparar el guard para que un perfil `playable_default=true` fuera del top 200 sea un fallo visible del pipeline, no un estado silencioso.

### No hacer

- No borrar filas históricas.
- No utilizar fuzzy matching automático para publicar.
- No unir identidades de distintas fuentes por compartir apellido.
- No usar el nombre de la imagen como evidencia de identidad.

### Entregables

- informe de identidades conflictivas;
- migraciones de casos confirmados;
- política documentada de alias y canonicalización;
- comando dry-run y comando apply separado;
- tests para duplicados, ciclos y tipos incompatibles.

### Criterios de aceptación

- Cero cadenas de identidad de más de un salto.
- Cero IDs externos ambiguos dentro de las categorías seleccionadas.
- Cero jugadores jugables fuera del top 200 de algún ranking válido.
- Toda identidad corregida tiene evidencia y queda registrada.

## BLOQUE 2 — Rankings fiables y contrato de fuentes

### Encargo

Convertir un grupo pequeño de categorías en rankings semánticamente honestos y reproducibles.

### Tareas

1. Elegir 3–5 categorías basándose en el informe del bloque 0, no por conveniencia técnica.
2. Para cada categoría escribir una ficha de contrato:
   - pregunta exacta que responde;
   - universo;
   - alcance temporal;
   - competiciones incluidas y excluidas;
   - tratamiento de selecciones, amistosos y reservas;
   - unidad de medida;
   - dirección del ranking;
   - empates;
   - score cap;
   - mínimo de filas;
   - fuente primaria o combinación explícitamente documentada;
   - licencia y alcance de redistribución.
3. Cambiar el nombre visible de las categorías parciales para que no prometan un histórico mundial. Si el producto quiere “títulos globales de carrera”, esa categoría no se aprueba hasta que la fuente soporte esa afirmación.
4. Regenerar snapshots desde datos ya almacenados siempre que sea posible.
5. No sustituir una fuente parcial por otra diferente para rellenar las posiciones faltantes.
6. Validar cada snapshot con:
   - entidades únicas;
   - valores positivos explícitos;
   - ranking determinista;
   - empates correctos;
   - no padding;
   - identidad canónica válida;
   - cobertura declarada compatible con el alcance;
   - hash estable.
7. Crear fixtures con los casos límite: empates, ausencia de valor, jugador duplicado, cambio de fuente y categoría de universo cerrado.

### No hacer

- No llamar “global”, “all time” o “de carrera” a una ventana incompleta.
- No importar más datos de API-Football solo para aumentar el número de filas.
- No convertir `null` en cero salvo que la fuente lo declare explícitamente.
- No aprobar datos por intuición de que el jugador “parece conocido”.

### Entregables

- fichas de contrato de las categorías elegidas;
- snapshots regenerados;
- evidencia de fuente;
- validadores y fixtures;
- tabla de categorías aceptadas, provisionales y retiradas.

### Criterios de aceptación

- Un tercero puede explicar qué mide cada categoría sin leer el código.
- La misma entrada produce el mismo rank y score en cada ejecución.
- Los top 20 de cada categoría han sido revisados contra la fuente definida.
- El snapshot no puede pasar a `approved` si falla una condición.

## BLOQUE 3 — Matriz diaria y separación de laboratorio

### Encargo

Hacer que el reto diario use exclusivamente categorías y snapshots que hayan pasado los bloques anteriores, sin perder la posibilidad de probar con datos provisionales.

### Tareas

1. Mantener dos rutas o modos explícitos:
   - laboratorio/test: permite snapshots provisionales y fallback;
   - producto/oficial: solo permite snapshots publicados y fuentes aprobadas.
2. No cambiar el comportamiento del laboratorio sin mostrar una etiqueta visible `LABORATORIO` o `DATOS PROVISIONALES`.
3. Hacer que `/v1/challenges/daily` en modo oficial no pueda seleccionar un draft `testOnly`.
4. Si el propietario quiere seguir usando el entorno público como laboratorio, exponer el modo de forma intencionada mediante configuración, no por una excepción silenciosa del query.
5. Materializar una matriz 7×7 y comprobar:
   - 7 categorías del mismo tipo de entidad;
   - 7 decisiones únicas;
   - matriz completa compatible;
   - cada score coincide con el snapshot o con el score cap documentado;
   - hash del reto reproducible;
   - ninguna decisión fuera del catálogo jugable;
   - media aprobada o fallback propio.
6. Evitar que una actualización parcial sustituya un snapshot completo activo.
7. Añadir un endpoint de diagnóstico sin secretos que muestre:
   - versión del backend;
   - commit o build id;
   - fingerprint de base de datos;
   - challenge id servido;
   - estado test/oficial;
   - snapshots usados.

### No hacer

- No publicar una matriz solo porque el servidor puede calcularla.
- No mezclar en la misma pantalla datos oficiales y de laboratorio sin etiqueta.
- No usar la fecha del servidor sin comprobar zona horaria y disponibilidad del reto del día.

### Entregables

- separación test/oficial;
- materializador validado;
- diagnóstico de entorno;
- tests de no publicación de drafts;
- documentación para preparar un reto de laboratorio y uno oficial.

### Criterios de aceptación

- El modo oficial devuelve `404` o estado explícito de “no disponible” si no hay reto oficial.
- El modo laboratorio sigue funcionando con datos provisionales.
- Ningún reto oficial contiene `testOnly`, imágenes `unlicensed` ni snapshots `draft`.
- Local y Render pueden compararse mediante el fingerprint de entorno.

## BLOQUE 4 — Flujo de juego: carga, avance y feedback

### Encargo

Hacer que una partida se sienta inmediata y que cada respuesta explique claramente qué ha ocurrido.

### Tareas

1. Medir por separado:
   - tiempo de primera respuesta de `/v1/challenges/daily`;
   - tiempo de inicio de `/v1/games`;
   - tiempo de cada `/decision`;
   - tiempo de carga de cada imagen;
   - cold start de Render y tiempo con backend caliente.
2. Añadir métricas de cliente con request id, sin enviar datos personales.
3. Separar estados:
   - `cargando reto`;
   - `reto cargado, listo para jugar`;
   - `iniciando partida`;
   - `error al cargar`;
   - `error al iniciar`.
4. Hacer que “Reintentar carga” reintente la petición y permanezca en la pantalla de inicio. El botón “Jugar reto” debe ser el único que inicie la sesión.
5. Definir un timeout de usuario razonable y configurable. Nunca dejar un spinner sin salida durante 30 segundos.
6. Precargar la siguiente imagen al mostrar la actual. Si falla, cambiar al fallback antes de avanzar.
7. Hacer el feedback persistente y accionable:
   - categoría elegida;
   - puesto obtenido;
   - puntos sumados;
   - mejor categoría;
   - mejor puesto;
   - explicación de ausencia si recibe score cap.
8. Sustituir el avance automático obligatorio por un avance controlado o por un autoavance que se detenga si la información aún no está lista.
9. Mantener la partida recuperable en una recarga o pérdida breve de red, al menos guardando un estado local cifrado o no sensible y una cola de resultado pendiente.
10. En duelo, no mostrar feedback inventado. El backend debe devolverlo o el frontend debe esperar al resultado oficial.

### No hacer

- No ocultar errores bajo una pantalla de carga.
- No reiniciar una partida cuando el usuario pidió reintentar una petición.
- No usar la imagen de proveedor como fallback silencioso de producción.
- No mostrar “categoría correcta” si no procede del servidor o de la matriz validada.

### Entregables

- flujo de estados revisado;
- precarga de media;
- feedback corregido;
- métricas de latencia;
- tests de carga, timeout, reintento, recarga y error de imagen.

### Criterios de aceptación

- Un error de carga siempre ofrece reintento y vuelta al inicio.
- Reintentar no empieza una partida por accidente.
- La siguiente tarjeta no aparece hasta que hay imagen válida o fallback.
- Una respuesta incorrecta siempre muestra la categoría correcta en modo diario.
- No existen feedbacks falsos en duelo.

## BLOQUE 5 — Rankings, resultado y medios

### Encargo

Separar la clasificación competitiva del jugador de los rankings futbolísticos que alimentan el juego.

### Tareas de frontend

1. Renombrar la pantalla actual como `Clasificación del reto`.
2. Crear una pantalla o sección `Rankings por categoría`.
3. Añadir selector de categoría y estado visible:
   - oficial;
   - provisional/laboratorio;
   - no disponible.
4. Mostrar en cada fila:
   - posición;
   - nombre canónico;
   - valor bruto;
   - puntuación usada por el juego;
   - empate si procede;
   - imagen aprobada o fallback;
   - fuente y fecha cuando el usuario abra el detalle.
5. En el resultado, diferenciar claramente `puesto`, `puntos obtenidos` y `penalización por tiempo`.
6. No enseñar una fila “Tú” si no existe un resultado oficial.

### Tareas de backend/media

1. Añadir una respuesta consistente de media:
   - `licensed`;
   - `fallback`;
   - `unavailable`.
2. En laboratorio se puede conservar la referencia a una imagen provisional, pero debe llevar etiqueta y nunca confundirse con `licensed`.
3. En modo oficial, servir solo archivo aprobado o fallback propio.
4. Limitar la cola de retratos pendientes al catálogo realmente jugable y al top 200.
5. Los elementos fuera del catálogo se conservan, pero pasan a estado no requerido para no bloquear el guard.

### Entregables

- dos superficies de ranking claramente diferenciadas;
- contrato de datos documentado;
- estados de media coherentes;
- pruebas de fallback, imagen rota y categoría sin snapshot publicado.

### Criterios de aceptación

- El usuario sabe si está viendo puntos de jugadores o un ranking futbolístico.
- Una imagen sin licencia nunca aparece como licenciada.
- Una categoría sin snapshot publicado no se presenta como ranking disponible.
- Los nombres visibles proceden de la identidad canónica revisada.

## BLOQUE 6 — QA, auditoría móvil y puerta de publicación

### Encargo

Verificar el sistema completo con evidencia real antes de considerar que una versión está lista.

### Pruebas funcionales

1. Primer acceso con backend caliente.
2. Primer acceso después de cold start de Render.
3. Backend lento.
4. Backend caído.
5. Error HTTP y reintento.
6. Imagen aprobada.
7. Imagen inexistente con fallback.
8. Error de imagen remota.
9. Respuesta correcta.
10. Respuesta incorrecta.
11. Última decisión.
12. Timeout durante feedback.
13. Reinicio desde error.
14. Recarga durante partida.
15. Resultado enviado dos veces.
16. Ranking sin usuario autenticado.
17. Ranking con usuario autenticado.
18. Duelo con feedback y resultado de ambos participantes.

### Pruebas de datos

- cero snapshots oficiales con `coverage_complete=false`;
- cero categorías oficiales sin fuente aprobada;
- cero decisiones oficiales fuera del top 200;
- cero duplicados canónicos en un snapshot;
- cero scores que no coincidan con el snapshot;
- cero URLs de imagen `unlicensed` en modo oficial;
- cero perfiles jugables fuera del límite;
- cero retos oficiales con hash incorrecto;
- 7 categorías y 7 decisiones en la matriz diaria;
- resultado de cada categoría reproducible desde su snapshot.

### Auditoría visual

Capturar en móvil y escritorio:

1. carga inicial;
2. inicio del reto;
3. selección de categoría;
4. feedback correcto;
5. feedback incorrecto;
6. siguiente jugador;
7. timeout;
8. resultado;
9. clasificación del reto;
10. ranking de categoría;
11. error y reintento;
12. duelo.

Comprobar teclado, foco, zoom, contraste, safe area, barra inferior, scroll, lector de pantalla básico y `prefers-reduced-motion`.

### Puerta de publicación

La versión solo se considera “lista” cuando se cumplen simultáneamente:

- `npm run lint` correcto;
- `npm run typecheck` correcto;
- tests backend correctos;
- tests de contrato correctos;
- auditoría de ranking correcta;
- `verify-release-readiness` correcto;
- matriz diaria oficial válida;
- smoke de Pages/API correcto sin mutar datos reales o usando un entorno de pruebas aislado;
- auditoría móvil aceptada;
- fingerprint de frontend, backend y base registrado.

## 7. Primer reparto recomendado

Si hay cuatro trabajadores disponibles:

- Trabajador A: bloque 0, solo lectura.
- Trabajador B: bloque 4, frontend del flujo de juego con fixtures.
- Trabajador C: bloque 5, separación de pantallas de ranking y estados de media.
- Trabajador D: preparar el bloque 1 leyendo el informe de A; no aplicar migraciones hasta que A cierre sus anomalías.

Si hay más trabajadores, no iniciar nuevas importaciones de categorías. Añadir personas a documentación, revisión manual de identidades y pruebas, no a generar más volumen.

## 8. La primera tarea concreta

La primera orden que debe recibir un trabajador es:

> No borres ni resetees la base. Construye el auditor de rankings del BLOQUE 0 en modo solo lectura. Empieza por las siete categorías de la matriz diaria. Necesito saber, para cada una, qué fuente la respalda, qué alcance real tiene, qué top 20 contiene, qué identidades son dudosas, qué cobertura declara y si puede llamarse honestamente “global”. Genera Markdown, JSON y CSV, añade tests deterministas y no cambies ningún dato. El resultado debe permitir decidir qué categorías pasan a provisional, cuáles se corrigen y cuáles se retiran.

Ese informe es el cuello de botella correcto. Cuando exista, las siguientes decisiones dejarán de basarse en impresiones o en nombres sueltos y podrán repartirse con seguridad.

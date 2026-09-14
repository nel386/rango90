# Rango 90 · integración frontend fase 2

El frontend usa `GameRepository` como frontera única de datos. Cuando existe
`NEXT_PUBLIC_API_BASE_URL`, `HttpGameRepository` consume el contrato `/v1`.
Sin esa variable, el repositorio devuelve un error de configuración y no inicia
partidas sintéticas. Los fixtures mock quedan fuera del runtime distribuible y
solo pueden usarse desde pruebas o herramientas de desarrollo explícitas.

## Flujos conectados

- Reto diario publicado: `GET /v1/challenges/daily`.
- Inicio: `POST /v1/games`.
- Resultado normal: `POST /v1/games/:gameId/result`.
- Tiempo agotado normal: `POST /v1/games/:gameId/expire`.
- Clasificación: `GET /v1/challenges/:challengeId/leaderboard`.
- Crear duelo: `POST /v1/duels`.
- Abrir y actualizar duelo: `GET /v1/duels/:code`.
- Segundo participante: `POST /v1/duels/:code/join`.
- Resultado de duelo: `POST /v1/duels/:code/result`.
- Revancha: `POST /v1/duels/:code/replay`.

El frontend no calcula la puntuación oficial. Las posiciones mostradas en la
partida son provisionales únicamente con el mock; con HTTP permanecen vacías
hasta que el servidor devuelve `result.assignments[].scoreValue` y
`result.totalScore`.

## Estados de interfaz

Se cubren carga, reto diario no publicado, error de red, servidor no disponible,
sesión caducada, guardado pendiente, resultado duplicado, usuario anónimo,
resultado clasificable, duelo completo, duelo no unible, duelo inválido,
duelo caducado y duelo finalizado. El leaderboard se presenta como público,
pero el contrato solo incluye resultados de usuarios autenticados; el frontend
explica al invitado que su resultado se ha guardado sin entrar en la tabla.

## Diferencias contrato · interfaz

1. El contrato entrega `joinUrl` en algunas versiones documentadas, pero el
   backend local actual devuelve el código y el token sin ese campo. La
   interfaz genera un enlace frontend estable (`?duel=CODE`) para no exponer
   una ruta interna de API.
2. El `GET /v1/duels/:code` público no devuelve el token privado ni los
   timestamps de inicio y deadline de cada participante. El frontend conserva
   el token recibido al crear/unirse en `sessionStorage` y muestra una cuenta
   atrás local desde el instante de crear o unirse, con la duración publicada. El servidor sigue siendo la autoridad
   al aceptar o rechazar el resultado.
3. El contrato no tiene un endpoint de expiración de duelo. Al llegar a cero,
   el frontend envía el resultado del duelo con las asignaciones restantes
   marcadas `timedOut`; el backend calcula la penalización y el estado final.
4. La sesión HTTP usa cookies (`credentials: include`). No se ha añadido una
   autenticación nueva en esta fase: el modo anónimo y el modo autenticado se
   reflejan con `leaderboardEligible` y con los errores de sesión/autorización
   del contrato existente.

## Comprobación local

Con PostgreSQL local disponible se arrancó el backend existente en
`http://127.0.0.1:4000` y el frontend en `http://localhost:3000` con
`NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:4000`.

La petición real `GET /v1/challenges/daily` respondió correctamente con
`404 {"error":"daily_challenge_not_found"}`. Por tanto, la integración de
transporte y el estado de “sin reto publicado” están comprobados; el entorno
local no tenía una fixture diaria publicada para ejecutar una partida completa
contra datos reales. No se ejecutó ningún cambio de backend ni se sembraron
datos desde el frontend.

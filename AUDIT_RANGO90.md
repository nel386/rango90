# Auditoría de Rango 90

Fecha: 2026-09-09

> **Documento histórico.** Esta auditoría fue sustituida por la revisión final del 14 de septiembre de 2026. Sus observaciones sobre autenticación, duelos, rate limiting, hashes y accesibilidad describen un estado anterior y no deben utilizarse como criterio de publicación. La evidencia vigente se debe obtener repitiendo los comandos del plan y consultando `DATA_CURRENT_STATUS.md` y la BBDD actual.

## Alcance y evidencia

Se revisaron el frontend Next.js/PWA, el contrato Fastify/PostgreSQL, el motor de partida, autenticación, migraciones, configuración Capacitor/Android y los artefactos exportados.

Pruebas ejecutadas:

- `npm run lint` — correcto, con avisos preexistentes del backend.
- `npm run typecheck` — correcto.
- `npm run build` — correcto.
- `npm run build:pages` — correcto; se comprobaron enlaces `/rango90/...`, manifests y service worker.
- `npm run build:android` — correcto.
- `npx cap sync android` — correcto.
- `cd backend && npm run build` — correcto.
- `cd backend && npm test` — correcto.
- `cd backend && npm run test:integration` — correcto; cubre partida, duplicado, ranking, timeout y duelo.
- `npm audit --omit=dev` y equivalente del backend — 0 vulnerabilidades reportadas.

No se pudo hacer captura visual de la aplicación online: el workspace no contiene una URL pública ni un remote Git configurado, y esta sesión no expone un navegador de captura. Por eso no se afirma cumplimiento visual completo, responsive ni WCAG; esos apartados incluyen sus límites.

## Veredicto

El motor y el contrato backend están razonablemente preparados para una partida validada por servidor, con snapshots y operaciones idempotentes. La aplicación no está demostrablemente lista como producto online completo: el despliegue real depende de configurar la API, la base actual no materializa un reto multi-categoría publicado, la pantalla de duelos no permite jugar ni enviar resultados y la autenticación del frontend sigue siendo simulada.

## Flujo paso a paso

1. **Entrada / inicio — Riesgo alto.** La navegación y el estado de carga existen. En desarrollo sin API se usa mock; en producción ya se ha corregido para fallar explícitamente si falta `NEXT_PUBLIC_API_BASE_URL`. Con la base descrita por las migraciones, el reto real de fase 5 queda en el modelo legacy `challenges` y en estado `draft`; el endpoint que usa el frontend (`/v1/challenges/daily`) necesita una fila publicada en `game_challenges`.

2. **Decisiones — Salud técnica buena.** El frontend bloquea categorías ya usadas y el motor verifica orden, entidad, categoría, duplicados y matriz completa. El backend no acepta scores enviados por el cliente.

3. **Puntuación — Salud técnica buena, con una reserva editorial.** El score proviene de `score_value` del snapshot publicado y queda limitado por `score_cap`; empates y desempate por tiempo/hash están cubiertos. El frontend no debe presentar un umbral de clasificación propio distinto del backend; ahora muestra el `scoreCap` como referencia y usa la respuesta real de elegibilidad.

4. **Timeout — Corregido y probado.** Antes, el reloj se detenía durante la tarjeta de feedback y el timeout podía volver a incluir la entidad actual. Además, `/expire` descartaba las jugadas previas enviadas por el cliente HTTP. Ahora el reloj sigue durante feedback, las entidades pendientes parten de `assignments.length` y el backend revalida las jugadas conocidas antes de completar lo pendiente.

5. **Resultado / doble envío — Salud técnica buena.** El backend bloquea la sesión dentro de una transacción, usa unicidades por sesión, clave de idempotencia y hash, y devuelve `duplicate`. El frontend mantiene una clave estable y permite reintentar. Sigue sin existir una cola offline para guardar un resultado cuando el dispositivo pierde conexión.

6. **Clasificación — Salud backend buena; experiencia limitada.** El backend conserva el mejor resultado por usuario y ordena por score, tiempo y hash. Se corrigió la fila ficticia “Tú” que aparecía incluso sin resultado y podía mostrar una posición falsa. Los invitados no entran en la clasificación, y la interfaz de cuenta no conecta todavía con autenticación real.

7. **Duelo asíncrono — Backend bueno; frontend incompleto, riesgo crítico.** Crear, abrir, unirse, expirar, enviar resultado y repetir están implementados en el contrato backend. La UI solo crea/abre/se une y copia el enlace; no arranca la partida del participante, no usa `submitDuelResult` ni `replayDuel`, y no muestra comparación final. Esto no es un flujo completo de duelo.

8. **Enlaces compartibles — Salud parcial.** El código de duelo viaja como query string y se normaliza; se corrigió el cambio de idioma para no perder `?duel=...`. El compartir de resultados solo copia texto mediante Web Share/clipboard; no genera una URL ni una tarjeta visual persistible.

9. **Español / inglés — Salud estructural buena, contenido parcial.** `/es/` y `/en/`, `lang`, metadata y manifests se generan correctamente. Persisten textos de partida que dicen “jugador” o “siete jugadores” en algunos estados aunque el backend admite clubes y selecciones; las definiciones recibidas del backend se sustituyen por un texto genérico en el frontend.

10. **Responsive móvil — No concluyente.** Hay breakpoints a 820 y 540 px, reflow de grids y navegación inferior fija. No se pudo capturar un viewport móvil; queda por verificar que la barra fija no tape contenido, que el teclado no oculte los formularios y que haya safe-area en iOS/Android.

11. **Accesibilidad — Base aceptable, no certificada.** Hay landmarks, encabezados, labels, `aria-live` para estados, foco visible y cierre de modal con Escape. Riesgos pendientes: los modales no gestionan foco inicial, foco de retorno ni focus trap; el reloj anuncia un cambio cada segundo; no hay prueba automatizada con axe ni lector de pantalla; contrastes y zoom no se verificaron visualmente.

12. **Seguridad — Mejoras aplicadas, riesgos pendientes.** Las sesiones usan cookies HttpOnly, SameSite=Lax y Secure en producción; el backend añade `nosniff`, `X-Frame-Options`, `Referrer-Policy` y HSTS en producción. No hay rate limiting para login, registro, creación de partidas/duelos o lectura abusiva; CORS y URLs de autenticación dependen de configuración correcta; no hay CSP aplicable al frontend estático de GitHub Pages.

13. **Secretos — Incidente que requiere acción manual.** `backend/.env` local contiene una clave de API de proveedor. No está trackeado por Git y no se ha copiado al frontend, pero debe revocarse/rotarse inmediatamente en el proveedor y sustituirse localmente. El informe no reproduce el valor.

14. **Errores de conexión — Salud parcial.** Hay estados de carga/error, detección `online/offline` y reintentos. No hay persistencia local de una partida ni reenvío de resultados; un cierre o pérdida prolongada de conexión puede dejar al jugador sin resultado recuperable.

15. **GitHub Pages — Build correcto, runtime condicionado.** La exportación estática con `/rango90` genera rutas, assets, manifests y service worker con el prefijo correcto. GitHub Pages no puede ejecutar el backend; la API debe vivir en otro origen HTTPS y `CORS_ORIGIN` debe coincidir con el origen web. No hay workflow de publicación en el repositorio revisado.

16. **Android — Preparación parcial.** Capacitor está configurado con `com.rango90.app`, `webDir: out`, HTTPS e Internet permission; `build:android` y `cap sync` pasan. No se pudo compilar APK porque el entorno no tiene Java/Android SDK. La URL de API se fija durante el build, por lo que Android requiere su propia configuración pública de API.

17. **Trazabilidad de categoría publicada — Mejorada, no cerrada.** El contrato devuelve `sourceVersion`, `challengeSha256` y `rankingSnapshotId` por categoría, y el resultado conserva el digest. La base actual no demuestra que exista una categoría multi-categoría publicada para el reto diario, y el servidor aún no recalcula el digest a partir de la matriz cargada para detectar un digest editorial incorrecto.

## Riesgos restantes priorizados

- **P0:** revocar la clave de proveedor expuesta en `backend/.env` y crear un valor nuevo fuera del repositorio.
- **P1:** materializar y publicar un `game_challenges` multi-categoría completo, con snapshots aprobados, matriz cuadrada, derechos de medios y digest verificable.
- **P1:** desplegar el frontend con `NEXT_PUBLIC_API_BASE_URL` y configurar CORS/auth para el origen real de GitHub Pages o Android.
- **P1:** conectar el flujo de duelo a la misma experiencia de partida y resultado; no debe publicarse como “duelo jugable” mientras solo permita compartir/unirse.
- **P1:** conectar la UI de cuenta con los endpoints de autenticación o retirar las promesas de guardar/competir del copy público.
- **P2:** añadir límites de abuso/rate limiting y observabilidad de errores, especialmente auth y creación de duelos.
- **P2:** decidir una política de recuperación offline para partidas y resultados antes de anunciar soporte PWA offline.
- **P2:** realizar una pasada visual real en desktop y móvil, con teclado, zoom, lector de pantalla y contraste.

## Cambios aplicados

- Timeout de frontend continuo durante feedback y sin duplicar la entidad actual.
- `/expire` acepta y valida jugadas previas antes de completar pendientes.
- Producción ya no cae silenciosamente al mock sin API configurada.
- Resultados y retos propagan digest de publicación; categorías exponen snapshot usado.
- Ranking ya no muestra una fila propia ficticia antes de tener resultado.
- Enlace de cambio de idioma conserva el código de duelo.
- Cierre de modales con Escape y anuncio accesible del tiempo.
- Headers HTTP básicos de seguridad en backend.
- Registro de cuenta en producción bloqueado sin canal de verificación configurado, evitando escribir tokens de verificación en logs.

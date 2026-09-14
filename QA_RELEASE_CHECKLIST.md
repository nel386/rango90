# QA de lanzamiento de Rango90

Este documento separa las comprobaciones reproducibles del código de la aprobación manual del producto. Un resultado verde del smoke test no sustituye la revisión visual, funcional ni legal.

## Smoke público

Desde el repositorio, con red disponible:

```bash
npm run smoke:public
```

Debe devolver `ok: true`, Pages 200 en `/es/` y `/en/`, CORS correcto, `/health` con base conectada y `/v1/categories` con un array. Mientras no exista un reto publicado, `/v1/challenges/daily` debe devolver exactamente 404 con `daily_challenge_not_found`; después de publicar debe devolver 200 con un reto `daily`.

## Revisión manual externa

Realizar en un navegador de escritorio y en un móvil/emulador, con caché vacía y también tras recargar:

- abrir [Pages en español](https://nel386.github.io/rango90/es/) y [Pages en inglés](https://nel386.github.io/rango90/en/);
- comprobar que el selector ES/EN cambia todos los textos visibles, etiquetas, errores y modales, sin desbordamientos;
- verificar carga, error de backend, reintento y navegación inferior;
- cuando exista un reto publicado, completar las siete decisiones, comprobar categorías incompatibles, empates, puntuación, timeout, abandono, resultado, ranking y reintento de envío;
- probar un duelo con enlace nuevo, unión del segundo participante, resultado y rematch;
- abrir y cerrar los modales con botón, clic exterior y Escape; confirmar foco inicial, foco atrapado y retorno del foco;
- probar teclado únicamente: Tab, Shift+Tab, Enter, Space y Escape; revisar foco visible y orden lógico;
- revisar zoom al 200%, contraste, textos alternativos, mensajes `role=alert/status`, temporizador anunciado y ausencia de contenido que dependa solo del color;
- comprobar PWA en DevTools → Application: manifests, iconos, service worker y ausencia de caché de respuestas `/v1/`;
- comprobar que la APK debug arranca, llega al backend HTTPS, cambia de idioma y conserva el mismo flujo que Pages.

Registrar fecha, dispositivo/navegador, versión de commit, resultado y cualquier incidencia. La aprobación de QA solo se puede marcar después de corregir o aceptar explícitamente cada incidencia.

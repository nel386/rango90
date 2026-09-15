# Probar Rango90 en GitHub Pages

GitHub Pages aloja únicamente el frontend estático. La API Fastify y PostgreSQL necesitan seguir ejecutándose en un backend HTTPS accesible públicamente. La variable `NEXT_PUBLIC_API_BASE_URL` debe contener solo el origen, por ejemplo `https://api.midominio.com`.

## Lo que tiene que aportar el propietario

1. El repositorio debe llamarse `rango90` o hay que confirmar el nombre real para la ruta base.
2. Una URL HTTPS real del backend desplegado, con CORS permitiendo `https://<usuario>.github.io`.
3. Permiso para subir los cambios al repositorio. Este proyecto no hace `git push` automáticamente.

La URL del backend no debe incluir usuario, contraseña, ruta, query ni hash. No se debe pegar aquí ninguna clave secreta.

En el despliegue actual, los valores son:

- Pages: `https://nel386.github.io/rango90/es/`
- API: `https://rango90.onrender.com`

## Pasos en GitHub

1. Subir el proyecto a la rama `main` o `master`.
2. En **Settings → Pages**, elegir **GitHub Actions** como origen de publicación.
3. En **Settings → Secrets and variables → Actions → Variables**, crear `NEXT_PUBLIC_API_BASE_URL` con la URL HTTPS del backend.
4. Ejecutar manualmente **Deploy Rango90 to GitHub Pages** desde la pestaña **Actions**, o hacer push a `main`/`master`.
5. Abrir `https://<usuario>.github.io/<repositorio>/es/`.

Si solo se quiere comprobar la interfaz, el build puede publicarse con una URL de backend válida pero las partidas y los datos no funcionarán hasta que exista ese backend. Pages no puede ejecutar Fastify ni PostgreSQL.

## Prueba jugable con datos reales

Mientras las fuentes sigan pendientes de completar cobertura o revisión de derechos, el repositorio permite crear un reto explícito de prueba. Este modo no publica categorías ni snapshots: usa filas reales ya contrastadas, no rellena ceros ni inventa entidades, y sirve un fallback visual propio cuando no existe un retrato o escudo aprobado.

1. En **Actions**, ejecutar **Prepare Rango90 test challenge**.
2. En la confirmación escribir exactamente `TEST`.
3. Esperar a que finalice correctamente.
4. Abrir Pages y hacer una recarga forzada (`Ctrl+F5` si el navegador conserva el bundle anterior).
5. Pulsar **Jugar** y completar las 7 decisiones.

La comprobación automatizada equivalente es `npm run smoke:public`; valida Pages, CORS, health, carga del reto, inicio de partida y aceptación del resultado completo. El reto de prueba aparece como `testOnly: true`; no debe confundirse con una publicación oficial.

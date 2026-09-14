# Probar Rango90 en GitHub Pages

GitHub Pages aloja únicamente el frontend estático. La API Fastify y PostgreSQL necesitan seguir ejecutándose en un backend HTTPS accesible públicamente. La variable `NEXT_PUBLIC_API_BASE_URL` debe contener solo el origen, por ejemplo `https://api.midominio.com`.

## Lo que tiene que aportar el propietario

1. El repositorio debe llamarse `rango90` o hay que confirmar el nombre real para la ruta base.
2. Una URL HTTPS real del backend desplegado, con CORS permitiendo `https://<usuario>.github.io`.
3. Permiso para subir los cambios al repositorio. Este proyecto no hace `git push` automáticamente.

La URL del backend no debe incluir usuario, contraseña, ruta, query ni hash. No se debe pegar aquí ninguna clave secreta.

## Pasos en GitHub

1. Subir el proyecto a la rama `main` o `master`.
2. En **Settings → Pages**, elegir **GitHub Actions** como origen de publicación.
3. En **Settings → Secrets and variables → Actions → Variables**, crear `NEXT_PUBLIC_API_BASE_URL` con la URL HTTPS del backend.
4. Ejecutar manualmente **Deploy Rango90 to GitHub Pages** desde la pestaña **Actions**, o hacer push a `main`/`master`.
5. Abrir `https://<usuario>.github.io/<repositorio>/es/`.

Si solo se quiere comprobar la interfaz, el build puede publicarse con una URL de backend válida pero las partidas y los datos no funcionarán hasta que exista ese backend. Pages no puede ejecutar Fastify ni PostgreSQL.

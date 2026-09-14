# Backend de Rango90 en Render

La configuración del Blueprint está en [`render.yaml`](./render.yaml). Crea un Web Service gratuito llamado `rango90`, con PostgreSQL gratuito y la comprobación `GET /health`.

## Valores elegidos

| Recurso | Campo | Valor | Motivo |
| --- | --- | --- | --- |
| Web Service | Plan | `free` | `0,1 CPU / 512 MB RAM`; suficiente para la prueba personal |
| Web Service | Región | `frankfurt` | Menor latencia desde España/Europa |
| Web Service | Deploy automático | `commit` | Cada push a `master` vuelve a desplegar |
| PostgreSQL | Plan | `free` | `0,1 CPU / 256 MB RAM`, máximo 100 conexiones |
| PostgreSQL | Nombre del recurso | `rango90-db` | Identificador de Render |
| PostgreSQL | Database | `rango90` | Nombre interno de la base |
| PostgreSQL | User | `rango90` | Usuario de conexión |
| PostgreSQL | PostgreSQL | `16` | Igual que el contenedor local del proyecto |
| PostgreSQL | Storage | `1 GB` | Límite inicial gratuito |
| PostgreSQL | Autoscaling | Desactivado | Evita cambios de coste/plan durante la prueba |
| PostgreSQL | Password | Generada por Render | No se escribe ni se comparte |

No hay que crear `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` ni `POSTGRES_PORT` como variables del Web Service. Render los convierte en una `DATABASE_URL` interna y el backend usa únicamente esa variable.

El Web Service y PostgreSQL deben permanecer en Frankfurt para que el backend utilice la conexión interna privada. La base gratuita tiene 1 GB, no tiene backups administrados y caduca a los 30 días; es una configuración de test, no de producción.

## Despliegue inicial

1. Entra en Render y elige **New → Blueprint**.
2. Conecta el repositorio `nel386/rango90` y selecciona la rama `master`.
3. Revisa el Blueprint y pulsa **Apply**.
4. Cuando Render lo solicite, introduce `API_FOOTBALL_KEY` en el panel de variables de entorno. No se guarda en este repositorio.
5. En Datadog elige la opción sin integración: no es necesario para que Rango90 funcione y no forma parte de las variables de la aplicación.
6. Abre la URL pública del Web Service y comprueba:

   ```text
   https://rango90.onrender.com/health
   ```

   La respuesta esperada contiene `"service":"rango90-backend"`.

Si Render asigna una URL distinta, esa URL real sustituye a `https://rango90.onrender.com` también en `AUTH_VERIFICATION_BASE_URL`.

## Variables de aplicación

### Fijadas automáticamente en el Blueprint

```text
NODE_ENV=production
CORS_ORIGIN=https://nel386.github.io
AUTH_FRONTEND_ORIGIN=https://nel386.github.io/rango90/es/
AUTH_COOKIE_SAMESITE=none
AUTH_VERIFICATION_BASE_URL=https://rango90.onrender.com/v1/auth/verify-email
DATABASE_URL=(generada por Render desde rango90-db)
```

`PORT` tampoco se introduce: Render la proporciona y el servidor ya escucha en `0.0.0.0`.

### Solicitada como dato privado

```text
API_FOOTBALL_KEY=(la que ya está configurada; se introduce en Render como valor privado)
```

### Opcionales

```text
AUTH_EMAIL_WEBHOOK_URL=(solo si queremos activar registro/verificación por correo)
GOOGLE_CLIENT_ID=(solo para Google OAuth)
GOOGLE_CLIENT_SECRET=(solo para Google OAuth)
GOOGLE_REDIRECT_URI=(solo para Google OAuth)
FOOTYSTATS_API_KEY=(solo para el importador histórico que la usa)
OPENVERSE_CLIENT_ID=(solo para autenticación OAuth de Openverse)
OPENVERSE_CLIENT_SECRET=(solo para autenticación OAuth de Openverse)
```

API-Football es la fuente operativa de datos; Datadog es observabilidad externa. Si más adelante quieres monitorización, se configura desde **Render → Observability** o desde la ficha de PostgreSQL, usando una clave de organización de Datadog. No se añade `DATADOG_API_KEY` al backend ni es necesaria para este despliegue.

### Opciones de Datadog

- **Sin Datadog (recomendado):** coste cero, usamos logs, métricas y health check de Render.
- **Datadog para PostgreSQL:** se añade desde la ficha de la base de datos en Render; sirve para métricas del host, disco y red.
- **Datadog para logs/métricas del servicio:** se configura en **Observability** con el sitio de Datadog y una clave de organización.

La clave de Datadog es independiente de API-Football. Si no vas a usar Datadog, no crees ninguna variable, secret o cuenta relacionada.

## Actualización automática sin añadir un servicio de pago

Render no ofrece Cron Jobs en el plan gratuito: la documentación actual indica un mínimo de 1 USD/mes por tarea programada. Para conservar el coste cero, el repositorio incluye `.github/workflows/api-football-refresh.yml`, que ejecuta la política existente desde GitHub Actions:

- diario a las 03:15 UTC: seis ligas activas;
- semanal los domingos a las 04:30 UTC: Champions/Mundial y reconstrucciones semanales previstas;
- ejecución manual mediante **Actions → Refresh API-Football data → Run workflow**.

Configura una sola vez estos dos secretos privados del repositorio `nel386/rango90`:

```text
RANGO90_DATABASE_URL=(External Database URL de rango90-db; solo en GitHub Secrets)
API_FOOTBALL_KEY=(la misma clave ya configurada en Render; solo en GitHub Secrets)
```

La URL debe ser la **External Database URL** de PostgreSQL, no la `DATABASE_URL` interna del Web Service. El workflow no imprime ninguno de los dos valores. La sincronización conserva snapshots previos, deja los nuevos en revisión/draft y nunca aprueba fuentes ni publica categorías o retos automáticamente. Las ejecuciones requieren que la base gratuita de Render siga activa y que la cuota de API-Football sea suficiente.

## Base de datos: dos opciones de contenido

- **Base limpia:** crear el PostgreSQL, ejecutar las migraciones y después los comandos de seed/import del README. Es la opción inicial más sencilla y no copia credenciales ni datos desde Ubuntu.
- **Copia de la base local:** crear primero el PostgreSQL en Render y restaurar un `pg_dump` usando su URL externa. La aplicación debe seguir usando la URL interna que Render inyecta como `DATABASE_URL`.

Para la copia local se incluye `backend/scripts/restore-render-database.sh`. Desde Ubuntu, con el proyecto y el contenedor local levantados:

```bash
export RENDER_DATABASE_URL='(pega aquí solo en tu terminal la External Database URL de Render)'
export CONFIRM_RENDER_DB_RESTORE=YES
npm --prefix backend run db:restore:render
unset RENDER_DATABASE_URL CONFIRM_RENDER_DB_RESTORE
```

La URL se utiliza únicamente en memoria y no se imprime. El comando sobrescribe la base Render indicada, pero no toca la base local. Es una transferencia para pruebas: conserva los estados `draft` y no publica categorías ni retos. La URL que usa el Web Service sigue siendo la `DATABASE_URL` interna generada por Render.

El arranque del backend ejecuta ahora las migraciones idempotentes y siembra el catálogo automáticamente. Esto crea la estructura y las categorías base, pero no publica automáticamente los rankings históricos actuales ni un reto diario: esos datos requieren sus importaciones y la validación editorial correspondiente.

## Variable para GitHub Pages

En el repositorio de GitHub, crea una variable de Actions —no un secret— con:

```text
Name:  NEXT_PUBLIC_API_BASE_URL
Value: https://rango90.onrender.com
```

El valor debe ser únicamente el origen HTTPS del backend: sin `/health`, sin `/v1` y sin barra final. Si Render asigna otro hostname, usa ese hostname real.

El servicio gratuito de Render puede dormirse después de inactividad y la base de datos gratuita tiene limitaciones de duración y persistencia. Es suficiente para pruebas personales; no se considera todavía un entorno de producción.

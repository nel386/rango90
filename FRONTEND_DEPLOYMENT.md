# Despliegue del frontend, PWA y Android

Este documento cubre únicamente el frontend estático, PWA y contenedor Capacitor. El backend sigue siendo un servicio separado y no se modifica desde estos comandos.

## Requisitos de máquina

- Node.js `>=20.9.0` y npm.
- Para Android: JDK 21, Android SDK con la plataforma y build-tools 35, Android SDK Build-Tools disponibles en `PATH` o configurados por Android Studio, y un dispositivo/emulador con Android 7/API 23 o superior.
- `android/gradlew` descarga Gradle 8.11.1 cuando existe red. No hace falta instalar Gradle globalmente.
- Para una APK de release también hace falta un keystore y configuración de firma fuera del repositorio. Esta preparación no crea ni incluye claves.

Comprobación rápida:

```bash
node --version
npm --version
java -version
test -n "$ANDROID_HOME" || test -n "$ANDROID_SDK_ROOT"
```

## Variables de entorno

Next.js incorpora las variables `NEXT_PUBLIC_*` en el bundle durante el build. Por tanto, `NEXT_PUBLIC_API_BASE_URL` no es un secreto y debe contener únicamente el origen público del backend:

```dotenv
NEXT_PUBLIC_API_BASE_URL=https://api.example.com
# Optional but recommended for Android/web duel sharing.
NEXT_PUBLIC_PUBLIC_WEB_ORIGIN=https://example.com/rango90
```

Se puede usar un `.env.local` ignorado por Git para desarrollo, o exportar la variable sólo para el comando. No copies `DATABASE_URL`, claves de proveedores, secretos de OAuth ni credenciales de firma al frontend.

La variable `NEXT_PUBLIC_BASE_PATH` la fija cada script: `/rango90` para GitHub Pages y vacío para Android. No reutilices el build de Pages dentro de Capacitor.

## GitHub Pages

Para el sitio de proyecto `https://OWNER.github.io/rango90/`:

```bash
npm ci
NEXT_PUBLIC_API_BASE_URL=https://api.example.com npm run build:pages
npm run verify:pages
```

El contenido que se publica es la carpeta `out/`. El build genera los enlaces y chunks con `/rango90`, las rutas `/rango90/es/` y `/rango90/en/`, los tres manifests y el service worker bajo el mismo prefijo.

En PowerShell:

```powershell
$env:NEXT_PUBLIC_API_BASE_URL = "https://api.example.com"
npm run build:pages
npm run verify:pages
```

No se publica nada automáticamente desde estos scripts.

## Android / Capacitor

El build nativo usa exactamente el mismo código de `src/`, pero con base path vacío y `webDir: "out"`:

```bash
npm ci
NEXT_PUBLIC_API_BASE_URL=https://api.example.com npm run build:android
npm run verify:android
npx cap sync android
cd android
./gradlew assembleDebug
```

La APK debug queda en `android/app/build/outputs/apk/debug/app-debug.apk`. El atajo equivalente es:

```bash
NEXT_PUBLIC_API_BASE_URL=https://api.example.com npm run cap:build:debug
```

Para abrir el proyecto en Android Studio:

```bash
npm run cap:open:android
```

`capacitor.config.ts` mantiene `com.rango90.app`, `webDir: "out"` y `androidScheme: "https"`. En una release el backend debe ser HTTPS; una URL HTTP puede fallar como contenido mixto dentro del WebView seguro.

## CORS requerido en el backend

El backend debe permitir los orígenes exactos que realmente se utilicen, sin incluir el path `/rango90`:

- Desarrollo web: `http://localhost:3000`.
- GitHub Pages: `https://OWNER.github.io`.
- Android Capacitor: `https://localhost`.
- Cualquier dominio web propio adicional, por ejemplo `https://rango90.example.com`.

Como el frontend envía cookies de sesión (`credentials: include`), no sirve `Access-Control-Allow-Origin: *`. El servidor debe responder a las preflight `OPTIONS` y permitir, como mínimo, `GET`, `POST`, `Content-Type`, `Accept` e `Idempotency-Key`, además de `Access-Control-Allow-Credentials: true`.

La configuración actual del backend expone `CORS_ORIGIN` como lista separada por comas y valida cada origen contra una lista blanca exacta. En producción todos deben ser HTTPS y no deben incluir el path `/rango90`.

Si el backend está detrás de un reverse proxy, define `TRUST_PROXY=true` solo cuando ese proxy sobrescriba y limpie `X-Forwarded-For`; así el rate limiting usa la IP del cliente sin permitir que el navegador la falsifique. En una exposición directa, mantén `TRUST_PROXY=false`.

Nota de sesiones: el backend emite cookies `HttpOnly` y `Secure` en producción. `AUTH_COOKIE_SAMESITE` debe mantenerse en `lax` si frontend y API comparten sitio; para Pages o Capacitor cross-site puede configurarse `none`, siempre con HTTPS y con una revisión CSRF del despliegue. El API debe aceptar únicamente los orígenes exactos declarados en `CORS_ORIGIN`.

## Instalación y verificación de la PWA

La exportación incluye:

- manifest general y manifests por idioma;
- iconos PNG de 192 y 512 px, con el de 512 declarado también como `maskable`;
- service worker de shell, con caché separada para cada instalación/base path;
- rutas y assets compatibles con `/rango90` y `/`.

La instalación del navegador requiere HTTPS (o `localhost` durante desarrollo). Para comprobarla en Chrome/Edge: abrir `/rango90/es/`, revisar DevTools → Application → Manifest y Service Workers, y confirmar que no hay errores de iconos, manifest ni `sw.js`. Las peticiones `/v1/` no se almacenan en la caché del service worker.

## Responsive móvil

La interfaz conserva una sola experiencia web: los grids pasan a una columna en `820px`, la navegación inferior y los controles se adaptan en `540px`, y se reserva espacio para el área segura de dispositivos con notch/home indicator. La verificación reproducible de rutas y assets es:

```bash
npm run lint
npm run typecheck
npm run build:pages && npm run verify:pages
npm run build:android && npm run verify:android
```

La revisión visual final debe hacerse en un navegador móvil real o emulador, incluyendo `/es/`, `/en/`, un duelo con query string y el flujo de instalación.

## Problemas Android conocidos

- Sin JDK 21 no puede ejecutarse Gradle; `npx cap sync android` puede preparar/copiar assets, pero `assembleDebug` no.
- Sin Android SDK o sin la plataforma/build-tools 35, Gradle no podrá resolver el `compileSdk` configurado.
- La URL pública del backend debe usar HTTPS. Para un backend local en un emulador se necesita una URL accesible desde el emulador, normalmente `10.0.2.2` para el host, y la configuración de cleartext/red debe tratarse sólo como desarrollo.
- Las partidas invitadas pueden cargar con CORS. Para sesiones basadas en cookies cross-site (Pages o Capacitor), configura `AUTH_COOKIE_SAMESITE=none` junto con HTTPS; el backend rechaza configuraciones de producción inseguras y aplica la comprobación de origen CSRF.
- La APK release aún necesita firma, versionado y pruebas en dispositivo; `assembleRelease` no publica nada.
- No se ha añadido SDK publicitario, notificaciones ni Firebase. Así se evita fijar una dependencia no validada en una APK todavía no probada.

## Anuncios: preparación pendiente

No hay SDK publicitario ni claves de anuncios en el frontend o Android. La integración pendiente debe seleccionarse después de validar una APK funcional y revisar consentimiento, privacidad, medición, política de la tienda y comportamiento offline. Cuando se elija un SDK probado, deberá entrar como integración nativa Capacitor con una configuración por entorno; nunca se deben colocar identificadores secretos o claves privadas en `NEXT_PUBLIC_*`.

## Misma experiencia web y Android

Sí: ambos targets comparten componentes, mensajes, estilos, repositorio HTTP, manifests/iconos y contrato de rutas. La única diferencia de distribución es el `basePath` de compilación (`/rango90` en Pages frente a vacío en Capacitor) y las capacidades nativas futuras, como anuncios o notificaciones. No existe una lógica de juego duplicada para Android.

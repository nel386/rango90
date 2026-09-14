# Revisión arquitectónica inicial — Rango 90

Fecha de revisión: 2026-09-08

## Decisión

Se conserva la dirección actual:

```text
Next.js + React + TypeScript
        ├── build estático → GitHub Pages
        └── build web local → Capacitor → Android

Frontend estático → backend HTTP independiente → datos propios
```

Es una buena base para el producto porque permite validar la experiencia de juego con coste bajo y, al mismo tiempo, deja el backend fuera del frontend público. No se recomienda introducir ahora Cloudflare, microservicios, una plataforma de datos externa ni una carpeta Android nativa no verificable.

La exportación estática es compatible con Next.js: `next build` genera la carpeta `out`. Las funciones que necesitan servidor no pueden vivir en ese build, por lo que autenticación, partidas, puntuaciones, clasificaciones, duelos y administración deberán consumir un backend separado.

Fuentes técnicas: [Next.js Static Exports](https://nextjs.org/docs/app/guides/static-exports), [Next.js `basePath`](https://nextjs.org/docs/pages/api-reference/config/next-config-js/basePath), [Capacitor](https://capacitorjs.com/docs).

## Internacionalización y crecimiento de idiomas

El MVP queda preparado para español e inglés desde el inicio. La estrategia elegida es **routing por segmento + `next-intl`**:

- `/es/` y `/en/` son rutas reales y compartibles.
- `generateStaticParams` genera ambas rutas durante `next build`.
- `dynamicParams = false` evita publicar locales no soportados.
- Cada layout raíz localizado genera el `lang` correcto en el HTML estático.
- `generateMetadata` produce título, descripción, alternates y manifest por idioma.
- La raíz `/` ofrece un selector bilingüe.
- `next-intl` gestiona los mensajes, el contexto de traducción y la navegación localizada. La configuración está preparada para añadir cuatro o más idiomas sin migrar el sistema.

Esto encaja con la estrategia de internacionalización de App Router y con la exportación estática de Next.js: [guía oficial de internacionalización](https://nextjs.org/docs/app/guides/internationalization), [layouts raíz bajo un segmento dinámico](https://nextjs.org/docs/app/api-reference/file-conventions/layout), [rutas estáticas con `generateStaticParams`](https://nextjs.org/docs/app/api-reference/functions/generate-static-params).

### GitHub Pages, PWA y Android

La estrategia evita middleware, redirecciones por idioma y negociación de locale en servidor, porque GitHub Pages solo servirá archivos estáticos. `basePath` se mantiene independiente del locale: un despliegue de proyecto produciría `/rango90/es/` y `/rango90/en/`, mientras que Android usa `/es/` y `/en/` con base path vacío.

Hay un manifest estático general y uno por idioma (`manifest-es.webmanifest` y `manifest-en.webmanifest`). Cada manifest inicia la PWA en su idioma. Sigue pendiente añadir iconos y service worker; eso afecta a la instalación/offline, no a la estrategia de traducción.

Capacitor puede reutilizar las dos rutas estáticas y la misma configuración de `next-intl`. El build Android debe hacerse con base path vacío. La preferencia de idioma debe vivir en la URL durante el MVP; guardar la preferencia en almacenamiento nativo puede añadirse después.

### Limitaciones deliberadas

- Añadir otro idioma requerirá ampliar la configuración de locales, añadir su archivo de mensajes y su manifest; no exige rehacer los componentes ni cambiar de estrategia.
- Cada ruta nueva del frontend deberá existir bajo `[locale]` para estar traducida y exportada.
- Las rutas con identificadores imprevisibles no se pueden generar individualmente en GitHub Pages; los enlaces de duelo deberán usar query string o una página estática común.
- El backend todavía no debe recibir una estructura de datos impuesta por esta capa i18n. Cuando se diseñe, se decidirá si devuelve contenido localizado o solo datos neutrales.

## Auditoría del estado inicial

- `src/app`: App Router mínimo y válido.
- `next.config.ts`: `output: "export"`, `trailingSlash: true`, `basePath` configurable e imágenes sin optimización; configuración adecuada para GitHub Pages.
- `public/manifest.webmanifest`: manifest válido como punto de partida, pero todavía sin iconos ni service worker.
- `public/manifest-es.webmanifest` y `public/manifest-en.webmanifest`: manifests localizados para la instalación de la PWA.
- `src/i18n`: routing, carga de mensajes y navegación localizada.
- `src/app/[locale]`: rutas estáticas localizadas con layout raíz por idioma.
- `src/app/(selector)`: selector de idioma en `/`.
- `eslint.config.mjs`: configuración flat compatible con `eslint-config-next`.
- `tsconfig.json`: modo estricto, resolución `bundler` y alias `@/*`; correcto para Next moderno.
- No hay backend, base de datos, autenticación, rutas dinámicas ni código Android; se mantienen fuera de esta revisión.
- No hay workflow de GitHub Actions; el despliegue automatizado queda pendiente.

## Versiones finales comprobadas

Las versiones se han fijado para que una instalación futura sea reproducible:

| Paquete | Versión | Decisión |
| --- | ---: | --- |
| `next` | `16.3.4` | Última versión `latest` disponible en la revisión; requiere Node `>=20.9.0`. |
| `react` | `19.2.8` | Compatible con Next 16 y versión `latest` disponible. |
| `react-dom` | `19.2.8` | Emparejado con React. |
| `eslint-config-next` | `16.3.4` | Emparejado con Next. |
| `eslint` | `9.39.5` | Se mantiene en ESLint 9 porque plugins incluidos por `eslint-config-next` aún declaran compatibilidad hasta ESLint 9. ESLint 10 produce advertencias de peer dependency y no aporta una ventaja necesaria ahora. |
| `typescript` | `6.0.3` | Versión moderna que pasa el lint y el typecheck; TypeScript 7 todavía no es compatible con `typescript-eslint` usado por la configuración de Next. |
| `@types/node` | `26.5.0` | Tipos actuales; el runtime mínimo del proyecto sigue siendo Node 20.9.0. |
| `@types/react` | `19.2.18` | Tipos actuales de React 19. |
| `@types/react-dom` | `19.2.7` | Tipos actuales de React DOM 19. |

La combinación se ha verificado con `npm install`, `npm run lint`, `npm run typecheck` y `npm run build`.

## GitHub Pages

La configuración actual es válida para un repositorio de proyecto, por ejemplo:

```bash
NEXT_PUBLIC_BASE_PATH=/rango90 npm run build
```

`basePath` se decide en build time. `trailingSlash: true` hace que las rutas exportadas se generen como directorios con `index.html`, una forma práctica de servirlas en un hosting estático. Las rutas dinámicas que dependan de datos del usuario no podrán renderizarse en el servidor de GitHub Pages; deberán ser páginas estáticas que llamen al backend desde el navegador.

Pendiente: añadir un workflow de GitHub Actions cuando exista una primera página real y se haya confirmado el nombre exacto del repositorio. No conviene automatizar el despliegue antes.

## PWA

El manifest permite avanzar con la interfaz, pero todavía no es una PWA completa:

- falta service worker/offline caching;
- faltan iconos instalables de 192 y 512 px;
- habrá que probar `start_url` bajo el subpath real de GitHub Pages;
- no se debe cachear como dato de autoridad ninguna puntuación o clasificación del backend.

La PWA puede añadirse sin cambiar la arquitectura. Para el MVP conviene priorizar una web responsive y dejar el cacheo offline avanzado para después de estabilizar el juego.

## Android y Capacitor

Capacitor encaja: permite envolver la misma aplicación web y añadir anuncios, almacenamiento, notificaciones u otras capacidades mediante plugins nativos. No se genera todavía `android/` porque el servidor no tiene Java ni Android SDK y no se puede validar una APK aquí.

Se deben mantener dos builds:

1. GitHub Pages: `NEXT_PUBLIC_BASE_PATH=/rango90`.
2. Android/Capacitor: `NEXT_PUBLIC_BASE_PATH=` y salida estática copiada al `webDir` de Capacitor.

Esto evita que la aplicación Android intente resolver sus assets bajo `/rango90`. La URL del backend será HTTPS y configurable por el build; nunca se incluirán secretos en el frontend.

La integración de anuncios se decidirá cuando exista la aplicación Android mínima. No se añade ahora un SDK publicitario ni código nativo no comprobable.

## Riesgos pendientes

- GitHub Pages no puede ejecutar backend ni proteger secretos.
- Un frontend exportado no debe contener la clave de API-Football.
- CORS, autenticación y almacenamiento de sesiones deberán definirse al crear el backend.
- Una futura migración del frontend a un despliegue Next con servidor sería posible, pero no debe mezclarse con el build estático.
- El manifest actual no garantiza instalación PWA hasta añadir iconos y probarlo en dispositivos.
- Capacitor requiere Android SDK, Java y una prueba de compilación en una máquina preparada.

## Siguiente paso recomendado

Antes de implementar pantallas grandes, pedir al especialista backend/datos que presente y justifique su arquitectura y su modelo de datos. Después validar una categoría completa de extremo a extremo con datos revisados, generar varios retos reproducibles y solo entonces crear el backend mínimo.

La integración de la base de datos deberá consumir el locale de la ruta cuando una pantalla necesite texto traducido, sin duplicar rankings ni hechos futbolísticos por idioma. Los valores estadísticos y sus definiciones deben seguir siendo una única fuente versionada.

## Archivos modificados por esta revisión

- `package.json`
- `package-lock.json`
- `README.md`
- `ARCHITECTURE_REVIEW.md`

Archivos añadidos o reorganizados por la revisión bilingüe:

- `src/app/layout.tsx` (eliminado como layout único)
- `src/app/page.tsx` (movido al selector)
- `src/components/locale-document.tsx` (eliminado al resolver `lang` desde layouts raíz)
- `src/app/(selector)/layout.tsx`
- `src/app/(selector)/page.tsx`
- `src/app/[locale]/layout.tsx`
- `src/app/[locale]/page.tsx`
- `src/app/globals.css`
- `src/lib/i18n.ts`
- `public/manifest.webmanifest`
- `public/manifest-es.webmanifest`
- `public/manifest-en.webmanifest`
- `BACKEND_SPECIALIST_BRIEF.md`

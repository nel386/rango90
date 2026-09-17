# Auditoría de secretos

Fecha de corte: 2026-09-17 UTC. Los valores encontrados no se imprimen ni se incluyen en este informe.

## Resultado

- Estado actual: no hay archivos de secretos rastreados por Git. `.env`, `.env.*` y variantes privadas están ignorados; los ejemplos se mantienen rastreados mediante la excepción `.env.example`.
- Archivo local configurado: `backend/.env`, líneas 5–10 y 14–21 contienen valores locales/configurados con nombres de contraseña, conexión, API/provider o identificación de cliente. El archivo está ignorado y no se modifica.
- `.env.example`: se eliminan valores de muestra ambiguos y se sustituyen por placeholders ficticios.
- Historial, ramas y tags: se revisaron 145 commits de las ramas visibles; no aparecen coincidencias de claves privadas, JWT, tokens GitHub, URLs de conexión con credenciales ni tokens con prefijos conocidos.
- No hay tags; el remoto visible es `origin`. No se hace force push ni reescritura de historia.

## Hallazgos por ubicación

| Archivo | Línea | Tipo de riesgo | Estado |
|---|---:|---|---|
| `backend/.env` | 5 | contraseña de PostgreSQL local | ignorado; no publicado; revisar/rotar si fuera real |
| `backend/.env` | 7 | cadena de conexión PostgreSQL | ignorado; no publicada; revisar/rotar si fuera real |
| `backend/.env` | 10 | API key de proveedor | ignorado; no publicada; revisar/rotar si fuera real |
| `backend/.env` | 14 | URL con identificador de proveedor | ignorado; revisar si el identificador concede acceso |
| `.env.example` | 5, 7 | variables públicas de frontend | ficticias; no son secretos |
| `backend/.env.example` | 7, 9, 29, 33, 36 | valores de muestra de contraseña, conexión y proveedores | corregidos a placeholders ficticios |

Las líneas de código que leen `process.env`, las expresiones `${{ secrets.* }}` de GitHub Actions y las URLs públicas de APIs no son secretos por sí mismas; se registraron solo como uso de configuración, sin valores.

## GitHub Actions y artefactos

Los workflows usan secretos mediante el contexto `secrets.*` y no escriben sus valores en archivos rastreados. Los artefactos de QA y validación se generan en rutas temporales o directorios de artefactos; el workflow histórico de Champions incluye una comprobación explícita contra `x-apisports-key`, `authorization:` y `Bearer ` antes de subir informes. No se detectó un uso inseguro que justifique cambiar workflows en este bloque.

Los artefactos locales generados no se consideran canal de publicación y se limpian solo los indicados en el manifiesto. Los snapshots, capturas y auditorías se conservan porque son evidencia, aunque se evita incluir su contenido en este informe.

## Rotación

No se marca `rotation_required` para el historial Git porque la búsqueda no encontró una credencial en commits, ramas o tags accesibles. El `backend/.env` local contiene valores configurados y queda marcado como revisión local: si el propietario confirma que el API key o la conexión corresponden a servicios reales, debe rotarlos manualmente en el proveedor correspondiente y actualizar el entorno local/Render/GitHub. No se ejecutan rotaciones automáticamente.

## Limitaciones

La auditoría es una comprobación estática basada en nombres, patrones de claves privadas/JWT/tokens/URLs autenticadas y variables conocidas del proyecto. No puede demostrar que un valor opaco o una credencial gestionada externamente no exista fuera de los objetos Git accesibles. Antes de publicar, conviene ejecutar también el escáner corporativo de secretos y revisar la configuración real de GitHub, Render y los proveedores.

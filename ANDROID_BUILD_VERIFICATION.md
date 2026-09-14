# Verificación de APK Android

Fecha: 14 de septiembre de 2026 (UTC)

## Artefacto generado

- Archivo: `android/app/build/outputs/apk/debug/app-debug.apk`
- Variante: `debug` (firma de desarrollo)
- SHA-256: `ace169223ccabc73857ac4f5a44cf0924f163a683810be8eb8b5038607041dd0`
- Paquete: `com.rango90.app`
- `versionCode`: `1`
- `versionName`: `1.0`
- SDK de compilación: `35`
- SDK objetivo: `35`
- SDK mínimo: `23`

## Comprobaciones realizadas

```bash
JAVA_HOME=/usr/lib/jvm/java-21-openjdk-arm64 \
  ./gradlew --no-daemon --console=plain \
  -Pandroid.aapt2FromMavenOverride=/tmp/rango90-aapt2/aapt2 \
  assembleDebug

/usr/lib/android-sdk/build-tools/34.0.0/apksigner verify --verbose \
  android/app/build/outputs/apk/debug/app-debug.apk
```

Resultado: `BUILD SUCCESSFUL`, firma v1 y v2 verificadas y manifiesto inspeccionado con AAPT2.

## Alcance pendiente

Esta evidencia demuestra que el proyecto puede producir una APK debug firmada y válida como artefacto. No se ha instalado en un dispositivo o emulador. Antes de una distribución pública todavía se necesita una variante `release` con clave de firma protegida, pruebas en dispositivo/emulador y QA funcional de la aplicación contra un backend real autorizado.

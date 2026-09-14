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

## Compilación de la variante release

También se ejecutó `assembleRelease` con el mismo build estático y la misma toolchain local:

```bash
JAVA_HOME=/usr/lib/jvm/java-21-openjdk-arm64 \
  ./gradlew --no-daemon --console=plain \
  -Pandroid.aapt2FromMavenOverride=/tmp/rango90-aapt2/aapt2 \
  assembleRelease

/usr/lib/android-sdk/build-tools/34.0.0/aapt dump badging \
  android/app/build/outputs/apk/release/app-release-unsigned.apk
```

Resultado: `BUILD SUCCESSFUL`; el manifiesto confirma `com.rango90.app`, `versionCode=1`, `versionName=1.0`, `compileSdkVersion=35`, `targetSdkVersion=35` y `sdkVersion=23`. El SHA-256 del artefacto unsigned es `46338ceffe5020053050110f162caadb37a615adb937cd12da16a941d774e7eb`.

`apksigner verify` devuelve correctamente un fallo para este archivo porque no contiene `META-INF/MANIFEST.MF`: es una compilación release sin firma, no una APK distribuible.

## Firma release mediante credenciales externas

`android/app/build.gradle` admite estas variables de entorno o propiedades Gradle, sin guardar el keystore ni las contraseñas en el repositorio:

```text
RANGO90_RELEASE_STORE_FILE
RANGO90_RELEASE_STORE_PASSWORD
RANGO90_RELEASE_KEY_ALIAS
RANGO90_RELEASE_KEY_PASSWORD
```

Cuando las cuatro están presentes, `assembleRelease` usa esa configuración y produce una APK firmada. Si falta alguna, el build continúa explícitamente como `unsigned` y lo registra en la salida de Gradle. La clave oficial debe almacenarse en el gestor de secretos de la infraestructura de distribución; no se debe reutilizar el keystore temporal de QA.

## Prueba del circuito de firma

Se generó un keystore temporal de QA fuera del repositorio y se ejecutó `assembleRelease` pasando las cuatro variables anteriores. El artefacto firmado produjo el SHA-256 `7e87fef544c4945ebc20ff1a02cc888b232fcede047317783e93b9f8dfccd450`; `apksigner verify --verbose` confirmó:

```text
Verified using v1 scheme (JAR signing): true
Verified using v2 scheme (APK Signature Scheme v2): true
```

El keystore temporal no es una clave de distribución y no debe instalarse ni publicarse como release oficial. La firma oficial queda pendiente de la clave protegida del proyecto.

Como regresión del fallback, se repitió `assembleRelease` sin las cuatro variables: Gradle registró `no signing credentials configured; building unsigned artifact`, terminó con `BUILD SUCCESSFUL` y produjo únicamente `app-release-unsigned.apk`.

## Alcance pendiente

Esta evidencia demuestra que el proyecto puede producir una APK debug válida y compilar la variante release. No se ha instalado en un dispositivo o emulador. Antes de una distribución pública todavía se necesita firmar la variante `release` con una clave protegida, verificar la firma resultante y ejecutar QA funcional de la aplicación contra un backend real autorizado.

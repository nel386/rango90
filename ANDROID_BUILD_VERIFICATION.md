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

Resultado: `BUILD SUCCESSFUL`; el manifiesto confirma `com.rango90.app`, `versionCode=1`, `versionName=1.0`, `compileSdkVersion=35`, `targetSdkVersion=35` y `sdkVersion=23`. El SHA-256 del artefacto unsigned actual es `25f7b9e0636c0bfecacf5f2d8ed362da7ca667d7015385c890b7078a3424e278`.

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

La clave oficial la crea el titular del proyecto o de la cuenta de distribución con `keytool` del JDK y la custodia fuera del repositorio. El emulador no crea ni custodia claves: únicamente simula un dispositivo para probar la APK. Codex puede comprobar el alias, certificado y firma de un keystore que se entregue por el canal seguro elegido, pero la propiedad y la custodia deben quedar en manos del titular.

## Prueba del circuito de firma

Se generó un keystore temporal de QA fuera del repositorio y se ejecutó `assembleRelease` pasando las cuatro variables anteriores, con `NEXT_PUBLIC_API_BASE_URL=https://qa.invalid` como origen HTTPS sintético de compilación. El artefacto firmado actual produjo el SHA-256 `790530dae5b0988ccfb289330e88a8691c94545b364b7920cdb6e70a0d82eb8c`; `apksigner verify --verbose` confirmó:

```text
Verified using v1 scheme (JAR signing): true
Verified using v2 scheme (APK Signature Scheme v2): true
```

El keystore temporal no es una clave de distribución y no debe instalarse ni publicarse como release oficial. La firma oficial queda pendiente de la clave protegida del proyecto.

Como regresión del fallback, se repitió `assembleRelease` sin las cuatro variables: Gradle registró `no signing credentials configured; building unsigned artifact`, terminó con `BUILD SUCCESSFUL` y produjo únicamente `app-release-unsigned.apk`.

El workflow de CI versionado en `.github/workflows/ci.yml` reproduce ahora las dos variantes: publica el artefacto debug y compila/verifica que la variante release sin credenciales sea explícitamente `app-release-unsigned.apk`. No intenta convertir ese artefacto en una release distribuible.

## Alcance pendiente

Esta evidencia demuestra que el proyecto puede producir una APK debug válida y una APK release firmada con un certificado temporal de QA. La compilación actual usa un origen HTTPS sintético y no es una build distribuible contra un backend real. No se ha instalado en un dispositivo o emulador. Antes de una distribución pública todavía se necesita firmar la variante `release` con una clave protegida del proyecto, verificar la firma resultante y ejecutar QA funcional contra un backend real autorizado.

El emulador no crea la clave oficial: es solo un dispositivo virtual para QA. En este entorno ARM64 están disponibles `adb`, las plataformas Android 23/35 y build-tools 34 del SDK del sistema. Se descargaron y verificaron las herramientas oficiales de línea de comandos en `/home/ubuntu/android-sdk-rango90` (`sdkmanager` 22.0), pero el catálogo disponible no ofrece el paquete `emulator`; por tanto no se pudo crear un AVD ni instalar una imagen virtual desde ese catálogo. Además, el host no expone `/dev/kvm`. La documentación oficial contempla ARM64, pero requiere un binario de emulador Linux ARM64 compatible y virtualización KVM; no se debe sustituir por un emulador no oficial y llamarlo equivalente. La prueba pendiente es, por tanto, una limitación de infraestructura y no una decisión del proyecto.

Referencias oficiales: [descarga de Android SDK Command-Line Tools](https://developer.android.com/studio), [requisitos de aceleración del emulador](https://developer.android.com/studio/run/emulator-acceleration) y [notas sobre hosts Linux ARM64](https://developer.android.com/studio/releases/emulator).

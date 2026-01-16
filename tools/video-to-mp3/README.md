# Video → MP3 (local, en tu navegador)

Convierte videos locales a MP3 usando FFmpeg en WebAssembly, sin subir archivos a servidores.

## Características
- Conversión 100% client-side.
- Formatos comunes: mp4, mov, webm (según el navegador).
- Límite recomendado: ≤ 4 minutos o 200MB.
- Drag & drop, progreso y descarga directa.

## Límites configurables
En `app.js` puedes ajustar:
- `MAX_DURATION_SECONDS` (por defecto 240s)
- `MAX_FILE_MB` (por defecto 200MB)

## Tips de rendimiento
- En móviles o equipos con poca RAM puede tardar más o fallar.
- Usa videos cortos para obtener mejores resultados.

## Vendor FFmpeg (sin CDN)
Esta herramienta carga FFmpeg **exclusivamente** desde archivos locales en `/tools/video-to-mp3/vendor/`.
Durante desarrollo, copia los archivos desde `node_modules` para que GitHub Pages sirva los assets
estáticos sin depender de CDNs.

Archivos requeridos:
- `vendor/ffmpeg/index.js` (copiar desde `node_modules/@ffmpeg/ffmpeg/dist/esm/index.js`)
- `vendor/ffmpeg-util/index.js` (copiar desde `node_modules/@ffmpeg/util/dist/esm/index.js`)
- `vendor/ffmpeg-core/ffmpeg-core.js` (copiar desde `node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js`)
- `vendor/ffmpeg-core/ffmpeg-core.wasm` (copiar desde `node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm`)
- `vendor/ffmpeg-core/ffmpeg-core.worker.js` (copiar desde `node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.worker.js`)

> Nota: estos archivos pesan varios MB. Si el repo crece, considera usar Git LFS para los binarios.

## Checklist de verificación
- Abrir DevTools → Network → confirmar cero requests a unpkg/jsdelivr.
- Convertir un MP4 corto y descargar MP3.

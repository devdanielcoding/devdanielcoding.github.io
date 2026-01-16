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

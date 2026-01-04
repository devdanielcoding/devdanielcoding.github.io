# AI Prompts

Herramienta web para explorar y copiar prompts desde un JSON local.

## Cómo añadir prompts
1. Abre `tools/ai-prompts/data/prompts.json`.
2. Agrega un nuevo objeto dentro del arreglo con el formato indicado abajo.
3. Guarda el archivo y recarga la página.

## Cómo añadir tags
- Usa la propiedad `tags` como un arreglo de strings.
- Los tags se detectan automáticamente para el filtro global.

## Formato del JSON
Cada prompt debe respetar esta estructura:

```json
{
  "id": "string",
  "title": "string",
  "prompt": "string",
  "tags": ["string"],
  "source": "string (opcional)",
  "createdAt": "ISO string (opcional)"
}
```

## Ver localmente
- Abre `tools/ai-prompts/index.html` en tu navegador, o
- Desde la raíz del repo ejecuta un servidor simple:

```bash
python -m http.server 8000
```

Luego visita `http://localhost:8000/tools/ai-prompts/`.

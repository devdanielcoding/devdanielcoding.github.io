# Visualizador SAS

Herramienta frontend-only para analizar scripts SAS como texto y convertirlos en un diagrama de flujo de datos. No ejecuta SAS, no requiere backend y puede desplegarse en GitHub Pages.

## Archivos
- `index.html`: estructura principal, controles y paneles.
- `styles.css`: layout responsive de tres paneles y estilos del grafo.
- `app.js`: parser heurístico, modelo JSON intermedio, sincronización editor-grafo y render de Cytoscape.
- `examples/ejemplo.sas`: script de muestra para probar el MVP.

## Arquitectura del MVP
El flujo interno sigue cinco pasos:

1. Leer el script del editor o desde un archivo local `.sas`.
2. Dividir el texto en bloques de alto nivel: `PROC SQL`, `DATA STEP` y `PROC S3`.
3. Aplicar reglas heurísticas por bloque para extraer:
   - tablas fuente
   - tablas destino
   - joins
   - filtros
   - columnas derivadas
   - destinos externos como `s3://...`
4. Construir un JSON intermedio con la forma:

```json
{
  "nodes": [],
  "edges": [],
  "steps": []
}
```

5. Renderizar el grafo y sincronizar selección entre editor, nodos y panel de detalle.

## Parser heurístico
El parser está preparado para crecer por módulos dentro de `app.js`:

- `splitTopLevelBlocks`: detecta bloques SAS principales.
- `parseProcSqlBlock`: extrae `create table`, `from`, `join`, `where` y columnas derivadas.
- `parseDataStepBlock`: detecta `data`, `set`, `merge` y `by`.
- `parseProcS3Block`: detecta instrucciones `put` con rutas S3.
- `buildGraphModel`: transforma steps en nodos y edges listos para el grafo.

Limitaciones actuales del MVP:
- No cubre todo el lenguaje SAS.
- Usa expresiones regulares y reglas heurísticas, por lo que scripts muy complejos pueden requerir nuevas reglas.
- No resuelve macros ni includes externos.

## Librerías usadas
- [CodeMirror 5](https://codemirror.net/5/) desde CDN para el editor.
- [Cytoscape.js](https://js.cytoscape.org/) desde CDN para el grafo.

> Nota: la página se puede abrir directamente con `file://`, pero necesita conexión a internet para descargar esas librerías desde CDN.

## Cómo ejecutarlo localmente
Opción 1:
- Abrir `tools/visualizador-sas/index.html` directamente en el navegador.

Opción 2:
- Servir el repo con cualquier servidor estático y visitar `/tools/visualizador-sas/`.

Ejemplo con Python:

```bash
cd /Users/daniel/Documents/GitHub/devdanielcoding.github.io
python3 -m http.server 8000
```

Luego abrir:
- `http://localhost:8000/tools/visualizador-sas/`

## Extensiones sugeridas
- Soporte para `proc append`, `insert into`, `create view` y `union`.
- Detección más fina de aliases y subqueries anidadas.
- Leyenda visual por tipo de nodo o tipo de transformación.
- Exportar el JSON intermedio a archivo.

# Agenda Builder

Herramienta web client-side para crear agendas de eventos con validaciones, presets de horarios y exportación en JSON o PDF (impresión nativa del navegador). No usa librerías externas.

## Estructura
- `index.html`: interfaz principal y contenedores.
- `css/styles.css`: estilos responsive con modo de 1 o 2 columnas.
- `js/state.js`: estado global y utilidades de tiempo.
- `js/agenda.js`: operaciones CRUD de actividades y validación agregada.
- `js/presets.js`: generación de agendas de Mañana, Tarde y Noche.
- `js/validation.js`: validaciones de orden y solapamientos.
- `js/export.js`: exportación/importación en JSON y disparador de impresión.
- `js/ui.js`: orquestación de eventos e integración visual.

## Uso
1. Abrir `index.html` en un navegador moderno.
2. Definir nombre y fecha del evento.
3. Crear o editar actividades. Los campos se muestran como texto al perder foco.
4. Aplicar presets (habilitados tras escoger fecha) para generar 4 bloques horarios.
5. Exportar la agenda a JSON o hacer clic derecho sobre la plantilla para imprimir/guardar en PDF.

# devdanielcoding.github.io

Sitio estático generado con [Astro](https://astro.build/) para el hub de herramientas de Daniel S Ríos.

## Desarrollo local

```bash
npm install
npm run dev
```

## Build estático

```bash
npm run build
npm run preview
```

El directorio `dist/` contiene el artefacto listo para GitHub Pages. Recuerda habilitar **Settings → Pages → Source: GitHub Actions** para que el workflow `Deploy Astro site` publique automáticamente cada cambio en `main`.

## Estructura

- `public/`: assets servidos sin procesamiento (favicons, 404, robots, juegos heredados).
- `src/layouts/`: layout base con cabecera y pie.
- `src/components/`: componentes reutilizables (por ejemplo, tarjetas de herramientas).
- `src/pages/`: páginas del sitio (`/`, `/tools/` y herramientas individuales).
- `src/scripts/`: lógica de cada herramienta y scripts auxiliares.
- `src/styles/global.css`: estilos globales y tema oscuro compartido.

Pendiente futuro: generar `sitemap.xml` y explorar mejoras como PWA o buscador ampliado.

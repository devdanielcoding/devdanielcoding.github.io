/**
 * World Atlas — Motor Cartográfico Base D3.js (SPEC-04)
 * Inicialización de SVG, proyección cartográfica, capas ordenadas y renderizado de Nivel 0 (Mundo).
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['d3', './state.js'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./d3.min.js'), require('./state.js'));
  } else {
    root.WorldMap = factory(root.d3, root.State || root.WorldAtlasState);
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function (d3, State) {
  'use strict';

  const WorldMap = {
    initialized: false,
    container: null,
    svg: null,
    zoomGroup: null,
    zoomBehavior: null,
    projection: null,
    pathGenerator: null,
    
    // Almacén de capas en memoria
    layers: {
      sphere: null,
      graticule: null,
      countries: null,
      subdivisions: null,
      districts: null,
      highlights: null
    },

    // Cache de datos geográficos y metadatos
    data: {
      worldGeoJson: null,
      countriesMeta: {},
      subdivisionsGeoJson: null,
      subdivisionsByCountry: null,
      subdivisionsMeta: {},
      districtsCache: {}
    },
    _subdivisionsPromise: null,

    /**
     * Inicializa el motor cartográfico.
     */
    async init() {
      if (this.initialized) return;

      this.container = document.getElementById('map-viewport');
      if (!this.container) {
        console.error('[WorldMap] Contenedor #map-viewport no encontrado en el DOM.');
        return;
      }

      this._setupSvg();
      this._setupZoom();
      this._setupResizeListener();
      this._setupControls();

      // Carga asíncrona de geometrías y metadatos
      await this.loadData();
      
      this.initialized = true;
    },

    /**
     * Configuración del lienzo SVG y capas estructurales.
     * @private
     */
    _setupSvg() {
      // Limpia contenido previo si existiera
      d3.select(this.container).select('svg').remove();

      const width = this.container.clientWidth || window.innerWidth;
      const height = this.container.clientHeight || window.innerHeight;

      this.svg = d3.select(this.container)
        .append('svg')
        .attr('id', 'world-map-svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .style('display', 'block');

      // Grupo principal que recibe transformaciones de Zoom & Pan
      this.zoomGroup = this.svg.append('g').attr('id', 'map-zoom-group');

      // Grupos SVG ordenados estrictamente según SPEC-04 y SPEC-10
      this.layers.sphere = this.zoomGroup.append('g').attr('id', 'layer-sphere');
      this.layers.graticule = this.zoomGroup.append('g').attr('id', 'layer-graticule').attr('class', 'layer-graticule');
      this.layers.countries = this.zoomGroup.append('g').attr('id', 'layer-countries');
      this.layers.subdivisions = this.zoomGroup.append('g').attr('id', 'layer-subdivisions');
      this.layers.districts = this.zoomGroup.append('g').attr('id', 'layer-districts');
      this.layers.highlights = this.zoomGroup.append('g').attr('id', 'layer-highlights');

      // Proyección base (Natural Earth 1: balanceada, estética y sin deformaciones polares extremas)
      this.projection = d3.geoNaturalEarth1();
      this.pathGenerator = d3.geoPath().projection(this.projection);
    },

    /**
     * Configuración del comportamiento de navegación con D3 Zoom.
     * @private
     */
    _setupZoom() {
      this.zoomBehavior = d3.zoom()
        .scaleExtent([0.85, 320])
        .on('zoom', (event) => {
          this.zoomGroup.attr('transform', event.transform);
        });

      this.svg.call(this.zoomBehavior);

      // Desactivar zoom con doble click para permitir interacción territorial limpia
      this.svg.on('dblclick.zoom', null);
    },

    /**
     * Enlaza los botones de control de zoom de la UI.
     * @private
     */
    _setupControls() {
      const btnZoomIn = document.getElementById('btn-zoom-in');
      const btnZoomOut = document.getElementById('btn-zoom-out');
      const btnZoomReset = document.getElementById('btn-zoom-reset');

      if (btnZoomIn) {
        btnZoomIn.addEventListener('click', () => {
          this.svg.transition().duration(280).call(this.zoomBehavior.scaleBy, 1.45);
        });
      }

      if (btnZoomOut) {
        btnZoomOut.addEventListener('click', () => {
          this.svg.transition().duration(280).call(this.zoomBehavior.scaleBy, 0.69);
        });
      }

      if (btnZoomReset) {
        btnZoomReset.addEventListener('click', () => {
          this.resetZoom(400);
        });
      }
    },

    /**
     * Escuchador de cambio de tamaño de ventana con reajuste suave.
     * @private
     */
    _setupResizeListener() {
      window.addEventListener('resize', () => {
        if (!this.container || !this.data.worldGeoJson) return;
        const width = this.container.clientWidth || window.innerWidth;
        const height = this.container.clientHeight || window.innerHeight;

        this.svg.attr('viewBox', `0 0 ${width} ${height}`);
        this._updateProjectionFit(width, height);
        this._renderAllPaths();
      });
    },

    /**
     * Ajusta la escala y traslación de la proyección para encajar en el viewport.
     * @private
     */
    _updateProjectionFit(width, height) {
      if (!this.data.worldGeoJson) return;
      // Margen superior de 64px para respetar el Navbar fijo
      const padding = 20;
      const topPadding = 64;
      this.projection.fitExtent(
        [[padding, topPadding], [width - padding, height - padding]],
        this.data.worldGeoJson
      );
    },

    /**
     * Carga asíncrona y paralela de GeoJSON mundial y metadatos.
     */
    async loadData() {
      try {
        const [geoResponse, metaResponse] = await Promise.all([
          fetch('data/world_countries.geojson'),
          fetch('data/countries_meta.json')
        ]);

        if (!geoResponse.ok || !metaResponse.ok) {
          throw new Error(`Error en carga HTTP: geo=${geoResponse.status}, meta=${metaResponse.status}`);
        }

        this.data.worldGeoJson = await geoResponse.json();
        this.data.countriesMeta = await metaResponse.json();

        // Renderizado cartográfico L0
        this.renderL0();

        // SPEC-08: Pre-cargar e indexar subdivisiones en background sin bloquear la UI
        setTimeout(() => {
          this.loadSubdivisions();
        }, 150);
      } catch (error) {
        console.error('[WorldMap] Error crítico al cargar datos cartográficos:', error);
      }
    },

    /**
     * Carga asíncrona e indexación en memoria de las subdivisiones subnacionales (SPEC-08).
     * @returns {Promise<Object>}
     */
    async loadSubdivisions() {
      if (this.data.subdivisionsGeoJson) {
        return this.data.subdivisionsGeoJson;
      }
      if (this._subdivisionsPromise) {
        return this._subdivisionsPromise;
      }

      this._subdivisionsPromise = (async () => {
        try {
          const [geoResp, metaResp] = await Promise.all([
            fetch('data/subdivisions.geojson'),
            fetch('data/subdivisions_meta.json').catch(() => null)
          ]);
          if (!geoResp.ok) {
            throw new Error(`Error en carga de subdivisiones: status ${geoResp.status}`);
          }
          const geojson = await geoResp.json();
          this.data.subdivisionsGeoJson = geojson;
          this.data.subdivisionsByCountry = this._indexSubdivisions(geojson);

          if (metaResp && metaResp.ok) {
            try {
              this.data.subdivisionsMeta = await metaResp.json();
            } catch (mErr) {
              console.warn('[WorldMap] Advertencia al parsear subdivisions_meta.json:', mErr);
              this.data.subdivisionsMeta = {};
            }
          }

          console.log(`[WorldMap] Subdivisiones L1 indexadas: ${geojson.features?.length || 0} entidades en memoria.`);
          return geojson;
        } catch (err) {
          console.error('[WorldMap] Error cargando subdivisions.geojson:', err);
          return null;
        } finally {
          this._subdivisionsPromise = null;
        }
      })();

      return this._subdivisionsPromise;
    },

    /**
     * Obtiene metadatos enriquecidos de una subdivisión territorial (tipo, población, etc.).
     * @param {string} countryName 
     * @param {string} divisionName 
     * @returns {Object|null}
     */
    getSubdivisionMeta(countryName, divisionName) {
      if (!this.data.subdivisionsMeta || !countryName || !divisionName) return null;

      const countryData = this.data.subdivisionsMeta[countryName];
      if (countryData && countryData[divisionName]) {
        return countryData[divisionName];
      }

      // Búsqueda insensible a mayúsculas
      const lowerCountry = countryName.toLowerCase();
      let matchedCountryData = null;
      for (const [cName, val] of Object.entries(this.data.subdivisionsMeta)) {
        if (cName.toLowerCase() === lowerCountry) {
          matchedCountryData = val;
          break;
        }
      }

      if (matchedCountryData) {
        if (matchedCountryData[divisionName]) {
          return matchedCountryData[divisionName];
        }
        const lowerDiv = divisionName.toLowerCase();
        for (const [dName, dVal] of Object.entries(matchedCountryData)) {
          if (dName.toLowerCase() === lowerDiv) {
            return dVal;
          }
        }
      }

      return null;
    },

    /**
     * Indexa las geometrías de subdivisiones por país en un Map para acceso O(1).
     * @private
     */
    _indexSubdivisions(geojson) {
      const index = new Map();
      if (!geojson || !geojson.features) return index;

      for (const feature of geojson.features) {
        const country = feature.properties?.country;
        if (country) {
          if (!index.has(country)) {
            index.set(country, []);
          }
          index.get(country).push(feature);
        }
      }
      return index;
    },

    /**
     * Obtiene los features subnacionales pertenecientes a un país específico.
     * @param {string} countryName 
     * @returns {Array}
     */
    getSubdivisionsForCountry(countryName) {
      if (!countryName || !this.data.subdivisionsByCountry) return [];

      // Coincidencia exacta de nombre
      if (this.data.subdivisionsByCountry.has(countryName)) {
        return this.data.subdivisionsByCountry.get(countryName);
      }

      // Búsqueda insensible a mayúsculas/minúsculas
      const lower = countryName.toLowerCase();
      for (const [cName, features] of this.data.subdivisionsByCountry.entries()) {
        if (cName.toLowerCase() === lower) {
          return features;
        }
      }

      return [];
    },

    /**
     * Renderizado de Nivel 1 (L1): Dibuja las divisiones del país enfocado (SPEC-08).
     * @param {Object} country Objeto de país seleccionado
     * @returns {Promise<{success: boolean, count: number}>}
     */
    async renderL1(country) {
      if (!country) {
        this.clearL1();
        return { success: false, count: 0, reason: 'no_country' };
      }

      // Asegurar que las geometrías subnacionales estén cargadas
      await this.loadSubdivisions();

      const countryName = country.name || country.feature?.properties?.name;
      const subdivisions = this.getSubdivisionsForCountry(countryName);

      if (!subdivisions || subdivisions.length === 0) {
        console.warn(`[WorldMap] No se encontraron polígonos L1 para "${countryName}".`);
        // Mantener contorno nacional activo sin atenuación destructiva
        this.layers.subdivisions.selectAll('*').remove();
        return { success: false, count: 0, reason: 'no_geometries' };
      }

      // 1. Atenuación suave de regiones y países vecinos (SPEC-08)
      this.layers.countries.classed('dimmed-layer', true);

      // 2. Inyección y renderizado de la capa subnacional (#layer-subdivisions)
      this.layers.subdivisions.selectAll('*').remove();

      this.layers.subdivisions
        .selectAll('path.division-path')
        .data(subdivisions, (d, i) => d.id || `${d.properties?.name || 'subdiv'}-${i}`)
        .join('path')
        .attr('class', 'division-path subdivision-path')
        .attr('id', (d, i) => `subdiv-${(d.properties?.name || 'div').replace(/\s+/g, '-').toLowerCase()}-${i}`)
        .attr('data-name', d => d.properties?.name || '')
        .attr('data-country', d => d.properties?.country || countryName)
        .attr('data-type', d => d.properties?.type || 'División')
        .attr('d', this.pathGenerator);

      // SPEC-09: Enlazar interactividad subnacional si WorldInteraction está inicializado
      if (typeof globalThis !== 'undefined' && globalThis.WorldInteraction && typeof globalThis.WorldInteraction.bindSubdivisionEvents === 'function') {
        globalThis.WorldInteraction.bindSubdivisionEvents(country);
      }

      console.log(`[WorldMap] L1 renderizado con éxito: ${subdivisions.length} divisiones de "${countryName}".`);
      return { success: true, count: subdivisions.length, features: subdivisions };
    },

    /**
     * Limpia la capa subnacional y restaura la opacidad global de L0 (SPEC-08).
     */
    clearL1() {
      this.clearL2();
      if (this.layers?.subdivisions) {
        this.layers.subdivisions.selectAll('*').remove();
      }
      if (this.layers?.countries) {
        this.layers.countries.classed('dimmed-layer', false);
      }
    },

    /**
     * Carga bajo demanda ($O(1)$) e indexa geometrías distritales de Nivel 2 (SPEC-10).
     * @param {string} regionName Nombre de la división/departamento
     * @returns {Promise<Object|null>} GeoJSON de distritos o null
     */
    async loadDistricts(regionName) {
      if (!regionName) return null;
      const normalized = regionName.toLowerCase().trim();

      if (!this.data.districtsCache) {
        this.data.districtsCache = {};
      }

      if (this.data.districtsCache[normalized]) {
        return this.data.districtsCache[normalized];
      }

      // Piloto territorial de alta resolución: Lima / Lima Province / Lima Metropolitana
      if (normalized.includes('lima')) {
        try {
          const resp = await fetch('data/districts_lima.geojson');
          if (!resp.ok) {
            throw new Error(`HTTP error ${resp.status}`);
          }
          const geojson = await resp.json();
          // Sanitización de winding order: invertir anillos si el polígono cubre más de media esfera terrestre
          if (geojson && geojson.features) {
            geojson.features.forEach(f => {
              if (f.geometry && typeof d3.geoArea === 'function' && d3.geoArea(f) > 2 * Math.PI) {
                if (f.geometry.type === 'Polygon') {
                  f.geometry.coordinates = f.geometry.coordinates.map(ring => ring.slice().reverse());
                } else if (f.geometry.type === 'MultiPolygon') {
                  f.geometry.coordinates = f.geometry.coordinates.map(poly => poly.map(ring => ring.slice().reverse()));
                }
              }
            });
          }
          this.data.districtsCache['lima'] = geojson;
          this.data.districtsCache['lima province'] = geojson;
          this.data.districtsCache[normalized] = geojson;
          return geojson;
        } catch (err) {
          console.error('[WorldMap] Error cargando data/districts_lima.geojson:', err);
          return null;
        }
      }

      // Regiones sin dataset distrital aún compilado (dispara fallback elegante SPEC-10)
      return null;
    },

    /**
     * Renderizado de Nivel 2 (L2): Polígonos distritales con atenuación L1 y zoom cinemático (SPEC-10).
     * @param {Object} division Objeto de la división territorial seleccionada
     * @returns {Promise<{success: boolean, count: number, reason?: string, features?: Array, divisionName?: string}>}
     */
    async renderL2(division) {
      if (!division) {
        this.clearL2();
        return { success: false, count: 0, reason: 'no_division' };
      }

      const divName = division.name || division.feature?.properties?.name || '';
      const geojson = await this.loadDistricts(divName);

      if (!geojson || !geojson.features || geojson.features.length === 0) {
        console.warn(`[WorldMap] No se encontraron geometrías L2 para "${divName}".`);
        if (this.layers?.districts) {
          this.layers.districts.selectAll('*').remove();
        }
        return { success: false, count: 0, reason: 'no_geometries', divisionName: divName };
      }

      // 1. Atenuación de fondo a la capa L1 (.dimmed-layer) (SPEC-10)
      if (this.layers?.subdivisions) {
        this.layers.subdivisions.classed('dimmed-layer', true);
      }

      // 2. Inyección y renderizado de la capa distrital (#layer-districts)
      this.layers.districts.selectAll('*').remove();

      this.layers.districts
        .selectAll('path.district-path')
        .data(geojson.features, (d, i) => d.id || `${d.properties?.name || 'district'}-${i}`)
        .join('path')
        .attr('class', 'district-path')
        .attr('id', (d, i) => `district-${(d.properties?.name || 'dist').replace(/\s+/g, '-').toLowerCase()}-${i}`)
        .attr('data-name', d => d.properties?.name || '')
        .attr('data-province', d => d.properties?.province || 'Lima')
        .attr('data-department', d => d.properties?.department || 'Lima')
        .attr('data-type', d => d.properties?.type || 'Distrito')
        .attr('d', this.pathGenerator);

      // 3. Ajuste cinemático de cámara con transición suave de 750ms sobre los límites
      if (geojson && geojson.features && geojson.features.length > 0) {
        this.zoomToFeature(geojson, 750);
      } else if (division.feature) {
        this.zoomToFeature(division.feature, 750);
      }

      // 4. Enlazar interactividad distrital si WorldInteraction existe
      if (typeof globalThis !== 'undefined' && globalThis.WorldInteraction && typeof globalThis.WorldInteraction.bindDistrictEvents === 'function') {
        globalThis.WorldInteraction.bindDistrictEvents(division, geojson);
      }

      console.log(`[WorldMap] L2 renderizado con éxito: ${geojson.features.length} distritos en "${divName}".`);
      return { success: true, count: geojson.features.length, features: geojson.features };
    },

    /**
     * Limpia la capa distrital y restaura la vista L1 (SPEC-10).
     */
    clearL2() {
      if (this.layers?.districts) {
        this.layers.districts.selectAll('*').remove();
      }
      if (this.layers?.subdivisions) {
        this.layers.subdivisions.classed('dimmed-layer', false);
      }
    },

    /**
     * Renderizado inicial de Nivel 0 (Esfera, Retícula y Países).
     */
    renderL0() {
      if (!this.data.worldGeoJson) return;

      const width = this.container.clientWidth || window.innerWidth;
      const height = this.container.clientHeight || window.innerHeight;

      // Calcular encaje de proyección
      this._updateProjectionFit(width, height);

      // 1. Capa de Esfera Oceánica
      this.layers.sphere.selectAll('*').remove();
      this.layers.sphere
        .append('path')
        .datum({ type: 'Sphere' })
        .attr('class', 'layer-sphere')
        .attr('d', this.pathGenerator);

      // 2. Capa de Retícula (Graticule)
      this.layers.graticule.selectAll('*').remove();
      const graticule = d3.geoGraticule10();
      this.layers.graticule
        .append('path')
        .datum(graticule)
        .attr('d', this.pathGenerator);

      // 3. Capa de Países (L0)
      this.layers.countries.selectAll('*').remove();
      const countryFeatures = this.data.worldGeoJson.features || [];

      this.layers.countries
        .selectAll('path.country-path')
        .data(countryFeatures, d => d.id || d.properties.name)
        .join('path')
        .attr('class', 'country-path')
        .attr('id', d => `country-${d.id || d.properties.name.replace(/\s+/g, '-').toLowerCase()}`)
        .attr('data-iso', d => d.id || '')
        .attr('data-name', d => d.properties?.name || '')
        .attr('d', this.pathGenerator);

      console.log(`[WorldMap] L0 renderizado exitosamente: ${countryFeatures.length} países cargados.`);
    },

    /**
     * Vuelve a proyectar todos los paths activos cuando cambia la proyección.
     * @private
     */
    _renderAllPaths() {
      this.layers.sphere.selectAll('path').attr('d', this.pathGenerator);
      this.layers.graticule.selectAll('path').attr('d', this.pathGenerator);
      this.layers.countries.selectAll('path.country-path').attr('d', this.pathGenerator);
      this.layers.subdivisions.selectAll('path.subdivision-path, path.division-path').attr('d', this.pathGenerator);
      if (this.layers.districts) {
        this.layers.districts.selectAll('path.district-path').attr('d', this.pathGenerator);
      }
    },

    /**
     * Restablece el zoom suavemente a la vista global (SPEC-07).
     * @param {number} duration Duración en milisegundos (750ms por defecto)
     */
    resetZoom(duration = 750) {
      if (!this.svg || !this.zoomBehavior) return;
      this.svg.transition()
        .duration(duration)
        .ease(d3.easeCubicOut)
        .call(this.zoomBehavior.transform, d3.zoomIdentity);
    },

    /**
     * Hace zoom animado hacia los límites de una entidad geográfica específica (SPEC-07).
     * @param {Object} geoFeature Entidad GeoJSON
     * @param {number} duration Duración de la transición en ms (750ms por defecto)
     */
    zoomToFeature(geoFeature, duration = 750) {
      if (!geoFeature || !this.svg || !this.zoomBehavior) return;

      const bounds = this.pathGenerator.bounds(geoFeature);
      const dx = bounds[1][0] - bounds[0][0];
      const dy = bounds[1][1] - bounds[0][1];
      const x = (bounds[0][0] + bounds[1][0]) / 2;
      const y = (bounds[0][1] + bounds[1][1]) / 2;

      const width = this.container.clientWidth || window.innerWidth;
      const height = this.container.clientHeight || window.innerHeight;

      // SPEC-07 & SPEC-10: Escala y traslación óptimas con padding del 20%
      // Límites de escala: hasta 220 para distritos/ciudades locales (L2), hasta 12 para países/provincias
      const isL2 = geoFeature.type === 'FeatureCollection' || geoFeature.properties?.type === 'Distrito';
      const maxScaleCeiling = isL2 ? 220 : 12;
      const maxDimRatio = Math.max(dx / width, dy / height);
      const scale = maxDimRatio > 0 ? Math.max(1, Math.min(maxScaleCeiling, 0.8 / maxDimRatio)) : 1;
      const translate = [width / 2 - scale * x, height / 2 - scale * y];

      const transform = d3.zoomIdentity
        .translate(translate[0], translate[1])
        .scale(scale);

      this.svg.transition()
        .duration(duration)
        .ease(d3.easeCubicOut)
        .call(this.zoomBehavior.transform, transform);
    },

    /**
     * Obtiene los metadatos enriquecidos de un país.
     * @param {string} countryNameOrIso 
     * @returns {Object|null}
     */
    getCountryMeta(countryNameOrIso) {
      if (!countryNameOrIso) return null;
      // Búsqueda por clave directa
      if (this.data.countriesMeta[countryNameOrIso]) {
        return this.data.countriesMeta[countryNameOrIso];
      }
      // Búsqueda insensible a mayúsculas
      const lower = countryNameOrIso.toLowerCase();
      for (const [key, val] of Object.entries(this.data.countriesMeta)) {
        if (key.toLowerCase() === lower || (val.name_es && val.name_es.toLowerCase() === lower)) {
          return val;
        }
      }
      return null;
    }
  };

  // Inicialización automática al cargar el DOM en entorno de navegador
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => WorldMap.init());
    } else {
      WorldMap.init();
    }
  }

  return WorldMap;
});

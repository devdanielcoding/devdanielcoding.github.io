/**
 * World Atlas — Interacción L0: Hover, Tooltip y Buscador (SPEC-05)
 * Gestiona microinteracciones a 60 FPS, tooltips inteligentes y búsqueda instantánea insensible a acentos.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['./state.js', './map.js'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./state.js'), require('./map.js'));
  } else {
    root.WorldInteraction = factory(root.State || root.WorldAtlasState, root.WorldMap);
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function (State, WorldMap) {
  'use strict';

  // Función utilitaria para normalizar texto (sin acentos, diacríticos ni mayúsculas)
  function normalizeStr(text) {
    return (text || '')
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  /* ==========================================================================
     1. GESTOR DE TOOLTIP (#tooltip)
     ========================================================================== */
  const Tooltip = {
    el: null,
    flagEl: null,
    titleEl: null,
    subtitleEl: null,
    visible: false,

    init() {
      this.el = document.getElementById('tooltip');
      if (!this.el) return;
      this.flagEl = document.getElementById('tooltip-flag');
      this.titleEl = document.getElementById('tooltip-title');
      this.subtitleEl = document.getElementById('tooltip-subtitle');
    },

    show(data, clientX, clientY) {
      if (!this.el) return;

      const flag = data.flag || '🏳️';
      const title = data.name_es || data.name || 'Territorio';
      const subtitle = data.subtitle || (data.capital ? `Capital: ${data.capital}` : 'Nivel 0 · Soberano');

      if (this.flagEl) this.flagEl.textContent = flag;
      if (this.titleEl) this.titleEl.textContent = title;
      if (this.subtitleEl) this.subtitleEl.textContent = subtitle;

      this.move(clientX, clientY);

      if (!this.visible) {
        this.el.classList.add('tooltip-visible');
        this.el.setAttribute('aria-hidden', 'false');
        this.visible = true;
      }
    },

    move(clientX, clientY) {
      if (!this.el) return;

      // Restricción para evitar desbordar bordes de la pantalla
      const padding = 16;
      const x = Math.max(padding + 60, Math.min(window.innerWidth - padding - 60, clientX));
      const y = Math.max(68, clientY - 14);

      this.el.style.left = `${x}px`;
      this.el.style.top = `${y}px`;
    },

    hide() {
      if (!this.el || !this.visible) return;
      this.el.classList.remove('tooltip-visible');
      this.el.setAttribute('aria-hidden', 'true');
      this.visible = false;
    }
  };

  /* ==========================================================================
     2. GESTOR DEL BUSCADOR EN TIEMPO REAL (#search-container)
     ========================================================================== */
  const Search = {
    container: null,
    input: null,
    clearBtn: null,
    resultsEl: null,
    searchIndex: [],
    highlightedIndex: -1,
    currentResults: [],

    init() {
      this.container = document.getElementById('search-container');
      this.input = document.getElementById('search-input');
      this.clearBtn = document.getElementById('search-clear-btn');
      this.resultsEl = document.getElementById('search-results');

      if (!this.input || !this.resultsEl) return;

      this._bindEvents();
    },

    /**
     * Construye el índice de búsqueda en memoria cruzando países y metadatos.
     */
    buildIndex(worldGeoJson, countriesMeta) {
      if (!worldGeoJson || !worldGeoJson.features) return;

      this.searchIndex = worldGeoJson.features.map(feature => {
        const id = feature.id || '';
        const name = feature.properties?.name || '';
        const meta = countriesMeta[name] || countriesMeta[id] || {};

        return {
          feature,
          id,
          name,
          name_es: meta.name_es || name,
          capital: meta.capital || '',
          continent: meta.continent || '',
          flag: meta.flag || '🏳️',
          fact: meta.fact || '',
          divisionsCount: meta.divisionsCount || 0,
          hasLevel1: meta.hasLevel1 !== false && ((meta.divisionsCount || 0) > 0),
          // Campos normalizados para búsqueda de alta velocidad
          normName: normalizeStr(name),
          normNameEs: normalizeStr(meta.name_es || ''),
          normCapital: normalizeStr(meta.capital || ''),
          normId: normalizeStr(id)
        };
      });
    },

    _bindEvents() {
      this.input.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        if (this.clearBtn) {
          this.clearBtn.style.display = query.length > 0 ? 'flex' : 'none';
        }
        this.search(query);
      });

      if (this.clearBtn) {
        this.clearBtn.addEventListener('click', () => {
          this.input.value = '';
          this.clearBtn.style.display = 'none';
          this.hideResults();
          this.input.focus();
        });
      }

      // Navegación por teclado (Flechas, Enter, Escape)
      this.input.addEventListener('keydown', (e) => {
        if (!this.resultsEl.classList.contains('visible') || this.currentResults.length === 0) {
          if (e.key === 'Escape') this.hideResults();
          return;
        }

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.highlightedIndex = Math.min(this.currentResults.length - 1, this.highlightedIndex + 1);
          this._updateHighlightedItem();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.highlightedIndex = Math.max(0, this.highlightedIndex - 1);
          this._updateHighlightedItem();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          const target = this.highlightedIndex >= 0 ? this.currentResults[this.highlightedIndex] : this.currentResults[0];
          if (target) this.selectItem(target);
        } else if (e.key === 'Escape') {
          this.hideResults();
        }
      });

      // Cierre al hacer click fuera del buscador
      document.addEventListener('click', (e) => {
        if (this.container && !this.container.contains(e.target)) {
          this.hideResults();
        }
      });

      // Foco vuelve a abrir resultados si hay texto
      this.input.addEventListener('focus', () => {
        if (this.input.value.trim().length > 0) {
          this.search(this.input.value.trim());
        }
      });
    },

    search(rawQuery) {
      const q = normalizeStr(rawQuery);
      if (!q) {
        this.hideResults();
        return;
      }

      // Coincidencias ponderadas (prioridad: nombre exacto / prefijo > contiene > capital)
      const scored = [];
      for (const item of this.searchIndex) {
        let score = 0;
        if (item.normNameEs === q || item.normName === q || item.normId === q) {
          score = 100;
        } else if (item.normNameEs.startsWith(q) || item.normName.startsWith(q)) {
          score = 80;
        } else if (item.normNameEs.includes(q) || item.normName.includes(q)) {
          score = 60;
        } else if (item.normCapital.startsWith(q)) {
          score = 40;
        } else if (item.normCapital.includes(q)) {
          score = 25;
        }

        if (score > 0) {
          scored.push({ item, score });
        }
      }

      // Ordenar por relevancia y limitar a top 12 resultados
      scored.sort((a, b) => b.score - a.score);
      this.currentResults = scored.slice(0, 12).map(s => s.item);
      this.highlightedIndex = this.currentResults.length > 0 ? 0 : -1;

      this.renderResults(rawQuery);
    },

    renderResults(query) {
      this.resultsEl.innerHTML = '';

      if (this.currentResults.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'search-empty-state';
        emptyDiv.textContent = `No se hallaron territorios para "${query}"`;
        this.resultsEl.appendChild(emptyDiv);
      } else {
        this.currentResults.forEach((res, index) => {
          const itemEl = document.createElement('div');
          itemEl.className = `search-result-item ${index === this.highlightedIndex ? 'highlighted' : ''}`;
          itemEl.setAttribute('role', 'button');
          itemEl.setAttribute('tabindex', '0');

          itemEl.innerHTML = `
            <span class="search-result-flag">${res.flag}</span>
            <div class="search-result-info">
              <span class="search-result-name">${res.name_es}</span>
              <span class="search-result-meta">${res.capital ? `Capital: ${res.capital} · ` : ''}${res.continent || 'Mundo'}</span>
            </div>
          `;

          itemEl.addEventListener('click', () => this.selectItem(res));
          itemEl.addEventListener('mouseenter', () => {
            this.highlightedIndex = index;
            this._updateHighlightedItem();
          });

          this.resultsEl.appendChild(itemEl);
        });
      }

      this.resultsEl.classList.add('visible');
    },

    _updateHighlightedItem() {
      const items = this.resultsEl.querySelectorAll('.search-result-item');
      items.forEach((item, idx) => {
        item.classList.toggle('highlighted', idx === this.highlightedIndex);
        if (idx === this.highlightedIndex) {
          item.scrollIntoView({ block: 'nearest' });
        }
      });
    },

    selectItem(item) {
      if (!item) return;

      this.input.value = item.name_es;
      this.hideResults();

      // Despacha la selección al gestor de estado (dispara zoom cinemático y panel reactivo)
      State.selectCountry({
        feature: item.feature,
        id: item.id,
        name: item.name,
        name_es: item.name_es,
        flag: item.flag,
        capital: item.capital,
        continent: item.continent,
        fact: item.fact,
        divisionsCount: item.divisionsCount,
        hasLevel1: item.hasLevel1
      });
    },

    hideResults() {
      if (this.resultsEl) {
        this.resultsEl.classList.remove('visible');
      }
      this.highlightedIndex = -1;
    }
  };

  /**
   * Resalta visualmente el país activo en el mapa SVG.
   */
  function highlightSelectedCountry(feature) {
    if (!WorldMap.layers?.countries) return;

    WorldMap.layers.countries.selectAll('.country-path').classed('selected', false);

    if (feature) {
      const iso = feature.id;
      const name = feature.properties?.name;
      WorldMap.layers.countries.selectAll('.country-path')
        .filter(d => (iso && d.id === iso) || (d.properties?.name === name))
        .classed('selected', true);
    }
  }

  /**
   * Traduce o estandariza el tipo de división subnacional al castellano (SPEC-09).
   */
  function formatDivisionType(type) {
    if (!type) return 'División';
    const map = {
      'Department': 'Departamento',
      'Departamento': 'Departamento',
      'Province': 'Provincia',
      'State': 'Estado',
      'Region': 'Región',
      'Autonomous Region': 'Región Autónoma',
      'Federal District': 'Distrito Federal',
      'Capital District': 'Distrito Capital',
      'Captial District': 'Distrito Capital',
      'National Territory': 'Territorio Nacional',
      'Special Municipality': 'Municipio Especial',
      'County': 'Condado',
      'Municipality': 'Municipio',
      'District': 'Distrito',
      'Territory': 'Territorio',
      'City': 'Ciudad',
      'Division': 'División',
      'Cantone': 'Cantón',
      'Voivodeship': 'Voivodato',
      'Prefecture': 'Prefectura',
      'Governorate': 'Gobernación',
      'Intendancy': 'Intendencia',
      'Commissiary': 'Comisaría',
      'Federal Dependency': 'Dependencia Federal'
    };
    return map[type] || type;
  }

  /**
   * Resalta visualmente la división territorial activa en el mapa SVG (SPEC-09).
   */
  function highlightSelectedDivision(feature) {
    if (!WorldMap.layers?.subdivisions) return;

    WorldMap.layers.subdivisions.selectAll('.division-path, .subdivision-path').classed('selected', false);

    if (feature) {
      const name = feature.properties?.name;
      WorldMap.layers.subdivisions.selectAll('.division-path, .subdivision-path')
        .filter(d => d.properties?.name === name)
        .classed('selected', true);
    }
  }

  /**
   * Resalta visualmente el distrito activo en el mapa SVG (SPEC-10).
   */
  function highlightSelectedDistrict(feature) {
    if (!WorldMap.layers?.districts) return;

    WorldMap.layers.districts.selectAll('.district-path').classed('selected', false);

    if (feature) {
      const name = feature.properties?.name;
      WorldMap.layers.districts.selectAll('.district-path')
        .filter(d => d.properties?.name === name)
        .classed('selected', true);
    }
  }

  /* ==========================================================================
     3. GESTOR DEL PANEL INFORMATIVO LATERAL (#info-panel) (SPEC-06 / SPEC-09 / SPEC-13)
     ========================================================================== */

  /**
   * Catálogo de acceso directo a capitales de Nivel 2 ($O(1)$) (SPEC-13).
   * Mapea país a los identificadores de división territorial en Natural Earth.
   */
  const COUNTRY_CAPITAL_SHORTCUTS = {
    'chile': { capital: 'Santiago', divisionQuery: 'región metropolitana de santiago', slug: 'santiago', type: 'Comunas' },
    'argentina': { capital: 'Buenos Aires (CABA)', divisionQuery: 'ciudad de buenos aires', slug: 'buenos-aires', type: 'Comunas' },
    'colombia': { capital: 'Bogotá D.C.', divisionQuery: 'bogota', slug: 'bogota', type: 'Localidades' },
    'peru': { capital: 'Lima Metropolitana', divisionQuery: 'lima province', slug: 'lima', type: 'Distritos' },
    'perú': { capital: 'Lima Metropolitana', divisionQuery: 'lima province', slug: 'lima', type: 'Distritos' },
    'uruguay': { capital: 'Montevideo', divisionQuery: 'montevideo', slug: 'montevideo', type: 'Barrios' },
    'brazil': { capital: 'Brasília', divisionQuery: 'distrito federal', slug: 'brasilia', type: 'Regiões Administrativas' },
    'brasil': { capital: 'Brasília', divisionQuery: 'distrito federal', slug: 'brasilia', type: 'Regiões Administrativas' },
    'ecuador': { capital: 'Quito', divisionQuery: 'pichincha', slug: 'quito', type: 'Parroquias' }
  };

  /**
   * Obtiene la configuración de atajo a capital L2 para un país dado.
   * @param {Object} country Objeto de país seleccionado
   * @returns {Object|null}
   */
  function getCapitalShortcut(country) {
    if (!country) return null;
    const name = (country.name || '').toLowerCase().trim();
    const nameEs = (country.name_es || '').toLowerCase().trim();
    return COUNTRY_CAPITAL_SHORTCUTS[name] || COUNTRY_CAPITAL_SHORTCUTS[nameEs] || null;
  }

  const InfoPanel = {
    panelEl: null,
    flagEl: null,
    titleEl: null,
    subtitleEl: null,
    capitalEl: null,
    continentEl: null,
    metricLabel1: null,
    metricLabel2: null,
    curiosityIcon: null,
    curiosityTitle: null,
    curiosityEl: null,
    badgeIsoEl: null,
    badgeLevelEl: null,
    badgeDivisionsEl: null,
    closeBtn: null,
    exploreBtn: null,
    btnExploreCapital: null,
    btnExploreCapitalText: null,
    btnOpenL2: null,
    btnBackDivision: null,
    btnBackCountry: null,
    backBtn: null,
    crumbWorld: null,
    crumbCountry: null,
    crumbSepCountry: null,
    crumbDivision: null,
    crumbSepSub: null,
    crumbDistrict: null,
    crumbSepDistrict: null,
    emptyNoticeL2El: null,
    levelText: null,
    brandTag: null,

    init() {
      this.panelEl = document.getElementById('info-panel');
      if (!this.panelEl) return;

      this.flagEl = document.getElementById('panel-flag');
      this.titleEl = document.getElementById('panel-title');
      this.subtitleEl = document.getElementById('panel-subtitle');
      this.capitalEl = document.getElementById('panel-capital');
      this.continentEl = document.getElementById('panel-continent');
      this.metricLabel1 = document.getElementById('panel-metric-label-1');
      this.metricLabel2 = document.getElementById('panel-metric-label-2');
      this.curiosityIcon = document.getElementById('curiosity-icon');
      this.curiosityTitle = document.getElementById('curiosity-title-text');
      this.curiosityEl = document.getElementById('panel-curiosity');
      this.badgeIsoEl = document.getElementById('badge-iso');
      this.badgeLevelEl = document.getElementById('badge-level');
      this.badgeDivisionsEl = document.getElementById('badge-subdivisions-count');
      this.emptyNoticeEl = document.getElementById('panel-l1-empty-notice');
      this.emptyNoticeL2El = document.getElementById('panel-l2-empty-notice');
      this.closeBtn = document.getElementById('btn-close-panel');
      this.exploreBtn = document.getElementById('btn-explore-l1');
      this.btnExploreCapital = document.getElementById('btn-explore-capital');
      this.btnExploreCapitalText = document.getElementById('btn-explore-capital-text');
      this.btnOpenL2 = document.getElementById('btn-open-l2');
      this.btnBackDivision = document.getElementById('btn-back-division');
      this.btnBackCountry = document.getElementById('btn-back-country');
      this.backBtn = document.getElementById('btn-back');

      this.crumbWorld = document.getElementById('crumb-world');
      this.crumbCountry = document.getElementById('crumb-country');
      this.crumbSepCountry = document.getElementById('crumb-sep-country');
      this.crumbDivision = document.getElementById('crumb-division');
      this.crumbSepSub = document.getElementById('crumb-sep-sub');
      this.crumbDistrict = document.getElementById('crumb-district');
      this.crumbSepDistrict = document.getElementById('crumb-sep-district');
      this.levelText = document.getElementById('level-text');
      this.brandTag = document.querySelector('#brand-link .brand-tag');

      this._bindEvents();
    },

    _bindEvents() {
      // Botón cerrar panel (×)
      if (this.closeBtn) {
        this.closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const state = State.getState();
          if (state.selectedDivision) {
            State.selectDivision(null);
          } else {
            State.selectCountry(null);
          }
        });
      }

      // Clic en miga de pan "Mundo" -> SPEC-07: retorno suave a L0 con zoom completo del globo
      if (this.crumbWorld) {
        this.crumbWorld.addEventListener('click', () => {
          State.resetToWorld();
        });
      }

      // Clic en miga de pan "País" -> deseleccionar división y re-centrar cámara en país
      if (this.crumbCountry) {
        this.crumbCountry.addEventListener('click', () => {
          const state = State.getState();
          if (state.selectedDivision) {
            State.selectDivision(null);
          }
          if (state.selectedCountry?.feature) {
            WorldMap.zoomToFeature(state.selectedCountry.feature, 750);
          }
        });
      }

      // Clic en miga de pan "Región / División" (SPEC-09)
      if (this.crumbDivision) {
        this.crumbDivision.addEventListener('click', () => {
          const state = State.getState();
          if (state.selectedDistrict) {
            State.selectDistrict(null);
          }
          if (state.selectedDivision?.feature) {
            WorldMap.zoomToFeature(state.selectedDivision.feature, 750);
          }
        });
      }

      // Clic en miga de pan "Distrito" (SPEC-10)
      if (this.crumbDistrict) {
        this.crumbDistrict.addEventListener('click', () => {
          const state = State.getState();
          if (state.selectedDistrict?.feature) {
            WorldMap.zoomToFeature(state.selectedDistrict.feature, 750);
          }
        });
      }

      // Botón volver a la Región / Nivel 1 (SPEC-10)
      if (this.btnBackDivision) {
        this.btnBackDivision.addEventListener('click', () => {
          const state = State.getState();
          if (state.selectedDistrict) {
            State.selectDistrict(null);
          } else {
            State.setLevel(1);
          }
        });
      }

      // Botón volver al País (L1) (SPEC-09)
      if (this.btnBackCountry) {
        this.btnBackCountry.addEventListener('click', () => {
          State.selectDivision(null);
          State.setLevel(1);
          const current = State.getState().selectedCountry;
          if (current?.feature) {
            WorldMap.zoomToFeature(current.feature, 750);
          }
        });
      }

      // Botón Abrir Ficha Local (Nivel 2) (SPEC-09 -> SPEC-10)
      if (this.btnOpenL2) {
        this.btnOpenL2.addEventListener('click', () => {
          State.setLevel(2);
        });
      }

      // Botón volver al Mundo (L0)
      if (this.backBtn) {
        this.backBtn.addEventListener('click', () => {
          State.resetToWorld();
        });
      }

      // Botón Explorar Divisiones (L1) -> SPEC-07: zoom cinemático y transición a L1
      if (this.exploreBtn) {
        this.exploreBtn.addEventListener('click', () => {
          const current = State.getState().selectedCountry;
          if (current && (current.hasLevel1 || current.divisionsCount > 0)) {
            State.setLevel(1);
          }
        });
      }

      // Botón Atajo Ergonómico a Capital L2 (SPEC-13)
      if (this.btnExploreCapital) {
        this.btnExploreCapital.addEventListener('click', async (e) => {
          e.stopPropagation();
          const state = State.getState();
          const country = state.selectedCountry;
          if (!country) return;

          const shortcut = getCapitalShortcut(country);
          if (!shortcut) return;

          // 1. Asegurar carga de divisiones L1 si no están en memoria
          await WorldMap.loadSubdivisions();

          // 2. Si estamos en L0, renderizar L1 primero para tener la capa base activa y atenuada
          if (state.currentLevel === 0) {
            await WorldMap.renderL1(country);
          }

          // 3. Localizar el feature de la capital dentro de las divisiones del país
          const countryName = country.name || country.feature?.properties?.name;
          const subdivisions = WorldMap.getSubdivisionsForCountry(countryName);
          const targetQuery = shortcut.divisionQuery.toLowerCase();

          let targetFeature = subdivisions.find(f => {
            const fName = (f.properties?.name || '').toLowerCase();
            return fName.includes(targetQuery) || targetQuery.includes(fName);
          });

          if (!targetFeature) {
            const capQuery = shortcut.capital.toLowerCase();
            targetFeature = subdivisions.find(f => {
              const fName = (f.properties?.name || '').toLowerCase();
              return fName.includes(capQuery) || capQuery.includes(fName) || fName.includes(shortcut.slug);
            });
          }

          const divName = targetFeature?.properties?.name || shortcut.capital;
          const rawType = targetFeature?.properties?.type || 'Distrito Federal';
          const typeEs = formatDivisionType(rawType);
          const meta = WorldMap.getSubdivisionMeta(countryName, divName) || {};
          const population = meta.population || targetFeature?.properties?.population;

          const divisionData = {
            feature: targetFeature || null,
            name: divName,
            type: rawType,
            type_es: typeEs,
            population: population,
            parentCountry: country,
            isCapital: true
          };

          // 4. Sincronizar estado (seleccionar división y activar L2)
          State.selectDivision(divisionData);
          State.setLevel(2);
        });
      }

      // Tecla Escape secuencial: repliega de distrito a división, de división a mundo (SPEC-10)
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          const state = State.getState();
          if (state.selectedDistrict) {
            State.selectDistrict(null);
          } else if (state.currentLevel === 2) {
            State.setLevel(1);
          } else if (state.selectedDivision) {
            State.selectDivision(null);
          } else if (state.currentLevel > 0) {
            State.resetToWorld();
          } else if (this.panelEl && this.panelEl.classList.contains('panel-visible')) {
            State.selectCountry(null);
          }
        }
      });
    },

    show(country) {
      if (!this.panelEl || !country) return;

      const flag = country.flag || '🏳️';
      const nameEs = country.name_es || country.name || 'Territorio';
      const nameEn = country.name && country.name !== nameEs ? ` · ${country.name}` : '';
      const capital = country.capital ? country.capital : 'Sin capital registrada';
      const continent = country.continent || 'Mundo';
      const fact = country.fact || 'Territorio soberano con características geográficas y culturales destacadas.';
      const iso = country.id || country.feature?.id || '--';
      const divisionsCount = country.divisionsCount || 0;
      const hasL1 = country.hasLevel1 !== false && divisionsCount > 0;

      // Encabezado
      if (this.flagEl) this.flagEl.textContent = flag;
      if (this.titleEl) this.titleEl.textContent = nameEs;
      if (this.subtitleEl) this.subtitleEl.textContent = `Nivel 0 · Soberano${nameEn}`;

      // Métricas y curiosidad (restauradas a país)
      if (this.metricLabel1) this.metricLabel1.textContent = 'Capital';
      if (this.metricLabel2) this.metricLabel2.textContent = 'Continente';
      if (this.capitalEl) this.capitalEl.textContent = `📍 ${capital}`;
      if (this.continentEl) this.continentEl.textContent = `🌐 ${continent}`;

      if (this.curiosityIcon) this.curiosityIcon.textContent = '✨';
      if (this.curiosityTitle) this.curiosityTitle.textContent = 'Curiosidad Territorial';
      if (this.curiosityEl) this.curiosityEl.textContent = fact;

      // Badges
      if (this.badgeIsoEl) this.badgeIsoEl.textContent = `ISO: ${iso}`;
      if (this.badgeLevelEl) this.badgeLevelEl.textContent = 'Nivel L0';
      if (this.badgeDivisionsEl) {
        if (hasL1) {
          this.badgeDivisionsEl.textContent = `${divisionsCount} divisiones`;
          this.badgeDivisionsEl.className = 'badge badge-emerald';
        } else {
          this.badgeDivisionsEl.textContent = 'Sin divisiones L1';
          this.badgeDivisionsEl.className = 'badge';
        }
      }

      // Botón Explorar L1
      if (this.exploreBtn) {
        this.exploreBtn.style.display = 'inline-flex';
        if (hasL1) {
          this.exploreBtn.disabled = false;
          this.exploreBtn.innerHTML = `<span>🔍</span><span>Explorar Divisiones (${divisionsCount})</span>`;
          this.exploreBtn.title = `Explorar divisiones subnacionales de ${nameEs}`;
          this.exploreBtn.style.opacity = '1';
          this.exploreBtn.style.cursor = 'pointer';
        } else {
          this.exploreBtn.disabled = true;
          this.exploreBtn.innerHTML = `<span>⏳</span><span>Digitalización en Proceso</span>`;
          this.exploreBtn.title = 'Divisiones detalladas en proceso de digitalización';
          this.exploreBtn.style.opacity = '0.65';
          this.exploreBtn.style.cursor = 'not-allowed';
        }
      }

      // Atajo ergonómico a Capital L2 (SPEC-13)
      const shortcut = getCapitalShortcut(country);
      if (this.btnExploreCapital) {
        if (shortcut) {
          this.btnExploreCapital.style.display = 'inline-flex';
          if (this.btnExploreCapitalText) {
            this.btnExploreCapitalText.textContent = `Ver Desglose de ${shortcut.capital} (L2)`;
          }
          this.btnExploreCapital.title = `Explorar desglose de ${shortcut.type} de ${shortcut.capital} (Nivel 2)`;
        } else {
          this.btnExploreCapital.style.display = 'none';
        }
      }

      // Ocultar botones de nivel subnacional si estamos mostrando el país
      if (this.btnOpenL2) this.btnOpenL2.style.display = 'none';
      if (this.btnBackDivision) this.btnBackDivision.style.display = 'none';
      if (this.btnBackCountry) this.btnBackCountry.style.display = 'none';

      // Aviso elegante para países sin geometría L1 (SPEC-08)
      if (this.emptyNoticeEl) {
        this.emptyNoticeEl.style.display = hasL1 ? 'none' : 'flex';
      }
      if (this.emptyNoticeL2El) {
        this.emptyNoticeL2El.style.display = 'none';
      }

      // Ocultar botón volver si estamos en L0
      if (this.backBtn) {
        this.backBtn.style.display = State.getLevel() > 0 ? 'inline-flex' : 'none';
      }

      // Breadcrumb dinámico (SPEC-07)
      if (this.crumbCountry) {
        this.crumbCountry.textContent = `${flag} ${nameEs}`;
        this.crumbCountry.style.display = 'inline-block';
        this.crumbCountry.classList.add('active');
      }
      if (this.crumbSepCountry) {
        this.crumbSepCountry.style.display = 'inline-block';
      }
      if (this.crumbWorld) {
        this.crumbWorld.classList.remove('active');
      }
      if (this.crumbSepSub) {
        this.crumbSepSub.style.display = 'none';
      }
      if (this.crumbDivision) {
        this.crumbDivision.style.display = 'none';
        this.crumbDivision.classList.remove('active');
      }
      if (this.crumbSepDistrict) {
        this.crumbSepDistrict.style.display = 'none';
      }
      if (this.crumbDistrict) {
        this.crumbDistrict.style.display = 'none';
        this.crumbDistrict.classList.remove('active');
      }

      // Apertura fluida
      this.panelEl.classList.remove('panel-hidden');
      this.panelEl.classList.add('panel-visible');
    },

    /**
     * Muestra la ficha territorial detallada de una división subnacional (SPEC-09).
     * @param {Object} division Datos de la división seleccionada
     * @param {Object} parentCountry Datos del país padre
     */
    showDivision(division, parentCountry) {
      if (!this.panelEl || !division) return;

      const pCountry = parentCountry || State.getState().selectedCountry || {};
      const flag = pCountry.flag || '📍';
      const cName = pCountry.name_es || pCountry.name || 'País';
      const divName = division.name || 'División';
      const typeEs = division.type_es || formatDivisionType(division.type);
      const population = division.population;

      // Encabezado
      if (this.flagEl) this.flagEl.textContent = flag;
      if (this.titleEl) this.titleEl.textContent = divName;
      if (this.subtitleEl) this.subtitleEl.textContent = `Nivel 1 · ${typeEs} · ${cName}`;

      // Métricas adaptativas para división
      if (this.metricLabel1) this.metricLabel1.textContent = 'Tipo Administrativo';
      if (this.capitalEl) this.capitalEl.textContent = `🏛️ ${typeEs}`;

      if (this.metricLabel2) {
        if (population) {
          this.metricLabel2.textContent = 'Población Estimada';
          if (this.continentEl) this.continentEl.textContent = `👥 ${Number(population).toLocaleString('es-ES')}`;
        } else {
          this.metricLabel2.textContent = 'País Soberano';
          if (this.continentEl) this.continentEl.textContent = `🌐 ${cName}`;
        }
      }

      // Ficha territorial
      if (this.curiosityIcon) this.curiosityIcon.textContent = '📍';
      if (this.curiosityTitle) this.curiosityTitle.textContent = 'Ficha Subnacional';
      if (this.curiosityEl) {
        const popStr = population ? ` Cuenta con una población censada o proyectada de ${Number(population).toLocaleString('es-ES')} habitantes.` : '';
        this.curiosityEl.textContent = `${divName} constituye un(a) ${typeEs.toLowerCase()} de ${cName}.${popStr} Puedes explorar sus límites subnacionales o abrir su ficha de detalle local.`;
      }

      // Badges
      if (this.badgeIsoEl) this.badgeIsoEl.textContent = `Cat: ${typeEs}`;
      if (this.badgeLevelEl) this.badgeLevelEl.textContent = 'Nivel L1 · Subnacional';
      if (this.badgeDivisionsEl) {
        this.badgeDivisionsEl.textContent = `Territorio: ${cName}`;
        this.badgeDivisionsEl.className = 'badge badge-cyan';
      }

      // Ocultar aviso vacío
      if (this.emptyNoticeEl) this.emptyNoticeEl.style.display = 'none';
      if (this.emptyNoticeL2El) this.emptyNoticeL2El.style.display = 'none';

      // Botones de acción (SPEC-09: botón destacado "Abrir Ficha Local (Nivel 2)")
      if (this.exploreBtn) this.exploreBtn.style.display = 'none';
      if (this.btnExploreCapital) this.btnExploreCapital.style.display = 'none';
      if (this.btnOpenL2) {
        this.btnOpenL2.style.display = 'inline-flex';
        this.btnOpenL2.innerHTML = '<span>📍</span><span>Abrir Ficha Local (Nivel 2)</span>';
      }
      if (this.btnBackDivision) this.btnBackDivision.style.display = 'none';
      if (this.btnBackCountry) {
        this.btnBackCountry.style.display = 'inline-flex';
        this.btnBackCountry.innerHTML = `<span>←</span><span>Volver a ${cName} (L1)</span>`;
      }
      if (this.backBtn) this.backBtn.style.display = 'inline-flex';

      // Breadcrumb multinivel L0 -> L1 -> L1.sub
      if (this.crumbWorld) this.crumbWorld.classList.remove('active');
      if (this.crumbSepCountry) this.crumbSepCountry.style.display = 'inline-block';
      if (this.crumbCountry) {
        this.crumbCountry.textContent = `${flag} ${cName}`;
        this.crumbCountry.style.display = 'inline-block';
        this.crumbCountry.classList.remove('active');
      }
      if (this.crumbSepSub) this.crumbSepSub.style.display = 'inline-block';
      if (this.crumbDivision) {
        this.crumbDivision.textContent = `📍 ${divName}`;
        this.crumbDivision.style.display = 'inline-block';
        this.crumbDivision.classList.add('active');
      }
      if (this.crumbSepDistrict) this.crumbSepDistrict.style.display = 'none';
      if (this.crumbDistrict) {
        this.crumbDistrict.style.display = 'none';
        this.crumbDistrict.classList.remove('active');
      }

      // Despliegue de panel
      this.panelEl.classList.remove('panel-hidden');
      this.panelEl.classList.add('panel-visible');
    },

    /**
     * Muestra la ficha territorial de un distrito local de Nivel 2 (SPEC-10).
     * @param {Object} district Datos del distrito seleccionado
     * @param {Object} parentDivision División territorial padre (ej. Lima)
     * @param {Object} parentCountry País soberano (ej. Perú)
     */
    showDistrict(district, parentDivision, parentCountry) {
      if (!this.panelEl || !district) return;

      const pCountry = parentCountry || State.getState().selectedCountry || {};
      const pDiv = parentDivision || State.getState().selectedDivision || {};
      const flag = pCountry.flag || '📍';
      const cName = pCountry.name_es || pCountry.name || 'País';
      const divName = pDiv.name || 'Jurisdicción';
      const distName = district.name || 'Entidad Local';
      const distType = district.type || district.properties?.type || 'Distrito';

      // Encabezado
      if (this.flagEl) this.flagEl.textContent = flag;
      if (this.titleEl) this.titleEl.textContent = distName;
      if (this.subtitleEl) this.subtitleEl.textContent = `Nivel 2 · ${distType} · ${divName}, ${cName}`;

      // Métricas
      if (this.metricLabel1) this.metricLabel1.textContent = 'Categoría Administrativa';
      if (this.capitalEl) this.capitalEl.textContent = `🏛️ ${distType}`;

      if (this.metricLabel2) this.metricLabel2.textContent = 'Jurisdicción / Metrópoli';
      if (this.continentEl) this.continentEl.textContent = `🏙️ ${divName}`;

      // Ficha territorial
      if (this.curiosityIcon) this.curiosityIcon.textContent = '🏛️';
      if (this.curiosityTitle) this.curiosityTitle.textContent = `Ficha de ${distType}`;
      if (this.curiosityEl) {
        this.curiosityEl.textContent = `${distName} es una demarcación representativa de ${divName} (${cName}). Cuenta con cartografía vectorial de alta precisión en la red metropolitana local.`;
      }

      // Badges
      if (this.badgeIsoEl) this.badgeIsoEl.textContent = `Cat: ${distType}`;
      if (this.badgeLevelEl) this.badgeLevelEl.textContent = 'Nivel L2 · Local';
      if (this.badgeDivisionsEl) {
        this.badgeDivisionsEl.textContent = `Región: ${divName}`;
        this.badgeDivisionsEl.className = 'badge badge-emerald';
      }

      // Avisos
      if (this.emptyNoticeEl) this.emptyNoticeEl.style.display = 'none';
      if (this.emptyNoticeL2El) this.emptyNoticeL2El.style.display = 'none';

      // Botones de acción (SPEC-10 & SPEC-12: retorno a la División y retorno al País)
      if (this.exploreBtn) this.exploreBtn.style.display = 'none';
      if (this.btnExploreCapital) this.btnExploreCapital.style.display = 'none';
      if (this.btnOpenL2) this.btnOpenL2.style.display = 'none';
      if (this.btnBackDivision) {
        this.btnBackDivision.style.display = 'inline-flex';
        this.btnBackDivision.innerHTML = `<span>←</span><span>Volver a ${divName} (L1)</span>`;
      }
      if (this.btnBackCountry) {
        this.btnBackCountry.style.display = 'inline-flex';
        this.btnBackCountry.innerHTML = `<span>←</span><span>Volver a ${cName} (L1)</span>`;
      }
      if (this.backBtn) this.backBtn.style.display = 'inline-flex';

      // Breadcrumb multinivel de 4 niveles: Mundo > País > Región > Entidad Local (SPEC-10 & SPEC-12)
      if (this.crumbWorld) this.crumbWorld.classList.remove('active');
      if (this.crumbSepCountry) this.crumbSepCountry.style.display = 'inline-block';
      if (this.crumbCountry) {
        this.crumbCountry.textContent = `${flag} ${cName}`;
        this.crumbCountry.style.display = 'inline-block';
        this.crumbCountry.classList.remove('active');
      }
      if (this.crumbSepSub) this.crumbSepSub.style.display = 'inline-block';
      if (this.crumbDivision) {
        this.crumbDivision.textContent = `📍 ${divName}`;
        this.crumbDivision.style.display = 'inline-block';
        this.crumbDivision.classList.remove('active');
      }
      if (this.crumbSepDistrict) this.crumbSepDistrict.style.display = 'inline-block';
      if (this.crumbDistrict) {
        this.crumbDistrict.textContent = `🏛️ ${distName}`;
        this.crumbDistrict.style.display = 'inline-block';
        this.crumbDistrict.classList.add('active');
      }

      // Despliegue de panel
      this.panelEl.classList.remove('panel-hidden');
      this.panelEl.classList.add('panel-visible');
    },

    /**
     * Muestra el aviso elegante de digitalización distrital en proceso (SPEC-10 Fallback).
     */
    showL2EmptyNotice() {
      if (this.emptyNoticeL2El) {
        this.emptyNoticeL2El.style.display = 'flex';
      }
    },

    hide() {
      if (!this.panelEl) return;
      this.panelEl.classList.remove('panel-visible');
      this.panelEl.classList.add('panel-hidden');

      if (this.btnExploreCapital) this.btnExploreCapital.style.display = 'none';

      // Restaurar Breadcrumb a Mundo
      if (this.crumbCountry) {
        this.crumbCountry.style.display = 'none';
        this.crumbCountry.classList.remove('active');
      }
      if (this.crumbSepCountry) {
        this.crumbSepCountry.style.display = 'none';
      }
      if (this.crumbDivision) {
        this.crumbDivision.style.display = 'none';
        this.crumbDivision.classList.remove('active');
      }
      if (this.crumbSepSub) {
        this.crumbSepSub.style.display = 'none';
      }
      if (this.crumbDistrict) {
        this.crumbDistrict.style.display = 'none';
        this.crumbDistrict.classList.remove('active');
      }
      if (this.crumbSepDistrict) {
        this.crumbSepDistrict.style.display = 'none';
      }
      if (this.crumbWorld) {
        this.crumbWorld.classList.add('active');
      }
    },

    /**
     * Sincroniza la UI al cambiar entre niveles L0, L1 y L2 (SPEC-07).
     */
    onLevelChange(level, country) {
      if (level === 1 && country) {
        const flag = country.flag || '📍';
        const name = country.name_es || country.name || 'Territorio';

        // Breadcrumb
        if (this.crumbWorld) this.crumbWorld.classList.remove('active');
        if (this.crumbSepCountry) this.crumbSepCountry.style.display = 'inline-block';
        if (this.crumbCountry) {
          this.crumbCountry.textContent = `${flag} ${name}`;
          this.crumbCountry.style.display = 'inline-block';
          this.crumbCountry.classList.add('active');
        }
        if (this.crumbSepSub) this.crumbSepSub.style.display = 'none';
        if (this.crumbDivision) this.crumbDivision.style.display = 'none';

        // Indicadores de nivel
        if (this.levelText) this.levelText.textContent = `Nivel 1 · Subnacional (${name})`;
        if (this.brandTag) this.brandTag.textContent = 'L1 · Divisiones';
        if (this.badgeLevelEl) this.badgeLevelEl.textContent = 'Nivel L1';
        if (this.subtitleEl) this.subtitleEl.textContent = `Nivel 1 · Subnacional · ${name}`;

        // Panel de acciones
        if (this.backBtn) this.backBtn.style.display = 'inline-flex';
        if (this.btnOpenL2) this.btnOpenL2.style.display = 'none';
        if (this.btnBackDivision) this.btnBackDivision.style.display = 'none';
        if (this.btnBackCountry) this.btnBackCountry.style.display = 'none';
        if (this.emptyNoticeL2El) this.emptyNoticeL2El.style.display = 'none';
        if (this.exploreBtn) {
          this.exploreBtn.style.display = 'inline-flex';
          this.exploreBtn.innerHTML = '<span>✓</span><span>Modo Divisiones Activo</span>';
          this.exploreBtn.disabled = true;
          this.exploreBtn.style.opacity = '0.75';
        }

        // Atajo ergonómico a capital L2 (SPEC-13) accesible en L1
        const shortcut = getCapitalShortcut(country);
        if (this.btnExploreCapital) {
          if (shortcut) {
            this.btnExploreCapital.style.display = 'inline-flex';
            if (this.btnExploreCapitalText) {
              this.btnExploreCapitalText.textContent = `Ver Desglose de ${shortcut.capital} (L2)`;
            }
            this.btnExploreCapital.title = `Explorar desglose de ${shortcut.type} de ${shortcut.capital} (Nivel 2)`;
          } else {
            this.btnExploreCapital.style.display = 'none';
          }
        }
      } else if (level === 2 && country) {
        const flag = country.flag || '📍';
        const name = country.name_es || country.name || 'Territorio';
        const state = State.getState();
        const divName = state.selectedDivision?.name || 'Metrópoli';

        // Indicadores de nivel
        if (this.levelText) this.levelText.textContent = `Nivel 2 · Cartografía Local (${divName})`;
        if (this.brandTag) this.brandTag.textContent = 'L2 · Distritos';
        if (this.badgeLevelEl) this.badgeLevelEl.textContent = 'Nivel L2';

        // Acciones
        if (this.backBtn) this.backBtn.style.display = 'inline-flex';
        if (this.btnBackDivision) {
          this.btnBackDivision.style.display = 'inline-flex';
          this.btnBackDivision.innerHTML = `<span>←</span><span>Volver a ${divName} (L1)</span>`;
        }
        if (this.btnBackCountry) {
          this.btnBackCountry.style.display = 'inline-flex';
          this.btnBackCountry.innerHTML = `<span>←</span><span>Volver a ${name} (L1)</span>`;
        }
        if (this.btnOpenL2) this.btnOpenL2.style.display = 'none';
        if (this.btnExploreCapital) this.btnExploreCapital.style.display = 'none';
      } else if (level === 0) {
        this.onReset();
      }
    },

    /**
     * Restablece completamente los controles e indicadores al estado inicial de L0 (Mundo).
     */
    onReset() {
      if (this.btnExploreCapital) this.btnExploreCapital.style.display = 'none';

      // Breadcrumb a solo Mundo
      if (this.crumbWorld) this.crumbWorld.classList.add('active');
      if (this.crumbCountry) {
        this.crumbCountry.style.display = 'none';
        this.crumbCountry.classList.remove('active');
      }
      if (this.crumbSepCountry) this.crumbSepCountry.style.display = 'none';
      if (this.crumbSepSub) this.crumbSepSub.style.display = 'none';
      if (this.crumbDivision) {
        this.crumbDivision.style.display = 'none';
        this.crumbDivision.classList.remove('active');
      }
      if (this.crumbSepDistrict) this.crumbSepDistrict.style.display = 'none';
      if (this.crumbDistrict) {
        this.crumbDistrict.style.display = 'none';
        this.crumbDistrict.classList.remove('active');
      }

      // Indicadores
      if (this.levelText) this.levelText.textContent = 'Nivel 0 · Explorador Mundial';
      if (this.brandTag) this.brandTag.textContent = 'L0 · Mundo';
      if (this.badgeLevelEl) this.badgeLevelEl.textContent = 'Nivel L0';

      // Acciones y panel
      if (this.metricLabel1) this.metricLabel1.textContent = 'Capital';
      if (this.metricLabel2) this.metricLabel2.textContent = 'Continente';
      if (this.curiosityIcon) this.curiosityIcon.textContent = '✨';
      if (this.curiosityTitle) this.curiosityTitle.textContent = 'Curiosidad Territorial';
      if (this.btnOpenL2) this.btnOpenL2.style.display = 'none';
      if (this.btnBackDivision) this.btnBackDivision.style.display = 'none';
      if (this.btnBackCountry) this.btnBackCountry.style.display = 'none';
      if (this.emptyNoticeEl) this.emptyNoticeEl.style.display = 'none';
      if (this.emptyNoticeL2El) this.emptyNoticeL2El.style.display = 'none';
      if (this.backBtn) this.backBtn.style.display = 'none';
      if (this.panelEl) {
        this.panelEl.classList.remove('panel-visible');
        this.panelEl.classList.add('panel-hidden');
      }
    }
  };

  /* ==========================================================================
     4. BINDING DE EVENTOS DE MAPA (L0: PAÍSES Y L1: DIVISIONES)
     ========================================================================== */
  const WorldInteraction = {
    initialized: false,
    Tooltip,
    Search,
    InfoPanel,

    init() {
      if (this.initialized) return;

      Tooltip.init();
      Search.init();
      InfoPanel.init();

      // Suscripción al estado para sincronizar selecciones globales y zoom cinemático (SPEC-07, SPEC-08, SPEC-09)
      State.subscribe((state, event) => {
        if (event.type === 'countrySelect') {
          highlightSelectedDivision(null);
          highlightSelectedDistrict(null);
          if (event.country) {
            InfoPanel.show(event.country);
            highlightSelectedCountry(event.country.feature);
            // SPEC-07: Zoom cinemático suave de 750ms hacia el país seleccionado
            WorldMap.zoomToFeature(event.country.feature, 750);

            // SPEC-08: Si ya estamos en nivel L1, renderizar subdivisiones del nuevo país
            if (state.currentLevel === 1) {
              WorldMap.renderL1(event.country);
            }
          } else {
            InfoPanel.hide();
            highlightSelectedCountry(null);
            if (state.currentLevel === 1) {
              WorldMap.clearL1();
            }
          }
        } else if (event.type === 'divisionSelect') {
          // SPEC-09: Selección interactiva de una división territorial
          highlightSelectedDistrict(null);
          if (event.division) {
            InfoPanel.showDivision(event.division, state.selectedCountry);
            highlightSelectedDivision(event.division.feature);
            // Zoom cinemático hacia la división seleccionada
            if (event.division.feature) {
              WorldMap.zoomToFeature(event.division.feature, 750);
            }
          } else {
            highlightSelectedDivision(null);
            if (state.selectedCountry) {
              InfoPanel.show(state.selectedCountry);
              InfoPanel.onLevelChange(state.currentLevel, state.selectedCountry);
              if (state.selectedCountry.feature) {
                WorldMap.zoomToFeature(state.selectedCountry.feature, 750);
              }
            }
          }
        } else if (event.type === 'districtSelect') {
          // SPEC-10: Selección interactiva de un distrito de Nivel 2
          if (event.district) {
            InfoPanel.showDistrict(event.district, state.selectedDivision, state.selectedCountry);
            highlightSelectedDistrict(event.district.feature);
            if (event.district.feature) {
              WorldMap.zoomToFeature(event.district.feature, 750);
            }
          } else {
            highlightSelectedDistrict(null);
            if (state.selectedDivision) {
              InfoPanel.showDivision(state.selectedDivision, state.selectedCountry);
              if (state.selectedDivision.feature) {
                WorldMap.zoomToFeature(state.selectedDivision.feature, 750);
              }
            }
          }
        } else if (event.type === 'levelChange') {
          // Transición de nivel L2 / L1 / L0 (SPEC-07, SPEC-08, SPEC-10)
          highlightSelectedDistrict(null);
          InfoPanel.onLevelChange(event.level, state.selectedCountry);
          if (event.level === 2 && state.selectedDivision) {
            // SPEC-10: Renderizar geometrías distritales locales
            WorldMap.renderL2(state.selectedDivision).then(res => {
              if (res && !res.success && res.reason === 'no_geometries') {
                InfoPanel.showL2EmptyNotice();
              }
            });
          } else if (event.level === 1 && state.selectedCountry) {
            WorldMap.clearL2();
            if (state.selectedDivision?.feature) {
              WorldMap.zoomToFeature(state.selectedDivision.feature, 750);
            } else if (state.selectedCountry.feature) {
              WorldMap.zoomToFeature(state.selectedCountry.feature, 750);
            }
            // SPEC-08: Renderizar divisiones subnacionales del país enfocado
            WorldMap.renderL1(state.selectedCountry);
          } else if (event.level === 0) {
            // Restaurar vista de país sin divisiones ni atenuación
            WorldMap.clearL1();
            WorldMap.resetZoom(750);
          }
        } else if (event.type === 'reset') {
          InfoPanel.onReset();
          highlightSelectedCountry(null);
          highlightSelectedDivision(null);
          highlightSelectedDistrict(null);
          Tooltip.hide();
          WorldMap.clearL1();
          WorldMap.resetZoom(750);
        }
      });

      this._bindMapEvents();
      this.initialized = true;
    },

    /**
     * Enlaza eventos de hover y click sobre las divisiones subnacionales proyectadas (SPEC-09).
     * @param {Object} country País cuyas divisiones acaban de renderizarse
     */
    bindSubdivisionEvents(country) {
      if (!WorldMap.layers?.subdivisions) return;

      const parentCountry = country || State.getState().selectedCountry || {};
      const countryName = parentCountry.name_es || parentCountry.name || '';
      const flag = parentCountry.flag || '📍';

      WorldMap.layers.subdivisions
        .selectAll('path.division-path, path.subdivision-path')
        .on('mouseenter', function (event, d) {
          d3.select(this).classed('division-hover subdivision-hover', true);
          const name = d.properties?.name || 'División';
          const rawType = d.properties?.type || 'División';
          const typeEs = formatDivisionType(rawType);

          // Metadatos enriquecidos (población, etc.)
          const meta = WorldMap.getSubdivisionMeta(parentCountry.name, name) || {};
          const population = meta.population || d.properties?.population;

          const divisionInfo = {
            feature: d,
            name: name,
            name_es: name,
            type: rawType,
            type_es: typeEs,
            population: population,
            parentCountry: parentCountry,
            flag: flag,
            subtitle: `${typeEs} · ${countryName}`
          };

          State.setHoveredFeature(divisionInfo);
          Tooltip.show(divisionInfo, event.clientX, event.clientY);
        })
        .on('mousemove', function (event) {
          Tooltip.move(event.clientX, event.clientY);
        })
        .on('mouseleave', function () {
          d3.select(this).classed('division-hover subdivision-hover', false);
          State.setHoveredFeature(null);
          Tooltip.hide();
        })
        .on('click', function (event, d) {
          event.stopPropagation();
          const name = d.properties?.name || 'División';
          const rawType = d.properties?.type || 'División';
          const typeEs = formatDivisionType(rawType);
          const meta = WorldMap.getSubdivisionMeta(parentCountry.name, name) || {};
          const population = meta.population || d.properties?.population;

          const divisionData = {
            feature: d,
            name: name,
            type: rawType,
            type_es: typeEs,
            population: population,
            parentCountry: parentCountry
          };

          State.selectDivision(divisionData);
        });

      console.log(`[WorldInteraction] Eventos interactivos enlazados a divisiones de "${countryName}".`);
    },

    /**
     * Enlaza eventos de hover y click sobre los distritos locales proyectados (SPEC-10).
     * @param {Object} division División padre (Lima)
     * @param {Object} geojson Dataset distrital cargado
     */
    bindDistrictEvents(division, geojson) {
      if (!WorldMap.layers?.districts) return;

      const pDiv = division || State.getState().selectedDivision || {};
      const pCountry = State.getState().selectedCountry || {};
      const divName = pDiv.name || 'Jurisdicción';
      const countryName = pCountry.name_es || pCountry.name || '';
      const flag = pCountry.flag || '📍';

      WorldMap.layers.districts
        .selectAll('path.district-path')
        .on('mouseenter', function (event, d) {
          d3.select(this).classed('district-hover', true);
          const name = d.properties?.name || 'Entidad';
          const type = d.properties?.type || 'Distrito';

          const districtInfo = {
            feature: d,
            name: name,
            province: d.properties?.province || divName,
            department: d.properties?.department || divName,
            type: type,
            flag: flag,
            subtitle: `${type} de ${name} · ${divName}, ${countryName}`
          };

          State.setHoveredFeature(districtInfo);
          Tooltip.show(districtInfo, event.clientX, event.clientY);
        })
        .on('mousemove', function (event) {
          Tooltip.move(event.clientX, event.clientY);
        })
        .on('mouseleave', function () {
          d3.select(this).classed('district-hover', false);
          State.setHoveredFeature(null);
          Tooltip.hide();
        })
        .on('click', function (event, d) {
          event.stopPropagation();
          const name = d.properties?.name || 'Entidad';
          const type = d.properties?.type || 'Distrito';

          const districtData = {
            feature: d,
            name: name,
            province: d.properties?.province || divName,
            department: d.properties?.department || divName,
            type: type
          };

          State.selectDistrict(districtData);
        });

      console.log(`[WorldInteraction] Eventos interactivos enlazados a entidades L2 de "${divName}".`);
    },

    _bindMapEvents() {
      // Reintentar si el mapa aún no ha renderizado L0
      const checkAndBind = () => {
        if (!WorldMap.layers?.countries || !WorldMap.data.worldGeoJson) {
          setTimeout(checkAndBind, 120);
          return;
        }

        // Construir índice del buscador con datos listos
        Search.buildIndex(WorldMap.data.worldGeoJson, WorldMap.data.countriesMeta);

        // Enlazar hover y click sobre cada país con alta respuesta
        WorldMap.layers.countries
          .selectAll('path.country-path')
          .on('mouseenter', function (event, d) {
            d3.select(this).classed('country-hover', true);
            const meta = WorldMap.getCountryMeta(d.properties?.name) || WorldMap.getCountryMeta(d.id) || {};

            const countryInfo = {
              feature: d,
              id: d.id,
              name: d.properties?.name,
              name_es: meta.name_es || d.properties?.name,
              flag: meta.flag || '🏳️',
              capital: meta.capital || '',
              continent: meta.continent || ''
            };

            State.setHoveredFeature(countryInfo);
            Tooltip.show(countryInfo, event.clientX, event.clientY);
          })
          .on('mousemove', function (event) {
            Tooltip.move(event.clientX, event.clientY);
          })
          .on('mouseleave', function () {
            d3.select(this).classed('country-hover', false);
            State.setHoveredFeature(null);
            Tooltip.hide();
          })
          .on('click', function (event, d) {
            event.stopPropagation();
            const meta = WorldMap.getCountryMeta(d.properties?.name) || WorldMap.getCountryMeta(d.id) || {};

            const countryData = {
              feature: d,
              id: d.id,
              name: d.properties?.name,
              name_es: meta.name_es || d.properties?.name,
              flag: meta.flag || '🏳️',
              capital: meta.capital || '',
              continent: meta.continent || '',
              divisionsCount: meta.divisionsCount || 0,
              fact: meta.fact || '',
              hasLevel1: meta.hasLevel1 !== false && ((meta.divisionsCount || 0) > 0)
            };

            // Selección reactiva en gestor de estado (dispara zoom cinemático SPEC-07)
            State.selectCountry(countryData);
          });

        // Click en el fondo del mapa (océano/esfera) limpia selecciones y vuelve al mundo
        if (WorldMap.svg) {
          WorldMap.svg.on('click', (e) => {
            if (e.target.tagName === 'svg' || e.target.classList.contains('layer-sphere')) {
              State.resetToWorld();
            }
          });
        }

        console.log('[WorldInteraction] Interacciones L0 y buscador inicializados con éxito.');
      };

      checkAndBind();
    }
  };

  // Inicialización automática
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => WorldInteraction.init());
    } else {
      WorldInteraction.init();
    }
  }

  return WorldInteraction;
});

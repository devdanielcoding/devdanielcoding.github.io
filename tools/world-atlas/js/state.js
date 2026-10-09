/**
 * World Atlas — Gestor de Estado Reactivo (SPEC-03)
 * Desacopla la lógica cartográfica de la lógica de interfaz mediante un bus de eventos y estado determinista.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.State = factory();
    root.WorldAtlasState = root.State; // Alias para evitar colisiones
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  const State = {
    currentLevel: 0, // 0: Mundo (L0), 1: Subnacional (L1), 2: Local (L2)
    selectedCountry: null, // Objeto de país seleccionado o null
    selectedDivision: null, // Objeto de división subnacional seleccionada o null
    selectedDistrict: null, // Objeto de distrito local seleccionado o null (SPEC-10)
    hoveredFeature: null, // Feature territorial actualmente bajo el puntero o null
    labelsVisible: false, // SPEC-15: Capa de etiquetas territoriales (false: modo mapa mudo por defecto)
    listeners: [], // Lista de callbacks suscriptores

    /**
     * Retorna el nivel territorial activo (0, 1, o 2).
     * @returns {number}
     */
    getLevel() {
      return this.currentLevel;
    },

    /**
     * Actualiza el nivel territorial y notifica a los suscriptores.
     * @param {number} newLevel 
     */
    setLevel(newLevel) {
      const level = Math.max(0, Math.min(2, Number(newLevel) || 0));
      if (this.currentLevel === level) return;
      this.currentLevel = level;
      if (level < 2) {
        this.selectedDistrict = null;
      }
      if (level < 1) {
        this.selectedDivision = null;
      }
      this._notify({ type: 'levelChange', level: this.currentLevel });
    },

    /**
     * Selecciona un país, resetea la división subnacional, distrito y notifica.
     * @param {Object|null} countryData 
     */
    selectCountry(countryData) {
      this.selectedCountry = countryData;
      this.selectedDivision = null;
      this.selectedDistrict = null;
      this._notify({ type: 'countrySelect', country: this.selectedCountry });
    },

    /**
     * Selecciona una división subnacional, resetea distrito y notifica.
     * @param {Object|null} divisionData 
     */
    selectDivision(divisionData) {
      this.selectedDivision = divisionData;
      this.selectedDistrict = null;
      this._notify({ type: 'divisionSelect', division: this.selectedDivision });
    },

    /**
     * Selecciona un distrito de nivel local (L2) y notifica (SPEC-10).
     * @param {Object|null} districtData 
     */
    selectDistrict(districtData) {
      this.selectedDistrict = districtData;
      this._notify({ type: 'districtSelect', district: this.selectedDistrict });
    },

    /**
     * Actualiza la entidad geográfica bajo el cursor (hover) y notifica.
     * @param {Object|null} feature 
     */
    setHoveredFeature(feature) {
      if (this.hoveredFeature === feature) return;
      this.hoveredFeature = feature;
      this._notify({ type: 'hoverChange', feature: this.hoveredFeature });
    },

    /**
     * Restablece el estado completo a Nivel 0 (Mundo), limpiando selecciones.
     */
    resetToWorld() {
      const changed = this.currentLevel !== 0 || this.selectedCountry !== null || this.selectedDivision !== null || this.selectedDistrict !== null;
      this.currentLevel = 0;
      this.selectedCountry = null;
      this.selectedDivision = null;
      this.selectedDistrict = null;
      this.hoveredFeature = null;
      if (changed) {
        this._notify({ type: 'reset', level: 0 });
      }
    },

    /**
     * Suscribe un callback a cualquier cambio de estado.
     * @param {Function} callback (state, event) => void
     * @returns {Function} Función para cancelar la suscripción
     */
    subscribe(callback) {
      if (typeof callback !== 'function') return () => {};
      this.listeners.push(callback);
      return () => {
        this.listeners = this.listeners.filter(fn => fn !== callback);
      };
    },

    /**
     * Alterna la visibilidad de la capa de etiquetas territoriales (SPEC-15).
     * @returns {boolean}
     */
     toggleLabels() {
      this.labelsVisible = !this.labelsVisible;
      this._notify({ type: 'labelsChange', visible: this.labelsVisible });
      return this.labelsVisible;
    },

    /**
     * Define explícitamente la visibilidad de las etiquetas (SPEC-15).
     * @param {boolean} visible 
     */
    setLabelsVisible(visible) {
      const next = Boolean(visible);
      if (this.labelsVisible === next) return;
      this.labelsVisible = next;
      this._notify({ type: 'labelsChange', visible: this.labelsVisible });
    },

    /**
     * Retorna una instantánea limpia del estado actual.
     * @returns {Object}
     */
    getState() {
      return {
        currentLevel: this.currentLevel,
        selectedCountry: this.selectedCountry,
        selectedDivision: this.selectedDivision,
        selectedDistrict: this.selectedDistrict,
        hoveredFeature: this.hoveredFeature,
        labelsVisible: this.labelsVisible
      };
    },

    /**
     * Método interno para despachar notificaciones a los suscriptores.
     * @private
     */
    _notify(event) {
      const payload = {
        ...event,
        state: this.getState()
      };
      for (const listener of this.listeners) {
        try {
          listener(this, payload);
        } catch (err) {
          console.error('[WorldAtlas State Error]', err);
        }
      }
    }
  };

  return State;
});

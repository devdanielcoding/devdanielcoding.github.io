document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);

  const km = $('km');
  const gal = $('gal');
  const ppg = $('ppg');
  const planKm = $('planKm');
  const kmPerGal = $('kmPerGal');
  const kmPerL = $('kmPerL');
  const lPer100 = $('lPer100');
  const costPerKm = $('costPerKm');
  const ppgOut = $('ppgOut');
  const rendBase = $('rendBase');
  const tripHint = $('tripHint');
  const tripCost = $('tripCost');
  const calcTrip = $('calcTrip');
  const demo = $('demo');
  const clearBtn = $('clear');
  const note1 = $('note1');

  const inputs = [km, gal, ppg, planKm];
  if (inputs.some((input) => !(input instanceof HTMLInputElement))) {
    return;
  }

  const LITERS_PER_GAL = 3.785;
  const PEN = new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    maximumFractionDigits: 2,
  });
  const NUM = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 2 });

  const fieldIds = ['km', 'gal', 'ppg', 'planKm'];

  function validNumber(x) {
    return Number.isFinite(x) && x > 0;
  }

  function save() {
    try {
      fieldIds.forEach((field) => {
        const el = $(field);
        if (el instanceof HTMLInputElement) {
          localStorage.setItem(`fuel_${field}`, el.value);
        }
      });
    } catch (error) {
      console.warn('No se pudo guardar en localStorage', error);
    }
  }

  function compute() {
    const kmValue = parseFloat(km.value);
    const galValue = parseFloat(gal.value);
    const ppgValue = parseFloat(ppg.value);

    let kmPerGalValue = NaN;
    let kmPerLValue = NaN;
    let lPer100Value = NaN;
    let costPerKmValue = NaN;

    if (validNumber(kmValue) && validNumber(galValue)) {
      kmPerGalValue = kmValue / galValue;
      kmPerLValue = kmPerGalValue / LITERS_PER_GAL;
      lPer100Value = 100 / kmPerLValue;
    }

    if (validNumber(ppgValue) && validNumber(kmPerGalValue)) {
      costPerKmValue = ppgValue / kmPerGalValue;
    }

    kmPerGal.textContent = validNumber(kmPerGalValue) ? `${NUM.format(kmPerGalValue)} km/gal` : '–';
    kmPerL.textContent = validNumber(kmPerLValue) ? `${NUM.format(kmPerLValue)} km/L` : '–';
    lPer100.textContent = validNumber(lPer100Value) ? `${NUM.format(lPer100Value)} L/100 km` : '–';
    costPerKm.textContent = validNumber(costPerKmValue) ? `${PEN.format(costPerKmValue)} / km` : '–';

    ppgOut.textContent = validNumber(ppgValue) ? `${PEN.format(ppgValue)} por galón` : '–';
    rendBase.textContent = validNumber(kmPerGalValue)
      ? `${NUM.format(kmPerGalValue)} km/gal · ${NUM.format(kmPerLValue)} km/L`
      : '–';

    const okPhase1 = validNumber(costPerKmValue);
    tripHint.textContent = okPhase1 ? 'Listo, ahora ingresa los km del viaje.' : 'Primero completa la fase 1.';
    return { okPhase1, costPerKmValue };
  }

  function estimateTrip() {
    const { okPhase1, costPerKmValue } = compute();
    const planKmValue = parseFloat(planKm.value);

    if (!okPhase1 || !validNumber(planKmValue)) {
      tripCost.textContent = '–';
      return;
    }

    const estimated = planKmValue * costPerKmValue;
    tripCost.textContent = PEN.format(estimated);
  }

  function load() {
    try {
      fieldIds.forEach((field) => {
        const stored = localStorage.getItem(`fuel_${field}`);
        const el = $(field);
        if (stored !== null && el instanceof HTMLInputElement) {
          el.value = stored;
        }
      });
    } catch (error) {
      console.warn('No se pudo cargar localStorage', error);
    }
    compute();
    estimateTrip();
  }

  ['km', 'gal', 'ppg'].forEach((id) => {
    const el = $(id);
    el?.addEventListener('input', () => {
      save();
      compute();
    });
  });

  planKm.addEventListener('input', () => {
    save();
    estimateTrip();
  });

  calcTrip?.addEventListener('click', () => {
    estimateTrip();
  });

  demo?.addEventListener('click', () => {
    km.value = '250';
    gal.value = '6';
    ppg.value = '15';
    planKm.value = '25';
    save();
    compute();
    estimateTrip();
  });

  clearBtn?.addEventListener('click', () => {
    fieldIds.forEach((field) => {
      const el = $(field);
      if (el instanceof HTMLInputElement) {
        el.value = '';
      }
    });
    save();
    compute();
    tripCost.textContent = '–';
  });

  if (note1) {
    note1.textContent = `Se usa 1 galón ≈ ${LITERS_PER_GAL} L. Cambios en precio o consumo afectan el costo por km.`;
  }

  load();
});

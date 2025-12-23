import { ensureMinimumActivities, getState, resetState, setEventDate, setEventName } from './state.js';
import { addNewActivity, changeActivity, deleteActivity, createActivityRow, getValidatedState } from './agenda.js';
import { applyPreset } from './presets.js';
import { exportJson, importJson, exportPdf } from './export.js';
import { isSlotAvailable, isOrderValid } from './validation.js';

const agendaContainer = document.getElementById('activities');
const summaryEl = document.getElementById('validationSummary');
const nameInput = document.getElementById('eventName');
const dateInput = document.getElementById('eventDate');
const eventNameDisplay = document.getElementById('eventNameDisplay');
const eventDateDisplay = document.getElementById('eventDateDisplay');
const printableAgenda = document.getElementById('printableAgenda');
const resetButton = document.getElementById('resetAgenda');
const addButton = document.getElementById('addActivity');
const pdfButton = document.getElementById('exportPdf');

const presetButtons = {
  morning: document.getElementById('presetMorning'),
  afternoon: document.getElementById('presetAfternoon'),
  night: document.getElementById('presetNight')
};

const renderAgenda = () => {
  const { activities, validation, eventName, eventDate } = getValidatedState();
  agendaContainer.innerHTML = '';

  activities.forEach((activity) => {
    const { row, inputs, errorEl, deleteBtn } = createActivityRow(activity, {
      onChange: handleActivityChange,
      onDelete: handleDelete
    });

    decorateInput(inputs.startInput);
    decorateInput(inputs.endInput);
    decorateInput(inputs.descInput);

    const errors = validation[activity.id] || [];
    if (errors.length) {
      row.classList.add('invalid');
      errorEl.textContent = errors.join(' ');
    }
    deleteBtn.disabled = activities.length <= 2;

    agendaContainer.appendChild(row);
  });

  updateSummary(validation);
  updateMeta(eventName, eventDate);
};

const updateSummary = (validation) => {
  const hasErrors = Object.values(validation).some((list) => list.length);
  if (hasErrors) {
    summaryEl.textContent = 'Revisa los horarios: hay conflictos activos.';
    summaryEl.classList.add('warning');
  } else {
    summaryEl.textContent = 'Sin conflictos detectados.';
    summaryEl.classList.remove('warning');
  }
};

const updateMeta = (eventName, eventDate) => {
  eventNameDisplay.textContent = eventName || 'Evento sin nombre';
  eventDateDisplay.textContent = eventDate ? new Date(eventDate).toLocaleDateString() : 'Sin fecha';
};

const handleActivityChange = (payload) => {
  const { activities } = getState();
  const current = activities.find((item) => item.id === payload.id);
  if (!current) return;

  const cleanPayload = {
    ...current,
    ...payload
  };

  if (payload.description !== undefined) {
    cleanPayload.description = payload.description;
  }

  const hasTimeChange = payload.start !== undefined || payload.end !== undefined;

  if (hasTimeChange) {
    if (!isOrderValid(cleanPayload.start, cleanPayload.end)) {
      changeActivity(cleanPayload);
      renderAgenda();
      return;
    }

    const others = activities.filter((item) => item.id !== payload.id);
    if (!isSlotAvailable(others, cleanPayload.start, cleanPayload.end)) {
      changeActivity(cleanPayload);
      renderAgenda();
      return;
    }

    changeActivity(cleanPayload);
    renderAgenda();
    return;
  }

  changeActivity(cleanPayload);
};

const handleDelete = (id) => {
  deleteActivity(id);
  renderAgenda();
};

const handleAddActivity = () => {
  addNewActivity();
  renderAgenda();
};

const enablePresets = (enabled) => {
  Object.values(presetButtons).forEach((btn) => {
    btn.disabled = !enabled;
  });
};

const bindMeta = () => {
  nameInput.addEventListener('input', (e) => {
    setEventName(e.target.value);
    renderAgenda();
  });
  nameInput.addEventListener('blur', () => collapseInput(nameInput));
  nameInput.addEventListener('focus', () => expandInput(nameInput));

  dateInput.addEventListener('change', (e) => {
    setEventDate(e.target.value);
    enablePresets(Boolean(e.target.value));
    renderAgenda();
  });
  dateInput.addEventListener('blur', () => collapseInput(dateInput));
  dateInput.addEventListener('focus', () => expandInput(dateInput));
};

const bindControls = () => {
  addButton.addEventListener('click', handleAddActivity);
  resetButton.addEventListener('click', handleReset);
  presetButtons.morning.addEventListener('click', () => handlePreset('morning'));
  presetButtons.afternoon.addEventListener('click', () => handlePreset('afternoon'));
  presetButtons.night.addEventListener('click', () => handlePreset('night'));
  document.getElementById('exportJson').addEventListener('click', exportJson);
  document.getElementById('importJson').addEventListener('click', () => document.getElementById('importInput').click());
  document.getElementById('importInput').addEventListener('change', handleImport);
  pdfButton.addEventListener('click', exportPdf);
  printableAgenda.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    exportPdf();
  });
};

const handlePreset = (key) => {
  const result = applyPreset(key);
  summaryEl.textContent = result.message;
  summaryEl.classList.toggle('warning', !result.success);
  renderAgenda();
};

const handleImport = async (event) => {
  const [file] = event.target.files;
  if (!file) return;
  try {
    await importJson(file);
    enablePresets(Boolean(getState().eventDate));
    renderAgenda();
  } catch (error) {
    summaryEl.textContent = error.message;
    summaryEl.classList.add('warning');
  } finally {
    event.target.value = '';
  }
};

const handleReset = () => {
  resetState();
  nameInput.value = '';
  dateInput.value = '';
  enablePresets(false);
  summaryEl.textContent = 'Sin conflictos detectados.';
  summaryEl.classList.remove('warning');
  collapseInput(nameInput);
  collapseInput(dateInput);
  renderAgenda();
};

const collapseInput = (input) => {
  input.classList.add('as-text');
};

const expandInput = (input) => {
  input.classList.remove('as-text');
};

const decorateInput = (input) => {
  collapseInput(input);
  input.addEventListener('focus', () => expandInput(input));
  input.addEventListener('blur', () => collapseInput(input));
};

const init = () => {
  ensureMinimumActivities();
  enablePresets(false);
  bindMeta();
  bindControls();
  collapseInput(nameInput);
  collapseInput(dateInput);
  renderAgenda();
};

init();

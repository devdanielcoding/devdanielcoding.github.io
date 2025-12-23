import { addActivity, removeActivity, updateActivity, sortActivities, ensureMinimumActivities, getState } from './state.js';
import { validateAgenda } from './validation.js';

export const createActivityRow = (activity, { onChange, onDelete, spansNextDay = false }) => {
  const row = document.createElement('div');
  row.className = 'activity-row';
  row.dataset.id = activity.id;

  const startWrapper = document.createElement('div');
  startWrapper.className = 'time';
  const startLabel = document.createElement('label');
  startLabel.textContent = 'Inicio';
  startLabel.className = 'sr-only';
  const startInput = document.createElement('input');
  startInput.type = 'time';
  startInput.value = activity.start;
  startInput.className = 'time-start';

  const endWrapper = document.createElement('div');
  endWrapper.className = 'time';
  const endLabel = document.createElement('label');
  endLabel.textContent = 'Fin';
  endLabel.className = 'sr-only';
  const endInput = document.createElement('input');
  endInput.type = 'time';
  endInput.value = activity.end;
  endInput.className = 'time-end';

  if (spansNextDay) {
    const dayBadge = document.createElement('span');
    dayBadge.className = 'day-indicator';
    dayBadge.textContent = '(+1 día)';
    endWrapper.appendChild(dayBadge);
  }

  const descWrapper = document.createElement('div');
  descWrapper.className = 'description';
  const descLabel = document.createElement('label');
  descLabel.textContent = 'Descripción';
  descLabel.className = 'sr-only';
  const descInput = document.createElement('input');
  descInput.type = 'text';
  descInput.value = activity.description;
  descInput.placeholder = 'Describe la actividad';

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'delete';
  deleteBtn.textContent = 'Eliminar';

  const error = document.createElement('div');
  error.className = 'error';

  startWrapper.append(startLabel, startInput);
  endWrapper.append(endLabel, endInput);
  descWrapper.append(descLabel, descInput);
  row.append(startWrapper, endWrapper, descWrapper, deleteBtn, error);

  const emitChange = (payload = {}) => {
    onChange({
      id: activity.id,
      ...payload
    });
  };

  const emitTimeChange = () => {
    emitChange({
      start: startInput.value,
      end: endInput.value
    });
  };

  let descTimeout;
  const scheduleDescriptionSave = () => {
    clearTimeout(descTimeout);
    descTimeout = setTimeout(() => {
      emitChange({ description: descInput.value });
    }, 400);
  };

  const flushDescription = () => {
    clearTimeout(descTimeout);
    emitChange({ description: descInput.value });
  };

  startInput.addEventListener('input', emitTimeChange);
  endInput.addEventListener('input', emitTimeChange);
  descInput.addEventListener('input', scheduleDescriptionSave);
  descInput.addEventListener('blur', flushDescription);

  deleteBtn.addEventListener('click', () => onDelete(activity.id));

  return { row, inputs: { startInput, endInput, descInput }, errorEl: error, deleteBtn };
};

export const addNewActivity = () => {
  const activity = addActivity();
  sortActivities();
  return activity;
};

export const deleteActivity = (id) => {
  removeActivity(id);
  ensureMinimumActivities();
  sortActivities();
};

export const changeActivity = (payload) => {
  updateActivity(payload.id, payload);
  sortActivities();
};

export const getValidatedState = () => {
  const current = getState();
  return { ...current, validation: validateAgenda(current.activities, current.eventDate) };
};

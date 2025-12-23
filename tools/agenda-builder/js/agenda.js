import { addActivity, removeActivity, updateActivity, sortActivities, ensureMinimumActivities, getState } from './state.js';
import { validateAgenda } from './validation.js';

export const createActivityRow = (activity, { onChange, onDelete }) => {
  const row = document.createElement('div');
  row.className = 'activity-row';
  row.dataset.id = activity.id;

  const startWrapper = document.createElement('div');
  startWrapper.className = 'time';
  const startLabel = document.createElement('label');
  startLabel.textContent = 'Inicio';
  const startInput = document.createElement('input');
  startInput.type = 'time';
  startInput.value = activity.start;
  startInput.className = 'time-start';

  const endWrapper = document.createElement('div');
  endWrapper.className = 'time';
  const endLabel = document.createElement('label');
  endLabel.textContent = 'Fin';
  const endInput = document.createElement('input');
  endInput.type = 'time';
  endInput.value = activity.end;
  endInput.className = 'time-end';

  const descWrapper = document.createElement('div');
  descWrapper.className = 'description';
  const descLabel = document.createElement('label');
  descLabel.textContent = 'Descripción';
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

  const emitChange = () => {
    onChange({
      id: activity.id,
      start: startInput.value,
      end: endInput.value,
      description: descInput.value
    });
  };

  startInput.addEventListener('input', emitChange);
  endInput.addEventListener('input', emitChange);
  descInput.addEventListener('input', emitChange);

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
  return { ...current, validation: validateAgenda(current.activities) };
};

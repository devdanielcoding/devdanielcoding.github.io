import { getState, replaceActivities, setEventDate, setEventName, ensureMinimumActivities, sortActivities } from './state.js';

const download = (filename, data) => {
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const exportJson = () => {
  const payload = JSON.stringify(getState(), null, 2);
  const name = getState().eventName || 'agenda';
  download(`${name.replace(/\s+/g, '-').toLowerCase()}-agenda.json`, payload);
};

export const importJson = async (file) => {
  const text = await file.text();
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed.activities) || typeof parsed !== 'object') {
    throw new Error('El archivo no tiene el formato esperado.');
  }

  setEventName(parsed.eventName || '');
  setEventDate(parsed.eventDate || '');
  replaceActivities(parsed.activities);
  ensureMinimumActivities();
  sortActivities();
};

export const exportPdf = () => {
  window.print();
};

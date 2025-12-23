import { addActivity, sortActivities, getState } from './state.js';
import { isSlotAvailable } from './validation.js';

const PRESETS = {
  morning: { start: '08:00', label: 'Mañana' },
  afternoon: { start: '13:00', label: 'Tarde' },
  night: { start: '18:00', label: 'Noche' }
};

const generateSlots = (start) => {
  const [h, m] = start.split(':').map(Number);
  const base = h * 60 + m;
  return Array.from({ length: 4 }, (_, idx) => {
    const slotStart = base + idx * 60;
    return {
      start: format(slotStart),
      end: format(slotStart + 60),
      description: `Actividad ${idx + 1}`
    };
  });
};

const format = (minutes) => {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export const applyPreset = (key) => {
  const preset = PRESETS[key];
  const { eventDate, activities } = getState();
  if (!preset || !eventDate) {
    return { success: false, message: 'Selecciona un día antes de usar presets.' };
  }

  const slots = generateSlots(preset.start);
  const conflicts = slots.some((slot) => !isSlotAvailable(activities, slot.start, slot.end, eventDate));
  if (conflicts) {
    return { success: false, message: 'El preset se superpone con las actividades actuales.' };
  }

  slots.forEach((slot) => addActivity(slot));
  sortActivities();
  return { success: true, message: `${preset.label} añadido correctamente.` };
};

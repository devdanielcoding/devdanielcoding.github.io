import { utils } from './state.js';

export const validateAgenda = (activities) => {
  const errors = {};
  const overlaps = findOverlaps(activities);

  activities.forEach((activity) => {
    const list = [];
    if (!isOrderValid(activity.start, activity.end)) {
      list.push('La hora de inicio debe ser anterior a la hora de fin.');
    }
    if (overlaps.has(activity.id)) {
      list.push('Este horario se solapa con otra actividad.');
    }
    errors[activity.id] = list;
  });

  return errors;
};

export const isOrderValid = (start, end) => utils.toMinutes(start) < utils.toMinutes(end);

export const isSlotAvailable = (activities, start, end, ignoreId) => {
  return !activities.some((item) => {
    if (ignoreId && item.id === ignoreId) return false;
    return rangesOverlap(start, end, item.start, item.end);
  });
};

const findOverlaps = (activities) => {
  const overlapping = new Set();
  activities.forEach((current, idx) => {
    for (let i = idx + 1; i < activities.length; i += 1) {
      const other = activities[i];
      if (rangesOverlap(current.start, current.end, other.start, other.end)) {
        overlapping.add(current.id);
        overlapping.add(other.id);
      }
    }
  });
  return overlapping;
};

const rangesOverlap = (aStart, aEnd, bStart, bEnd) => {
  const startA = utils.toMinutes(aStart);
  const endA = utils.toMinutes(aEnd);
  const startB = utils.toMinutes(bStart);
  const endB = utils.toMinutes(bEnd);
  return startA < endB && startB < endA;
};

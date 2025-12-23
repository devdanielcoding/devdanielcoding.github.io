import { utils } from './state.js';

export const validateAgenda = (activities, eventDate) => {
  const errors = {};
  const overlaps = findOverlaps(activities, eventDate);

  activities.forEach((activity) => {
    const list = [];
    if (!isOrderValid(activity.start, activity.end, eventDate)) {
      list.push('La hora de inicio debe ser anterior a la hora de fin.');
    }
    if (overlaps.has(activity.id)) {
      list.push('Este horario se solapa con otra actividad.');
    }
    errors[activity.id] = list;
  });

  return errors;
};

export const isOrderValid = (start, end, eventDate) => {
  const range = utils.resolveRange(start, end, eventDate);
  return range.startDate < range.endDate;
};

export const isSlotAvailable = (activities, start, end, eventDate, ignoreId) => {
  return !activities.some((item) => {
    if (ignoreId && item.id === ignoreId) return false;
    return rangesOverlap(start, end, item.start, item.end, eventDate);
  });
};

const findOverlaps = (activities, eventDate) => {
  const overlapping = new Set();
  activities.forEach((current, idx) => {
    for (let i = idx + 1; i < activities.length; i += 1) {
      const other = activities[i];
      if (rangesOverlap(current.start, current.end, other.start, other.end, eventDate)) {
        overlapping.add(current.id);
        overlapping.add(other.id);
      }
    }
  });
  return overlapping;
};

const rangesOverlap = (aStart, aEnd, bStart, bEnd, eventDate) => {
  const rangeA = utils.resolveRange(aStart, aEnd, eventDate);
  const rangeB = utils.resolveRange(bStart, bEnd, eventDate);
  return rangeA.startDate < rangeB.endDate && rangeB.startDate < rangeA.endDate;
};

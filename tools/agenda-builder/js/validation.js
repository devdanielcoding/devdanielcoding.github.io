import { utils } from './state.js';

const resolveRange = (start, end, activityDate, fallbackDate) => {
  const baseDate = activityDate || fallbackDate;
  const startDate = utils.toDateTime(baseDate, start);
  const endDate = utils.toDateTime(baseDate, end);
  return { startDate, endDate };
};

export const validateAgenda = (activities, eventDate) => {
  const errors = {};
  const overlaps = findOverlaps(activities, eventDate);

  activities.forEach((activity) => {
    const list = [];
    if (!isOrderValid(activity.start, activity.end, activity.activityDate, eventDate)) {
      list.push('La hora de inicio debe ser anterior a la hora de fin.');
    }
    if (overlaps.has(activity.id)) {
      list.push('Este horario se solapa con otra actividad.');
    }
    errors[activity.id] = list;
  });

  return errors;
};

export const isOrderValid = (start, end, activityDate, fallbackDate) => {
  const range = resolveRange(start, end, activityDate, fallbackDate);
  return range.startDate < range.endDate;
};

export const isSlotAvailable = (activities, start, end, activityDate, fallbackDate = '', ignoreId) => {
  return !activities.some((item) => {
    if (ignoreId && item.id === ignoreId) return false;
    return rangesOverlap(start, end, activityDate, item.start, item.end, item.activityDate, fallbackDate);
  });
};

const findOverlaps = (activities, fallbackDate) => {
  const overlapping = new Set();
  activities.forEach((current, idx) => {
    for (let i = idx + 1; i < activities.length; i += 1) {
      const other = activities[i];
      if (rangesOverlap(current.start, current.end, current.activityDate, other.start, other.end, other.activityDate, fallbackDate)) {
        overlapping.add(current.id);
        overlapping.add(other.id);
      }
    }
  });
  return overlapping;
};

const rangesOverlap = (aStart, aEnd, aDate, bStart, bEnd, bDate, fallbackDate) => {
  const rangeA = resolveRange(aStart, aEnd, aDate, fallbackDate);
  const rangeB = resolveRange(bStart, bEnd, bDate, fallbackDate);
  return rangeA.startDate < rangeB.endDate && rangeB.startDate < rangeA.endDate;
};

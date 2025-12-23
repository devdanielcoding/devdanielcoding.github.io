const state = {
  eventName: '',
  eventDate: '',
  activities: []
};

let idCounter = 0;

const toMinutes = (time) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

const clampDayOffset = (value = 0) => Math.min(1, Math.max(0, Number(value) || 0));

const normalizeDate = (eventDate) => eventDate || '1970-01-01';

const toDateTime = (eventDate, time, dayOffset = 0) => {
  const date = new Date(`${normalizeDate(eventDate)}T${time}:00`);
  date.setDate(date.getDate() + clampDayOffset(dayOffset));
  return date;
};

const resolveRange = (start, end, eventDate, dayOffset = 0) => {
  const safeOffset = clampDayOffset(dayOffset);
  const startDate = toDateTime(eventDate, start, safeOffset);
  const endDate = toDateTime(eventDate, end, safeOffset);
  const spansNextDay = endDate <= startDate;
  if (spansNextDay) {
    endDate.setDate(endDate.getDate() + 1);
  }
  return { startDate, endDate, spansNextDay };
};

const formatTime = (minutes) => {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const formatFromDate = (date) => formatTime(date.getHours() * 60 + date.getMinutes());

const getMaxDayOffset = () => state.activities.reduce((max, item) => Math.max(max, clampDayOffset(item.dayOffset)), 0);

const deriveOffsetFromDate = (date) => {
  const base = new Date(`${normalizeDate(state.eventDate)}T00:00:00`);
  const diffDays = Math.round((date - base) / (24 * 60 * 60 * 1000));
  return clampDayOffset(diffDays);
};

const nextSlot = () => {
  if (state.activities.length === 0) {
    const now = new Date();
    const baseHour = Math.max(7, Math.min(18, now.getHours()));
    const start = `${String(baseHour).padStart(2, '0')}:00`;
    return { start, end: formatTime(toMinutes(start) + 60), dayOffset: 0 };
  }

  sortActivities();
  const last = state.activities[state.activities.length - 1];
  const { endDate } = resolveRange(last.start, last.end, state.eventDate, last.dayOffset);
  const startDate = new Date(endDate.getTime() + 15 * 60 * 1000);
  const endDateSuggestion = new Date(endDate.getTime() + 75 * 60 * 1000);
  const inheritedOffset = getMaxDayOffset();
  const suggestedOffset = deriveOffsetFromDate(startDate);
  const dayOffset = Math.max(inheritedOffset, suggestedOffset);

  return {
    start: formatFromDate(startDate),
    end: formatFromDate(endDateSuggestion),
    dayOffset
  };
};

const createActivity = (payload = {}) => {
  const slot = nextSlot();
  const dayOffset = clampDayOffset(payload.dayOffset ?? slot.dayOffset);
  return {
    id: `act-${Date.now()}-${idCounter++}`,
    start: payload.start || slot.start,
    end: payload.end || slot.end,
    description: payload.description || 'Actividad',
    dayOffset
  };
};

export const getState = () => ({
  ...state,
  activities: [...state.activities]
});

export const setEventName = (name) => {
  state.eventName = name.trim();
};

export const setEventDate = (date) => {
  state.eventDate = date;
};

export const addActivity = (payload = {}) => {
  const activity = createActivity(payload);
  state.activities.push(activity);
  return activity;
};

export const updateActivity = (id, payload) => {
  const target = state.activities.find((item) => item.id === id);
  if (!target) return;
  Object.assign(target, payload, { dayOffset: clampDayOffset(payload.dayOffset ?? target.dayOffset) });
};

export const removeActivity = (id) => {
  if (state.activities.length <= 2) return;
  state.activities = state.activities.filter((item) => item.id !== id);
};

export const replaceActivities = (list) => {
  state.activities = list.map((item) => ({
    id: item.id || `act-${Date.now()}-${idCounter++}`,
    start: item.start,
    end: item.end,
    description: item.description || 'Actividad',
    dayOffset: clampDayOffset(item.dayOffset)
  }));
};

export const resetState = () => {
  state.eventName = '';
  state.eventDate = '';
  state.activities = [];
  idCounter = 0;
  ensureMinimumActivities();
  sortActivities();
};

export const ensureMinimumActivities = () => {
  while (state.activities.length < 2) {
    addActivity();
  }
};

export const sortActivities = () => {
  state.activities.sort((a, b) => {
    const aKey = clampDayOffset(a.dayOffset) * 1440 + toMinutes(a.start);
    const bKey = clampDayOffset(b.dayOffset) * 1440 + toMinutes(b.start);
    return aKey - bKey;
  });
};

export const utils = { toMinutes, formatTime, toDateTime, resolveRange, normalizeDate, clampDayOffset };

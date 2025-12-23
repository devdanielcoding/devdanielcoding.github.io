const state = {
  eventName: '',
  eventDate: '',
  activities: []
};

let idCounter = 0;

const todayISO = () => new Date().toISOString().slice(0, 10);

const normalizeDate = (value) => value || todayISO();

const toMinutes = (time) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

const formatTime = (minutes) => {
  const clamped = Math.max(0, Math.min(minutes, 23 * 60 + 59));
  const h = Math.floor(clamped / 60) % 24;
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const formatFromDate = (date) => formatTime(date.getHours() * 60 + date.getMinutes());

const toDateTime = (date, time) => new Date(`${normalizeDate(date)}T${time || '00:00'}:00`);

const buildTimestamp = (activity) => toDateTime(activity.activityDate, activity.start).getTime();

const inheritActivityDate = () => {
  if (state.activities.length > 0) {
    return state.activities[state.activities.length - 1].activityDate;
  }
  if (state.eventDate) return state.eventDate;
  return todayISO();
};

const nextSlot = () => {
  if (state.activities.length === 0) {
    const now = new Date();
    const baseHour = Math.max(7, Math.min(18, now.getHours()));
    const start = `${String(baseHour).padStart(2, '0')}:00`;
    return {
      start,
      end: formatTime(toMinutes(start) + 60),
      activityDate: state.eventDate || todayISO()
    };
  }

  sortActivities();
  const last = state.activities[state.activities.length - 1];
  const lastEndMinutes = toMinutes(last.end);
  const startMinutes = Math.min(23 * 60 + 45, lastEndMinutes + 15);
  const endMinutes = Math.min(23 * 60 + 59, startMinutes + 60);

  return {
    start: formatTime(startMinutes),
    end: formatTime(endMinutes),
    activityDate: inheritActivityDate()
  };
};

const createActivity = (payload = {}) => {
  const slot = nextSlot();
  return {
    id: `act-${Date.now()}-${idCounter++}`,
    start: payload.start || slot.start,
    end: payload.end || slot.end,
    description: payload.description || 'Actividad',
    activityDate: payload.activityDate || slot.activityDate,
    isDateManual: Boolean(payload.isDateManual)
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
  const next = {
    ...target,
    ...payload,
    activityDate: payload.activityDate ?? target.activityDate ?? inheritActivityDate(),
    isDateManual: payload.isDateManual ?? target.isDateManual ?? false
  };
  Object.assign(target, next);
};

export const removeActivity = (id) => {
  if (state.activities.length <= 2) return;
  state.activities = state.activities.filter((item) => item.id !== id);
};

const deriveActivityDate = (item, fallbackDate) => {
  if (item.activityDate) return item.activityDate;
  if (item.dayOffset !== undefined) {
    const base = toDateTime(fallbackDate || todayISO(), '00:00');
    base.setDate(base.getDate() + Number(item.dayOffset || 0));
    return base.toISOString().slice(0, 10);
  }
  if (fallbackDate) return fallbackDate;
  return todayISO();
};

export const replaceActivities = (list) => {
  state.activities = list.map((item) => ({
    id: item.id || `act-${Date.now()}-${idCounter++}`,
    start: item.start,
    end: item.end,
    description: item.description || 'Actividad',
    activityDate: deriveActivityDate(item, state.eventDate),
    isDateManual: Boolean(item.isDateManual)
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
  state.activities.sort((a, b) => buildTimestamp(a) - buildTimestamp(b));
};

export const syncActivitiesWithEventDate = (newDate, previousDate) => {
  if (!newDate) return;
  const anyManualDate = state.activities.some((item) => item.isDateManual);
  const allMatchPrevious =
    Boolean(previousDate) && state.activities.every((item) => item.activityDate === previousDate);
  const shouldUpdateAll = !anyManualDate || allMatchPrevious;

  state.activities.forEach((activity) => {
    const shouldUpdate = shouldUpdateAll
      ? !activity.isDateManual
      : !activity.isDateManual && activity.activityDate === previousDate;
    if (shouldUpdate) {
      activity.activityDate = newDate;
    }
  });

  sortActivities();
};

export const utils = { toMinutes, formatTime, toDateTime, formatFromDate, normalizeDate, todayISO };

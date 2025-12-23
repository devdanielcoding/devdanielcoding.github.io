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

const formatTime = (minutes) => {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const nextSlot = () => {
  if (state.activities.length === 0) {
    const now = new Date();
    const baseHour = Math.max(7, Math.min(18, now.getHours()));
    const start = `${String(baseHour).padStart(2, '0')}:00`;
    return { start, end: formatTime(toMinutes(start) + 60) };
  }
  const last = state.activities[state.activities.length - 1];
  const endMinutes = toMinutes(last.end);
  const start = formatTime(endMinutes + 15);
  const end = formatTime(endMinutes + 75);
  return { start, end };
};

const createActivity = (payload = {}) => {
  const slot = nextSlot();
  return {
    id: `act-${Date.now()}-${idCounter++}`,
    start: payload.start || slot.start,
    end: payload.end || slot.end,
    description: payload.description || 'Actividad'
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
  Object.assign(target, payload);
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
    description: item.description || 'Actividad'
  }));
};

export const ensureMinimumActivities = () => {
  while (state.activities.length < 2) {
    addActivity();
  }
};

export const sortActivities = () => {
  state.activities.sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
};

export const utils = { toMinutes, formatTime };

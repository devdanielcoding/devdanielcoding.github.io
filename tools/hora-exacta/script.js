const clockEl = document.getElementById("clock");
const dateEl = document.getElementById("date");
const timezoneEl = document.getElementById("timezone");
const feedbackEl = document.getElementById("feedback");
const fullscreenHint = document.getElementById("fullscreenHint");
const app = document.getElementById("app");

const shareButton = document.getElementById("shareButton");
const textDown = document.getElementById("textDown");
const textUp = document.getElementById("textUp");
const fullscreenButton = document.getElementById("fullscreenButton");
const fullscreenIcon = document.getElementById("fullscreenIcon");

const DATE_FORMATTER = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
});

const TIME_FORMATTER = new Intl.DateTimeFormat("es-ES", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const TIMEZONE_FORMATTER = new Intl.DateTimeFormat("es-ES", {
  timeZoneName: "longOffset",
});

/**
 * Render clock and date using device time.
 */
function updateClock() {
  const now = new Date();
  clockEl.textContent = TIME_FORMATTER.format(now);

  const dateText = DATE_FORMATTER.format(now);
  dateEl.textContent = capitalize(dateText);
}

/**
 * Display a human-friendly timezone string based on device settings.
 */
function updateTimezone() {
  const { timeZone } = Intl.DateTimeFormat().resolvedOptions();
  const sample = new Date();
  const zoneLabel = TIMEZONE_FORMATTER.format(sample);
  const friendlyZone = timeZone.replace(/_/g, " ");
  timezoneEl.textContent = `${friendlyZone} · ${zoneLabel}`;
}

/**
 * Capitalize first letter of the provided text.
 * @param {string} text
 * @returns {string}
 */
function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Provide temporary feedback text.
 * @param {string} message
 * @param {number} duration
 */
function showFeedback(message, duration = 1800) {
  feedbackEl.textContent = message;
  feedbackEl.hidden = false;

  setTimeout(() => {
    feedbackEl.hidden = true;
    feedbackEl.textContent = "";
  }, duration);
}

/**
 * Attempt to share the page, with clipboard fallback.
 */
async function handleShare() {
  const shareData = {
    title: document.title,
    text: "Consulta la hora exacta de tu dispositivo.",
    url: window.location.href,
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
      showFeedback("Enlace compartido");
    } else {
      throw new Error("Web Share API no disponible");
    }
  } catch (error) {
    try {
      await navigator.clipboard.writeText(shareData.url);
      showFeedback("Enlace copiado al portapapeles");
    } catch (clipboardError) {
      console.error("No se pudo copiar el enlace:", clipboardError);
      showFeedback("No se pudo compartir el enlace");
    }
  }
}

/**
 * Adjust text size by toggling classes.
 * @param {'up' | 'down'} direction
 */
function handleTextResize(direction) {
  app.classList.remove("small-text", "large-text");

  if (direction === "down") {
    app.classList.add("small-text");
  } else if (direction === "up") {
    app.classList.add("large-text");
  }
}

/**
 * Request fullscreen or exit if already enabled.
 */
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    app.requestFullscreen().catch((err) => {
      console.error("No se pudo activar pantalla completa:", err);
      showFeedback("Pantalla completa no disponible");
    });
  } else {
    document.exitFullscreen().catch((err) => {
      console.error("No se pudo salir de pantalla completa:", err);
      showFeedback("No se pudo salir de pantalla completa");
    });
  }
}

/**
 * Update UI according to fullscreen state.
 */
function handleFullscreenChange() {
  const active = Boolean(document.fullscreenElement);
  shareButton.hidden = active;
  fullscreenHint.hidden = !active;
  fullscreenIcon.textContent = active ? "\u274c" : "\u2692";
  fullscreenButton.title = active ? "Salir de pantalla completa" : "Pantalla completa";
}

/**
 * Initialize event listeners and timers.
 */
function init() {
  updateClock();
  updateTimezone();
  setInterval(updateClock, 1000);

  shareButton.addEventListener("click", handleShare);
  textDown.addEventListener("click", () => handleTextResize("down"));
  textUp.addEventListener("click", () => handleTextResize("up"));
  fullscreenButton.addEventListener("click", toggleFullscreen);
  document.addEventListener("fullscreenchange", handleFullscreenChange);
}

document.addEventListener("DOMContentLoaded", init);

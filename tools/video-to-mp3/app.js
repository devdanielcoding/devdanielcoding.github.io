import { convertVideoToMp3, initFFmpeg, setProgressHandler } from "./lib/ffmpegClient.js";

console.log("[video-to-mp3] app.js loaded");

const MAX_DURATION_SECONDS = 240;
const MAX_FILE_MB = 200;
const SUPPORTED_EXTENSIONS = ["mp4", "mov", "webm"];
const SUPPORTED_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const fileMeta = document.getElementById("fileMeta");
const fileWarnings = document.getElementById("fileWarnings");
const bitrateSelect = document.getElementById("bitrate");
const channelsSelect = document.getElementById("channels");
const convertBtn = document.getElementById("convertBtn");
const resetBtn = document.getElementById("resetBtn");
const statusEl = document.getElementById("status");
const loadProgress = document.getElementById("loadProgress");
const convertProgress = document.getElementById("convertProgress");
const downloadBtn = document.getElementById("downloadBtn");
const preview = document.getElementById("preview");

let selectedFile = null;
let outputUrl = null;
let ffmpegLoaded = false;

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function updateStatus(text, tone = "") {
  statusEl.textContent = text;
  statusEl.dataset.tone = tone;
}

function setWarnings(messages) {
  fileWarnings.innerHTML = "";
  if (!messages.length) return;
  const list = document.createElement("ul");
  list.className = "warnings-list";
  messages.forEach((msg) => {
    const item = document.createElement("li");
    item.textContent = msg;
    list.appendChild(item);
  });
  fileWarnings.appendChild(list);
}

function resetUI() {
  selectedFile = null;
  convertBtn.disabled = true;
  fileInput.value = "";
  fileMeta.textContent = "Sin archivo seleccionado.";
  setWarnings([]);
  updateStatus("Listo para convertir.");
  loadProgress.value = 0;
  convertProgress.value = 0;
  if (outputUrl) {
    URL.revokeObjectURL(outputUrl);
    outputUrl = null;
  }
  downloadBtn.hidden = true;
  preview.hidden = true;
  preview.removeAttribute("src");
}

async function getVideoDuration(file) {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    video.preload = "metadata";
    video.src = url;
    video.onloadedmetadata = () => {
      const duration = video.duration;
      URL.revokeObjectURL(url);
      resolve(duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
  });
}

function isSupportedFile(file) {
  if (!file) return false;
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (SUPPORTED_TYPES.includes(file.type)) return true;
  return SUPPORTED_EXTENSIONS.includes(extension);
}

function setFileInfo(file, durationSeconds) {
  const info = [
    `Archivo: ${file.name}`,
    `Tamaño: ${formatBytes(file.size)}`,
    file.type ? `Tipo: ${file.type}` : null,
    durationSeconds ? `Duración: ${durationSeconds.toFixed(1)}s` : null
  ].filter(Boolean);
  fileMeta.textContent = info.join(" · ");
}

async function handleFileSelection(file) {
  resetWarningsAndProgress();
  if (!file) return;

  if (!isSupportedFile(file)) {
    setWarnings(["Formato no soportado. Usa mp4, mov o webm."]);
    updateStatus("Selecciona un video válido.", "error");
    return;
  }

  const sizeMb = file.size / (1024 * 1024);
  if (sizeMb > MAX_FILE_MB) {
    setWarnings([`El archivo supera ${MAX_FILE_MB} MB. Reduce el tamaño o recorta el video.`]);
    updateStatus("Archivo demasiado grande.", "error");
    return;
  }

  const duration = await getVideoDuration(file);
  const warnings = [];
  if (!duration) {
    warnings.push("No pudimos detectar la duración. Continúa bajo tu responsabilidad.");
  } else if (duration > MAX_DURATION_SECONDS) {
    warnings.push(`La duración supera ${MAX_DURATION_SECONDS / 60} minutos.`);
  }

  if (duration && duration > MAX_DURATION_SECONDS) {
    setWarnings(warnings);
    updateStatus("Video demasiado largo.", "error");
    setFileInfo(file, duration);
    return;
  }

  selectedFile = file;
  setFileInfo(file, duration || null);
  setWarnings(warnings);
  convertBtn.disabled = false;
  updateStatus("Listo para convertir.");
}

function resetWarningsAndProgress() {
  setWarnings([]);
  updateStatus("Listo para convertir.");
  convertProgress.value = 0;
}

async function ensureFFmpegLoaded() {
  if (ffmpegLoaded) return true;
  updateStatus("Cargando motor…");
  loadProgress.value = 0;
  setProgressHandler((progress) => {
    const value = Math.min(100, Math.round(progress * 100));
    loadProgress.value = value;
  });

  try {
    await initFFmpeg();
    ffmpegLoaded = true;
    loadProgress.value = 100;
    updateStatus("Motor listo. Puedes convertir.");
    return true;
  } catch (error) {
    console.error("[video-to-mp3] Error cargando FFmpeg", error);
    loadProgress.value = 0;
    const message = error?.message ? `Error: ${error.message}` : "Error al cargar el motor.";
    updateStatus(message, "error");
    setWarnings([
      "Esta herramienta requiere WebAssembly. En algunos entornos puede fallar por falta de memoria o restricciones del navegador."
    ]);
    return false;
  }
}

async function handleConvert() {
  if (!selectedFile) return;
  const canLoad = await ensureFFmpegLoaded();
  if (!canLoad) return;

  convertBtn.disabled = true;
  updateStatus("Convirtiendo…");
  convertProgress.value = 0;
  setProgressHandler((progress) => {
    const value = Math.min(100, Math.round(progress * 100));
    convertProgress.value = value;
  });

  try {
    const bitrate = bitrateSelect.value;
    const channels = channelsSelect.value;
    const mp3Blob = await convertVideoToMp3({ file: selectedFile, bitrate, channels });
    outputUrl = URL.createObjectURL(mp3Blob);
    downloadBtn.href = outputUrl;
    downloadBtn.download = `${selectedFile.name.replace(/\.[^/.]+$/, "") || "audio"}.mp3`;
    downloadBtn.hidden = false;
    preview.src = outputUrl;
    preview.hidden = false;
    updateStatus("Listo. Descarga tu MP3.");
  } catch (error) {
    console.error("[video-to-mp3] Error en la conversión", error);
    const message = error?.message ? `Error: ${error.message}` : "Error en la conversión.";
    updateStatus(message, "error");
    setWarnings([
      "Si el fallo persiste, intenta en un navegador de escritorio con más memoria disponible."
    ]);
  } finally {
    convertBtn.disabled = false;
  }
}

function handleDropEvent(event) {
  event.preventDefault();
  dropzone.classList.remove("is-dragging");
  const file = event.dataTransfer?.files?.[0];
  if (file) {
    handleFileSelection(file);
  }
}

function attachDropzoneHandlers() {
  ["dragenter", "dragover"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.add("is-dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.remove("is-dragging");
    });
  });

  dropzone.addEventListener("drop", handleDropEvent);
  dropzone.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      fileInput.click();
    }
  });
}

fileInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (file) handleFileSelection(file);
});

convertBtn.addEventListener("click", handleConvert);
resetBtn.addEventListener("click", resetUI);

attachDropzoneHandlers();
resetUI();

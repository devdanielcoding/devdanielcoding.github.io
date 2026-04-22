import { describeFile, getMarkdownFilename, readHtmlFile, validateHtmlFile } from "./fileHandler.js";
import { parseHtmlString } from "./htmlParser.js";
import { cleanDocumentContent } from "./contentCleaner.js";
import { convertHtmlToMarkdown } from "./markdownConverter.js";

const state = {
  file: null,
  markdown: "",
  markdownFilename: "contenido.md"
};

const elements = {
  year: document.getElementById("year"),
  fileInput: document.getElementById("html-file"),
  dropZone: document.getElementById("drop-zone"),
  fileSummary: document.getElementById("file-summary"),
  convertButton: document.getElementById("convert-btn"),
  clearButton: document.getElementById("clear-btn"),
  copyButton: document.getElementById("copy-btn"),
  downloadButton: document.getElementById("download-btn"),
  markdownOutput: document.getElementById("markdown-output"),
  outputMeta: document.getElementById("output-meta"),
  status: document.getElementById("status")
};

function setStatus(message, type = "info") {
  elements.status.textContent = message;
  elements.status.dataset.type = type;
}

function setMarkdown(markdown, filename) {
  state.markdown = markdown;
  state.markdownFilename = filename;
  elements.markdownOutput.value = markdown;
  elements.outputMeta.textContent = `${markdown.length.toLocaleString("es-PE")} caracteres generados.`;
  elements.copyButton.disabled = false;
  elements.downloadButton.disabled = false;
}

function resetOutput() {
  state.markdown = "";
  state.markdownFilename = "contenido.md";
  elements.markdownOutput.value = "";
  elements.outputMeta.textContent = "El resultado aparecerá aquí.";
  elements.copyButton.disabled = true;
  elements.downloadButton.disabled = true;
}

function selectFile(file) {
  try {
    validateHtmlFile(file);
    state.file = file;
    elements.fileSummary.textContent = describeFile(file);
    elements.convertButton.disabled = false;
    resetOutput();
    setStatus("Archivo cargado. Puedes convertirlo cuando quieras.", "success");
  } catch (error) {
    state.file = null;
    elements.fileInput.value = "";
    elements.fileSummary.textContent = describeFile(null);
    elements.convertButton.disabled = true;
    resetOutput();
    setStatus(error.message, "error");
  }
}

async function convertSelectedFile() {
  try {
    elements.convertButton.disabled = true;
    setStatus("Convirtiendo HTML localmente...", "info");

    const html = await readHtmlFile(state.file);
    const document = parseHtmlString(html);
    const cleanContent = cleanDocumentContent(document);
    const markdown = convertHtmlToMarkdown(cleanContent);

    setMarkdown(markdown, getMarkdownFilename(state.file));
    setStatus("Conversión completada. El archivo nunca salió de tu navegador.", "success");
  } catch (error) {
    resetOutput();
    setStatus(error.message, "error");
  } finally {
    elements.convertButton.disabled = !state.file;
  }
}

async function copyMarkdown() {
  if (!state.markdown) return;

  try {
    await navigator.clipboard.writeText(state.markdown);
    setStatus("Markdown copiado al portapapeles.", "success");
  } catch (error) {
    elements.markdownOutput.focus();
    elements.markdownOutput.select();
    document.execCommand("copy");
    setStatus("Markdown copiado al portapapeles.", "success");
  }
}

function downloadMarkdown() {
  if (!state.markdown) return;

  const blob = new Blob([state.markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = state.markdownFilename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setStatus(`Descarga preparada: ${state.markdownFilename}`, "success");
}

function clearAll() {
  state.file = null;
  elements.fileInput.value = "";
  elements.fileSummary.textContent = describeFile(null);
  elements.convertButton.disabled = true;
  resetOutput();
  setStatus("Listo para convertir.", "info");
}

function bindDragAndDrop() {
  ["dragenter", "dragover"].forEach((eventName) => {
    elements.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.dropZone.classList.add("drag-over");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    elements.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.dropZone.classList.remove("drag-over");
    });
  });

  elements.dropZone.addEventListener("drop", (event) => {
    const [file] = event.dataTransfer.files;
    if (file) selectFile(file);
  });
}

function init() {
  elements.year.textContent = new Date().getFullYear();

  elements.fileInput.addEventListener("change", (event) => {
    const [file] = event.target.files;
    selectFile(file);
  });

  elements.convertButton.addEventListener("click", convertSelectedFile);
  elements.clearButton.addEventListener("click", clearAll);
  elements.copyButton.addEventListener("click", copyMarkdown);
  elements.downloadButton.addEventListener("click", downloadMarkdown);
  elements.markdownOutput.addEventListener("input", (event) => {
    state.markdown = event.target.value;
    const hasMarkdown = state.markdown.trim().length > 0;
    elements.copyButton.disabled = !hasMarkdown;
    elements.downloadButton.disabled = !hasMarkdown;
  });

  bindDragAndDrop();
}

init();

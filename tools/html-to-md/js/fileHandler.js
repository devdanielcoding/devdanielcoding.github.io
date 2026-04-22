const HTML_EXTENSIONS = [".html", ".htm"];
const HTML_MIME_TYPES = ["text/html", "application/xhtml+xml"];

export function validateHtmlFile(file) {
  if (!file) {
    throw new Error("Selecciona un archivo HTML para continuar.");
  }

  const filename = file.name.toLowerCase();
  const hasHtmlExtension = HTML_EXTENSIONS.some((extension) => filename.endsWith(extension));
  const hasHtmlMimeType = HTML_MIME_TYPES.includes(file.type);

  if (!hasHtmlExtension && !hasHtmlMimeType) {
    throw new Error("El archivo debe tener extension .html o .htm.");
  }

  if (file.size === 0) {
    throw new Error("El archivo está vacío.");
  }
}

export async function readHtmlFile(file) {
  validateHtmlFile(file);

  if (typeof file.text === "function") {
    return file.text();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsText(file);
  });
}

export function getMarkdownFilename(file) {
  const fallback = "contenido.md";
  if (!file?.name) return fallback;

  const cleanName = file.name.replace(/\.(html?|xhtml)$/i, "").trim();
  return `${cleanName || "contenido"}.md`;
}

export function describeFile(file) {
  if (!file) return "Todavía no hay archivo seleccionado.";

  const sizeInKb = Math.max(1, Math.round(file.size / 1024));
  return `${file.name} - ${sizeInKb} KB`;
}

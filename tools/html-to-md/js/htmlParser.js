export function parseHtmlString(htmlString) {
  if (!htmlString || !htmlString.trim()) {
    throw new Error("El HTML no contiene texto para convertir.");
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(htmlString, "text/html");
  const parserError = document.querySelector("parsererror");

  if (parserError) {
    throw new Error("No se pudo interpretar el HTML del archivo.");
  }

  return document;
}

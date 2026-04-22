function normalizeMarkdown(markdown) {
  return markdown
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function convertHtmlToMarkdown(element) {
  if (!window.TurndownService) {
    throw new Error("Turndown no está disponible. Revisa que lib/turndown.js cargue correctamente.");
  }

  const turndownService = new window.TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "*",
    strongDelimiter: "**"
  });

  turndownService.keep(["table"]);
  turndownService.remove(["button", "form", "input", "select", "textarea"]);

  const markdown = normalizeMarkdown(turndownService.turndown(element));

  if (!markdown) {
    throw new Error("La conversión no produjo Markdown.");
  }

  return markdown;
}

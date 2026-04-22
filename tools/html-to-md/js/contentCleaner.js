const REMOVABLE_SELECTORS = [
  "script",
  "style",
  "nav",
  "footer",
  "aside",
  "iframe",
  "canvas",
  "svg",
  "noscript",
  "template",
  "[hidden]",
  "[aria-hidden='true']"
];

const PRIORITY_SELECTORS = ["main", "article", "section"];

function removeIrrelevantNodes(root) {
  root.querySelectorAll(REMOVABLE_SELECTORS.join(",")).forEach((node) => node.remove());
}

function removeEmptyTextNodes(root) {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const emptyNodes = [];

  while (walker.nextNode()) {
    if (!walker.currentNode.nodeValue.trim()) {
      emptyNodes.push(walker.currentNode);
    }
  }

  emptyNodes.forEach((node) => node.remove());
}

function getPriorityContent(document) {
  for (const selector of PRIORITY_SELECTORS) {
    const matches = Array.from(document.querySelectorAll(selector));
    const usefulMatches = matches.filter((node) => node.textContent.trim().length > 0);

    if (usefulMatches.length === 1) {
      return usefulMatches[0].cloneNode(true);
    }

    if (usefulMatches.length > 1) {
      const container = document.createElement("div");
      usefulMatches.forEach((node) => container.appendChild(node.cloneNode(true)));
      return container;
    }
  }

  return (document.body || document.documentElement).cloneNode(true);
}

export function cleanDocumentContent(document) {
  const content = getPriorityContent(document);
  removeIrrelevantNodes(content);
  removeEmptyTextNodes(content);

  if (!content.textContent.trim()) {
    throw new Error("No se encontró contenido útil después de limpiar el HTML.");
  }

  return content;
}

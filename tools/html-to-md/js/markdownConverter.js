function normalizeMarkdown(markdown) {
  return markdown
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeTableCell(value) {
  return value
    .replace(/\|/g, "\\|")
    .replace(/\n+/g, "<br>")
    .replace(/\s+/g, " ")
    .trim();
}

function getCellAlignment(cell) {
  const align = (cell.getAttribute("align") || cell.style.textAlign || "").toLowerCase();

  if (align === "center") return ":---:";
  if (align === "right") return "---:";
  if (align === "left") return ":---";
  return "---";
}

function getColumnSpan(cell) {
  const colspan = Number.parseInt(cell.getAttribute("colspan") || "1", 10);
  return Number.isFinite(colspan) && colspan > 1 ? colspan : 1;
}

function getRowCells(row, turndownService) {
  return Array.from(row.children)
    .filter((cell) => ["TD", "TH"].includes(cell.nodeName))
    .flatMap((cell) => {
      const markdown = turndownService.turndown(cell.innerHTML);
      const cells = [escapeTableCell(markdown)];
      const colspan = getColumnSpan(cell);

      for (let index = 1; index < colspan; index += 1) {
        cells.push("");
      }

      return cells;
    });
}

function padRow(row, columnCount) {
  const padded = row.slice(0, columnCount);

  while (padded.length < columnCount) {
    padded.push("");
  }

  return padded;
}

function rowToMarkdown(row) {
  return `| ${row.join(" | ")} |`;
}

function tableToMarkdown(table, turndownService) {
  const rows = Array.from(table.rows);

  if (!rows.length) return "";

  const firstRow = rows[0];
  const theadFirstRow = table.tHead?.rows?.[0] || null;
  const firstRowHasHeader = Array.from(firstRow.children).some((cell) => cell.nodeName === "TH");
  const headerRow = theadFirstRow || (firstRowHasHeader ? firstRow : null);
  const bodyRows = headerRow ? rows.filter((row) => row !== headerRow) : rows;
  const convertedRows = rows.map((row) => getRowCells(row, turndownService));
  const columnCount = Math.max(...convertedRows.map((row) => row.length), 1);
  const header = headerRow
    ? padRow(getRowCells(headerRow, turndownService), columnCount)
    : Array.from({ length: columnCount }, (_, index) => `Columna ${index + 1}`);
  const alignmentSource = headerRow || rows[0];
  const separator = padRow(
    Array.from(alignmentSource.children)
      .filter((cell) => ["TD", "TH"].includes(cell.nodeName))
      .flatMap((cell) => {
        const alignment = getCellAlignment(cell);
        return Array.from({ length: getColumnSpan(cell) }, () => alignment);
      }),
    columnCount
  );
  const body = bodyRows
    .map((row) => padRow(getRowCells(row, turndownService), columnCount))
    .filter((row) => row.some(Boolean));

  return [rowToMarkdown(header), rowToMarkdown(separator), ...body.map(rowToMarkdown)].join("\n");
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

  turndownService.addRule("markdownTable", {
    filter: (node) => node.nodeName === "TABLE",
    replacement: (_content, node) => {
      const tableMarkdown = tableToMarkdown(node, turndownService);
      return tableMarkdown ? `\n\n${tableMarkdown}\n\n` : "";
    }
  });

  turndownService.remove(["button", "form", "input", "select", "textarea"]);

  const markdown = normalizeMarkdown(turndownService.turndown(element));

  if (!markdown) {
    throw new Error("La conversión no produjo Markdown.");
  }

  return markdown;
}

(function () {
  "use strict";

  const EXAMPLE_SAS = [
    "proc sql;",
    "create table tabla_01 as",
    "select *",
    "from transacciones_diarias",
    "where fecha_contable = today() - 1;",
    "",
    "create table tabla_02 as",
    "select a.*,",
    "       case when monto < 0 then 'DEVOLUCION' else 'BOLETA' end as indicador_venta",
    "from tabla_01 a",
    "left join clientes b",
    "  on a.id_cliente = b.id_cliente",
    "where b.activo = 1;",
    "",
    "create table tabla_03 as",
    "select *",
    "from tabla_02",
    "where id_cliente in (",
    "    select id_cliente",
    "    from clientes_preferentes",
    ");",
    "quit;",
    "",
    "data tabla_04;",
    "merge tabla_03 maestros_producto;",
    "by id_producto;",
    "run;",
    "",
    "proc s3;",
    "put tabla_04 s3://mi-bucket/reportes/tabla_04.csv;",
    "run;"
  ].join("\n");

  const state = {
    editor: null,
    graph: null,
    analysis: emptyAnalysis(),
    selectedStepId: null,
    ignoreCursorSync: false
  };

  const elements = {
    analyzeBtn: document.getElementById("analyzeBtn"),
    loadExampleBtn: document.getElementById("loadExampleBtn"),
    clearBtn: document.getElementById("clearBtn"),
    fileInput: document.getElementById("fileInput"),
    detailsStatus: document.getElementById("detailsStatus"),
    detailsGrid: document.getElementById("detailsGrid"),
    rawCode: document.getElementById("rawCode"),
    stepMeta: document.getElementById("stepMeta"),
    jsonPreview: document.getElementById("jsonPreview")
  };

  init();

  function init() {
    state.editor = createEditor();
    state.graph = createGraph();
    bindEvents();
    loadExampleIntoEditor();
  }

  function createEditor() {
    return CodeMirror.fromTextArea(document.getElementById("sasEditor"), {
      mode: "text/x-sql",
      theme: "material-darker",
      lineNumbers: true,
      lineWrapping: true,
      tabSize: 2,
      viewportMargin: Infinity
    });
  }

  function createGraph() {
    return cytoscape({
      container: document.getElementById("graph"),
      elements: [],
      style: [
        {
          selector: "node",
          style: {
            "background-color": "#244c5a",
            color: "#fffaf4",
            label: "data(label)",
            "font-size": 11,
            "text-wrap": "wrap",
            "text-max-width": 120,
            "text-valign": "center",
            "text-halign": "center",
            padding: "12px",
            width: "label",
            height: 48,
            shape: "round-rectangle",
            "border-width": 2,
            "border-color": "#fff4ea"
          }
        },
        {
          selector: 'node[nodeRole = "source"]',
          style: {
            "background-color": "#5d7a48"
          }
        },
        {
          selector: 'node[nodeRole = "intermediate"]',
          style: {
            "background-color": "#244c5a"
          }
        },
        {
          selector: 'node[nodeRole = "final"]',
          style: {
            "background-color": "#b85c38"
          }
        },
        {
          selector: 'node[nodeRole = "external"]',
          style: {
            "background-color": "#7f4f24",
            shape: "cut-rectangle"
          }
        },
        {
          selector: "edge",
          style: {
            width: 2.2,
            "line-color": "#bca48f",
            "target-arrow-color": "#bca48f",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            label: "data(label)",
            "font-size": 9,
            "text-background-opacity": 1,
            "text-background-color": "#fff8f0",
            "text-background-padding": 2,
            color: "#6b5647"
          }
        },
        {
          selector: ".is-highlighted",
          style: {
            "border-color": "#f2c078",
            "border-width": 4,
            "shadow-blur": 24,
            "shadow-color": "#f2c078",
            "shadow-opacity": 0.45
          }
        },
        {
          selector: ".is-related",
          style: {
            width: 3.4,
            "line-color": "#b85c38",
            "target-arrow-color": "#b85c38"
          }
        }
      ],
      layout: {
        name: "breadthfirst",
        directed: true,
        padding: 20,
        spacingFactor: 1.15
      }
    });
  }

  function bindEvents() {
    elements.analyzeBtn.addEventListener("click", analyzeCurrentScript);
    elements.loadExampleBtn.addEventListener("click", loadExampleIntoEditor);
    elements.clearBtn.addEventListener("click", clearEditor);
    elements.fileInput.addEventListener("change", handleFileLoad);

    state.editor.on("cursorActivity", function () {
      if (state.ignoreCursorSync) {
        return;
      }

      const line = state.editor.getCursor().line + 1;
      const step = findStepByLine(line);
      if (step) {
        selectStep(step.id, { focusEditor: false, centerGraph: true });
      }
    });

    state.graph.on("tap", "node", function (event) {
      const node = event.target.data();
      const stepId = pickStepForNode(node);
      if (stepId) {
        selectStep(stepId, { focusEditor: true, centerGraph: true });
      }
    });
  }

  function loadExampleIntoEditor() {
    state.editor.setValue(EXAMPLE_SAS);
    analyzeCurrentScript();
  }

  function clearEditor() {
    state.editor.setValue("");
    analyzeCurrentScript();
  }

  function handleFileLoad(event) {
    const [file] = event.target.files || [];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = function (loadEvent) {
      state.editor.setValue(String(loadEvent.target.result || ""));
      analyzeCurrentScript();
    };
    reader.readAsText(file, "utf-8");
    event.target.value = "";
  }

  function analyzeCurrentScript() {
    const code = state.editor.getValue();
    state.analysis = parseSasScript(code);
    elements.jsonPreview.textContent = JSON.stringify(state.analysis, null, 2);
    renderGraph(state.analysis);

    if (state.analysis.steps.length > 0) {
      selectStep(state.analysis.steps[0].id, { focusEditor: false, centerGraph: true });
    } else {
      renderEmptyDetails();
    }
  }

  function parseSasScript(script) {
    if (!script.trim()) {
      return emptyAnalysis();
    }

    const lines = script.split(/\r?\n/);
    // First we find only the top-level SAS constructs that the MVP understands.
    const topBlocks = splitTopLevelBlocks(lines);
    const steps = [];
    let stepCounter = 1;

    topBlocks.forEach(function (block) {
      if (block.kind === "proc_sql") {
        parseProcSqlBlock(block).forEach(function (step) {
          step.id = "step-" + stepCounter++;
          steps.push(step);
        });
      } else if (block.kind === "data_step") {
        const step = parseDataStepBlock(block);
        if (step) {
          step.id = "step-" + stepCounter++;
          steps.push(step);
        }
      } else if (block.kind === "proc_s3") {
        parseProcS3Block(block).forEach(function (step) {
          step.id = "step-" + stepCounter++;
          steps.push(step);
        });
      }
    });

    return buildGraphModel(steps);
  }

  function splitTopLevelBlocks(lines) {
    const blocks = [];
    let index = 0;

    while (index < lines.length) {
      const line = lines[index];
      const trimmed = line.trim().toLowerCase();

      if (!trimmed) {
        index += 1;
        continue;
      }

      if (trimmed.startsWith("proc sql")) {
        const endIndex = findEndLine(lines, index + 1, /^quit\s*;?/i);
        blocks.push(makeBlock("proc_sql", lines, index, endIndex));
        index = endIndex + 1;
        continue;
      }

      if (trimmed.startsWith("proc s3")) {
        const endIndex = findEndLine(lines, index + 1, /^run\s*;?/i);
        blocks.push(makeBlock("proc_s3", lines, index, endIndex));
        index = endIndex + 1;
        continue;
      }

      if (trimmed.startsWith("data ")) {
        const endIndex = findEndLine(lines, index + 1, /^run\s*;?/i);
        blocks.push(makeBlock("data_step", lines, index, endIndex));
        index = endIndex + 1;
        continue;
      }

      index += 1;
    }

    return blocks;
  }

  function makeBlock(kind, lines, startIndex, endIndex) {
    return {
      kind: kind,
      codeStart: startIndex + 1,
      codeEnd: endIndex + 1,
      rawCode: lines.slice(startIndex, endIndex + 1).join("\n")
    };
  }

  function findEndLine(lines, startIndex, matcher) {
    for (let index = startIndex; index < lines.length; index += 1) {
      if (matcher.test(lines[index].trim())) {
        return index;
      }
    }
    return lines.length - 1;
  }

  function parseProcSqlBlock(block) {
    const content = block.rawCode;
    const createRegex = /create\s+table\s+([a-z_][\w.]*)\s+as\b/gi;
    const matches = [];
    let match;

    while ((match = createRegex.exec(content)) !== null) {
      matches.push({
        target: normalizeName(match[1]),
        index: match.index
      });
    }

    return matches.map(function (entry, position) {
      const blockStartOffset = entry.index;
      const blockEndOffset = position + 1 < matches.length ? matches[position + 1].index : content.length;
      const rawCode = content.slice(blockStartOffset, blockEndOffset).trim();
      // Code lines are kept so we can sync editor cursor <-> graph selection.
      const startLineOffset = countLines(content.slice(0, blockStartOffset));
      const codeStart = block.codeStart + startLineOffset;
      const codeEnd = codeStart + countLines(rawCode) - 1;

      return {
        id: "",
        type: "proc_sql",
        label: "CREATE TABLE " + entry.target,
        sourceTables: uniqueList(extractSqlSourceTables(rawCode)),
        targetTables: [entry.target],
        externalTargets: [],
        derivedColumns: uniqueList(extractDerivedColumns(rawCode)),
        filters: uniqueList(extractWhereClauses(rawCode)),
        joins: uniqueList(extractJoinClauses(rawCode)),
        codeStart: codeStart,
        codeEnd: codeEnd,
        rawCode: rawCode
      };
    });
  }

  function parseDataStepBlock(block) {
    const targetMatch = block.rawCode.match(/data\s+([a-z_][\w.]*)\s*;/i);
    if (!targetMatch) {
      return null;
    }

    const setTables = collectMatches(block.rawCode, /\bset\s+([^;]+);/gi)
      .flatMap(splitObjectList);
    const mergeTables = collectMatches(block.rawCode, /\bmerge\s+([^;]+);/gi)
      .flatMap(splitObjectList);
    const sourceTables = uniqueList(setTables.concat(mergeTables).map(normalizeName));
    const byClauses = collectMatches(block.rawCode, /\bby\s+([^;]+);/gi);

    return {
      id: "",
      type: "data_step",
      label: "DATA " + normalizeName(targetMatch[1]),
      sourceTables: sourceTables,
      targetTables: [normalizeName(targetMatch[1])],
      externalTargets: [],
      derivedColumns: [],
      filters: byClauses.map(cleanWhitespace),
      joins: mergeTables.length ? ["merge " + mergeTables.map(normalizeName).join(", ")] : [],
      codeStart: block.codeStart,
      codeEnd: block.codeEnd,
      rawCode: block.rawCode.trim()
    };
  }

  function parseProcS3Block(block) {
    const putRegex = /\bput\s+([a-z_][\w.]*)\s+(s3:\/\/[^\s;]+)\s*;/gi;
    const steps = [];
    let match;

    while ((match = putRegex.exec(block.rawCode)) !== null) {
      const rawCode = match[0].trim();
      const startLineOffset = countLines(block.rawCode.slice(0, match.index)) - 1;
      const codeStart = block.codeStart + Math.max(0, startLineOffset);

      steps.push({
        id: "",
        type: "proc_s3",
        label: "EXPORT " + normalizeName(match[1]) + " → S3",
        sourceTables: [normalizeName(match[1])],
        targetTables: [],
        externalTargets: [match[2]],
        derivedColumns: [],
        filters: [],
        joins: [],
        codeStart: codeStart,
        codeEnd: codeStart + countLines(rawCode) - 1,
        rawCode: rawCode
      });
    }

    return steps;
  }

  function buildGraphModel(steps) {
    const nodeMap = new Map();
    const edges = [];
    const producedTargets = new Set();

    steps.forEach(function (step) {
      step.sourceTables.forEach(function (tableName) {
        upsertNode(nodeMap, tableName, {
          nodeType: "table",
          label: tableName
        });
      });

      step.targetTables.forEach(function (tableName) {
        upsertNode(nodeMap, tableName, {
          nodeType: "table",
          label: tableName,
          producedByStepId: step.id
        });
        producedTargets.add(tableName);
      });

      step.externalTargets.forEach(function (target) {
        upsertNode(nodeMap, target, {
          nodeType: "external",
          label: target,
          producedByStepId: step.id
        });
      });

      step.sourceTables.forEach(function (sourceName) {
        step.targetTables.forEach(function (targetName) {
          edges.push(makeEdge(sourceName, targetName, step.id, step.type));
        });

        step.externalTargets.forEach(function (targetName) {
          edges.push(makeEdge(sourceName, targetName, step.id, step.type));
        });
      });
    });

    const dedupedEdges = dedupeEdges(edges);

    const allNodes = Array.from(nodeMap.values()).map(function (node) {
      const hasIncoming = edges.some(function (edge) {
        return edge.target === node.id;
      });
      const outgoingEdges = dedupedEdges.filter(function (edge) {
        return edge.source === node.id;
      });
      const hasOutgoing = outgoingEdges.length > 0;
      const isExternal = node.nodeType === "external";
      const onlyExports = outgoingEdges.length > 0 && outgoingEdges.every(function (edge) {
        const targetNode = nodeMap.get(edge.target);
        return targetNode && targetNode.nodeType === "external";
      });

      let nodeRole = "intermediate";
      if (isExternal) {
        nodeRole = "external";
      } else if (!producedTargets.has(node.id)) {
        nodeRole = "source";
      } else if (!hasOutgoing || onlyExports) {
        nodeRole = "final";
      } else if (!hasIncoming) {
        nodeRole = "source";
      }

      return Object.assign({}, node, {
        nodeRole: nodeRole
      });
    });

    return {
      nodes: allNodes,
      edges: dedupedEdges,
      steps: steps
    };
  }

  function upsertNode(nodeMap, name, patch) {
    const id = String(name);
    const current = nodeMap.get(id) || {
      id: id,
      label: id,
      nodeType: "table",
      nodeRole: "intermediate",
      producedByStepId: null
    };

    nodeMap.set(id, Object.assign({}, current, patch, { id: id }));
  }

  function makeEdge(source, target, stepId, type) {
    return {
      id: [source, target, stepId].join("::"),
      source: source,
      target: target,
      stepId: stepId,
      label: edgeLabel(type)
    };
  }

  function edgeLabel(type) {
    if (type === "data_step") {
      return "data step";
    }
    if (type === "proc_s3") {
      return "export";
    }
    return "sql";
  }

  function dedupeEdges(edges) {
    const byId = new Map();
    edges.forEach(function (edge) {
      byId.set(edge.id, edge);
    });
    return Array.from(byId.values());
  }

  function renderGraph(analysis) {
    // The graph is derived entirely from the intermediate JSON model.
    const elements = analysis.nodes.map(function (node) {
      return {
        group: "nodes",
        data: node
      };
    }).concat(analysis.edges.map(function (edge) {
      return {
        group: "edges",
        data: edge
      };
    }));

    state.graph.elements().remove();
    state.graph.add(elements);
    state.graph.layout({
      name: "breadthfirst",
      directed: true,
      padding: 28,
      spacingFactor: 1.2,
      animate: false
    }).run();
  }

  function selectStep(stepId, options) {
    const step = state.analysis.steps.find(function (item) {
      return item.id === stepId;
    });
    if (!step) {
      return;
    }

    state.selectedStepId = stepId;
    renderStepDetails(step);
    highlightGraphForStep(step, options.centerGraph);

    if (options.focusEditor) {
      jumpEditorToLine(step.codeStart);
    }
  }

  function renderStepDetails(step) {
    elements.detailsStatus.textContent = step.label;
    elements.stepMeta.textContent = "Líneas " + step.codeStart + "-" + step.codeEnd;
    elements.rawCode.textContent = step.rawCode;

    const items = [
      makeDetailHTML("Tipo de operación", escapeHtml(step.type)),
      makeDetailHTML("Tablas fuente", makePills(step.sourceTables)),
      makeDetailHTML("Tabla destino", makePills(step.targetTables)),
      makeDetailHTML("Destinos externos", makePills(step.externalTargets)),
      makeDetailHTML("Joins detectados", makePills(step.joins)),
      makeDetailHTML("Filtros detectados", makePills(step.filters)),
      makeDetailHTML("Columnas derivadas", makePills(step.derivedColumns))
    ];

    elements.detailsGrid.innerHTML = items.join("");
  }

  function renderEmptyDetails() {
    state.selectedStepId = null;
    elements.detailsStatus.textContent = "No se detectaron bloques compatibles en el script actual.";
    elements.detailsGrid.innerHTML = "";
    elements.stepMeta.textContent = "Sin bloque activo";
    elements.rawCode.textContent = "El parser heurístico reconoce PROC SQL, DATA STEP y PROC S3.";
    clearGraphHighlight();
  }

  function makeDetailHTML(label, valueHTML) {
    return [
      '<div class="details-item">',
      '<div class="details-label">', label, "</div>",
      '<div class="details-value">', valueHTML, "</div>",
      "</div>"
    ].join("");
  }

  function makePills(items) {
    if (!items || items.length === 0) {
      return '<span class="is-empty">Sin datos</span>';
    }

    return '<div class="pill-list">' + items.map(function (item) {
      return '<span class="pill">' + escapeHtml(item) + "</span>";
    }).join("") + "</div>";
  }

  function highlightGraphForStep(step, centerGraph) {
    clearGraphHighlight();

    const relatedNodeIds = step.sourceTables.concat(step.targetTables, step.externalTargets);
    relatedNodeIds.forEach(function (nodeId) {
      const node = state.graph.getElementById(nodeId);
      if (node && node.length) {
        node.addClass("is-highlighted");
      }
    });

    state.graph.edges().forEach(function (edge) {
      if (edge.data("stepId") === step.id) {
        edge.addClass("is-related");
      }
    });

    if (centerGraph && relatedNodeIds.length > 0) {
      const collection = relatedNodeIds
        .map(function (nodeId) {
          return state.graph.getElementById(nodeId);
        })
        .filter(function (node) {
          return node && node.length;
        });

      if (collection.length > 0) {
        state.graph.animate({
          fit: {
            eles: collection.reduce(function (acc, node) {
              return acc.add(node);
            }, state.graph.collection()),
            padding: 50
          }
        }, {
          duration: 200
        });
      }
    }
  }

  function clearGraphHighlight() {
    state.graph.nodes().removeClass("is-highlighted");
    state.graph.edges().removeClass("is-related");
  }

  function jumpEditorToLine(line) {
    state.ignoreCursorSync = true;
    const target = Math.max(0, line - 1);
    state.editor.setCursor({ line: target, ch: 0 });
    state.editor.focus();
    state.editor.scrollIntoView({ line: target, ch: 0 }, 120);
    window.setTimeout(function () {
      state.ignoreCursorSync = false;
    }, 100);
  }

  function findStepByLine(lineNumber) {
    return state.analysis.steps.find(function (step) {
      return lineNumber >= step.codeStart && lineNumber <= step.codeEnd;
    }) || null;
  }

  function pickStepForNode(node) {
    if (node.producedByStepId) {
      return node.producedByStepId;
    }

    const consumingEdge = state.analysis.edges.find(function (edge) {
      return edge.source === node.id;
    });

    return consumingEdge ? consumingEdge.stepId : null;
  }

  function extractSqlSourceTables(rawCode) {
    const sources = [];
    const fromMatches = collectMatches(rawCode, /\bfrom\s+([a-z_][\w.]*)/gi);
    const joinMatches = collectMatches(rawCode, /\b(?:left|right|inner|full|cross)?\s*join\s+([a-z_][\w.]*)/gi);
    return sources.concat(fromMatches, joinMatches).map(normalizeName);
  }

  function extractJoinClauses(rawCode) {
    return collectMatches(
      rawCode,
      /\b((?:left|right|inner|full|cross)?\s*join\s+[a-z_][\w.]*[\s\S]*?\bon\s+[\s\S]*?)(?=\b(?:left|right|inner|full|cross)?\s*join\b|\bwhere\b|\bgroup\s+by\b|\border\s+by\b|;)/gi
    ).map(cleanWhitespace);
  }

  function extractWhereClauses(rawCode) {
    return collectMatches(
      rawCode,
      /\bwhere\s+([\s\S]*?)(?=\bgroup\s+by\b|\border\s+by\b|;)/gi
    ).map(cleanWhitespace);
  }

  function extractDerivedColumns(rawCode) {
    const caseColumns = collectMatches(rawCode, /\bcase\b[\s\S]*?\bend\s+as\s+([a-z_][\w]*)/gi);
    const aliasColumns = collectMatches(rawCode, /(?:case\b[\s\S]*?\bend|[^,\n;]+?)\s+as\s+([a-z_][\w]*)/gi);
    return caseColumns.concat(aliasColumns).map(normalizeName);
  }

  function collectMatches(text, regex) {
    const matches = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match[1]) {
        matches.push(match[1]);
      }
    }
    return matches;
  }

  function splitObjectList(value) {
    return String(value)
      .split(/\s+/)
      .map(function (item) {
        return item.trim();
      })
      .filter(Boolean);
  }

  function normalizeName(value) {
    return cleanWhitespace(String(value || "").replace(/[;,]/g, "")).toUpperCase();
  }

  function cleanWhitespace(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function uniqueList(items) {
    return Array.from(new Set((items || []).filter(Boolean)));
  }

  function countLines(text) {
    if (!text) {
      return 0;
    }
    return text.split(/\r?\n/).length;
  }

  function emptyAnalysis() {
    return {
      nodes: [],
      edges: [],
      steps: []
    };
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();

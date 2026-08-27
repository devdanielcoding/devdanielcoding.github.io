/**
 * Visor de Especies en Grafo Interactivo con D3.js v7
 * Autor: devdanielcoding
 */

(function () {
  'use strict';

  // --- Elementos del DOM ---
  const svg = d3.select('#graphSvg');
  const viewport = document.getElementById('graphViewport');
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearch');
  const groupFilter = document.getElementById('groupFilter');
  const btnResetZoom = document.getElementById('btnResetZoom');
  const btnTogglePhysics = document.getElementById('btnTogglePhysics');

  // Drawer elements
  const detailDrawer = document.getElementById('detailDrawer');
  const btnCloseDrawer = document.getElementById('btnCloseDrawer');
  const drawerImage = document.getElementById('drawerImage');
  const drawerBadge = document.getElementById('drawerBadge');
  const drawerTitle = document.getElementById('drawerTitle');
  const drawerScientific = document.getElementById('drawerScientific');
  const drawerRank = document.getElementById('drawerRank');
  const drawerParent = document.getElementById('drawerParent');
  const drawerDescription = document.getElementById('drawerDescription');
  const drawerWikiLink = document.getElementById('drawerWikiLink');
  const drawerFocusBtn = document.getElementById('drawerFocusBtn');

  // --- Estado global ---
  let graphData = { nodes: [], links: [] };
  let simulation;
  let zoomBehavior;
  let gMain, gLinks, gNodes;
  let activeNode = null;
  let physicsRunning = true;

  // --- Colores y Estilos ---
  const BRANCH_COLORS = {
    carnivora: '#f43f5e',
    pinnipedia: '#0ea5e9',
    feliformia: '#f59e0b',
    caniformia: '#10b981',
    otariidae: '#38bdf8',
    phocidae: '#0284c7',
    odobenidae: '#0369a1',
    felidae: '#d97706',
    canidae: '#059669',
    ursidae: '#16a34a'
  };

  function getNodeColor(node) {
    if (node.color) return node.color;
    if (node.parent && BRANCH_COLORS[node.parent]) {
      return BRANCH_COLORS[node.parent];
    }
    // Buscar ancestro
    if (node.type === 'species') {
      const parentNode = graphData.nodes.find(n => n.id === node.parent);
      if (parentNode && parentNode.parent && BRANCH_COLORS[parentNode.parent]) {
        return BRANCH_COLORS[parentNode.parent];
      }
    }
    return '#94a3b8';
  }

  function getNodeRadius(node) {
    switch (node.type) {
      case 'root': return 32;
      case 'suborder': return 24;
      case 'family': return 18;
      case 'species': return 20;
      default: return 16;
    }
  }

  function getRankName(type) {
    switch (type) {
      case 'root': return 'Orden Principal';
      case 'suborder': return 'Suborden / Clado';
      case 'family': return 'Familia';
      case 'species': return 'Especie';
      default: return 'Taxón';
    }
  }

  // --- Carga de Datos e Inicialización ---
  async function init() {
    try {
      const response = await fetch('./data/animals.json');
      if (!response.ok) throw new Error('No se pudo cargar animals.json');
      graphData = await response.json();
      setupGraph();
      setupEventListeners();
    } catch (err) {
      console.error('Error al inicializar grafo:', err);
      viewport.innerHTML = `<div style="padding:40px;text-align:center;color:#f87171;">
        <h3>Error al cargar los datos del árbol</h3>
        <p>${err.message}</p>
      </div>`;
    }
  }

  function setupGraph() {
    const width = viewport.clientWidth || window.innerWidth;
    const height = viewport.clientHeight || window.innerHeight;

    svg.attr('viewBox', [0, 0, width, height]);

    // Contenedor principal con zoom
    gMain = svg.append('g').attr('class', 'g-main');

    // Patrones SVG para imágenes circulares de especies
    const defs = svg.append('defs');

    // Filtro de resplandor (Glow)
    const filter = defs.append('filter')
      .attr('id', 'glow')
      .attr('x', '-50%').attr('y', '-50%')
      .attr('width', '200%').attr('height', '200%');
    filter.append('feGaussianBlur')
      .attr('stdDeviation', '4')
      .attr('result', 'coloredBlur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Crear clipPaths e imágenes dentro de patrones para cada nodo con foto
    graphData.nodes.forEach(node => {
      if (node.image) {
        const radius = getNodeRadius(node);
        const pattern = defs.append('pattern')
          .attr('id', `pat-${node.id}`)
          .attr('width', 1)
          .attr('height', 1)
          .attr('patternContentUnits', 'objectBoundingBox');

        pattern.append('image')
          .attr('href', node.image)
          .attr('preserveAspectRatio', 'xMidYMid slice')
          .attr('width', 1)
          .attr('height', 1);
      }
    });

    // Grupos para enlaces y nodos
    gLinks = gMain.append('g').attr('class', 'g-links');
    gNodes = gMain.append('g').attr('class', 'g-nodes');

    // Simulación de Fuerzas D3
    simulation = d3.forceSimulation(graphData.nodes)
      .force('link', d3.forceLink(graphData.links).id(d => d.id).distance(d => {
        if (d.source.type === 'root' || d.target.type === 'root') return 140;
        if (d.source.type === 'suborder' || d.target.type === 'suborder') return 100;
        return 70;
      }))
      .force('charge', d3.forceManyBody().strength(d => {
        if (d.type === 'root') return -800;
        if (d.type === 'suborder') return -450;
        if (d.type === 'family') return -250;
        return -140;
      }))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius(d => getNodeRadius(d) + 18).iterations(2));

    // Renderizar Enlaces
    const links = gLinks.selectAll('line')
      .data(graphData.links)
      .join('line')
      .attr('class', 'graph-link')
      .attr('stroke', d => {
        const targetNode = typeof d.target === 'object' ? d.target : graphData.nodes.find(n => n.id === d.target);
        return getNodeColor(targetNode);
      });

    // Renderizar Nodos
    const nodes = gNodes.selectAll('.graph-node')
      .data(graphData.nodes)
      .join('g')
      .attr('class', 'graph-node')
      .attr('id', d => `node-${d.id}`)
      .call(drag(simulation));

    // Círculo base de cada nodo
    nodes.append('circle')
      .attr('class', 'node-circle')
      .attr('r', d => getNodeRadius(d))
      .attr('fill', d => {
        if (d.type === 'species' && d.image) return `url(#pat-${d.id})`;
        return getNodeColor(d);
      })
      .attr('stroke', d => getNodeColor(d));

    // Emoji o ícono para nodos de categoría (root, suborder, family) o especies sin imagen
    nodes.each(function (d) {
      if (d.type !== 'species' || (!d.image && d.emoji)) {
        d3.select(this).append('text')
          .attr('text-anchor', 'middle')
          .attr('dy', '0.35em')
          .attr('font-size', d.type === 'root' ? '22px' : d.type === 'suborder' ? '17px' : '13px')
          .attr('pointer-events', 'none')
          .text(d.emoji || '🐾');
      }
    });

    // Etiquetas de texto debajo de los nodos
    nodes.append('text')
      .attr('class', d => `node-label label-${d.type}`)
      .attr('dy', d => getNodeRadius(d) + 14)
      .text(d => d.label || d.common_name);

    // Eventos de mouse en los nodos
    nodes
      .on('mouseenter', (event, d) => highlightNodeBranch(d))
      .on('mouseleave', () => resetHighlights())
      .on('click', (event, d) => {
        event.stopPropagation();
        selectNode(d);
      });

    // Zoom y Pan
    zoomBehavior = d3.zoom()
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => {
        gMain.attr('transform', event.transform);
      });

    svg.call(zoomBehavior)
      .on('click', () => {
        // Clic en el fondo deselecciona
        closeDrawer();
        resetHighlights();
      });

    // Actualización en cada tick de la física
    simulation.on('tick', () => {
      links
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      nodes.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // Resize listener
    window.addEventListener('resize', () => {
      const w = viewport.clientWidth;
      const h = viewport.clientHeight;
      svg.attr('viewBox', [0, 0, w, h]);
      simulation.force('center', d3.forceCenter(w / 2, h / 2));
      simulation.alpha(0.3).restart();
    });
  }

  // --- Funciones de Interacción y Resaltado ---
  function highlightNodeBranch(node) {
    const connectedNodeIds = new Set([node.id]);

    // Recorrer enlaces para encontrar vecinos directos
    graphData.links.forEach(l => {
      const sId = typeof l.source === 'object' ? l.source.id : l.source;
      const tId = typeof l.target === 'object' ? l.target.id : l.target;
      if (sId === node.id) connectedNodeIds.add(tId);
      if (tId === node.id) connectedNodeIds.add(sId);
    });

    // Resaltar u opacar nodos
    gNodes.selectAll('.graph-node').classed('dimmed', d => !connectedNodeIds.has(d.id));
    
    // Resaltar u opacar enlaces
    gLinks.selectAll('.graph-link')
      .classed('highlighted', l => {
        const sId = typeof l.source === 'object' ? l.source.id : l.source;
        const tId = typeof l.target === 'object' ? l.target.id : l.target;
        return sId === node.id || tId === node.id;
      })
      .classed('dimmed', l => {
        const sId = typeof l.source === 'object' ? l.source.id : l.source;
        const tId = typeof l.target === 'object' ? l.target.id : l.target;
        return sId !== node.id && tId !== node.id;
      });
  }

  function resetHighlights() {
    if (activeNode) {
      highlightNodeBranch(activeNode);
      return;
    }
    gNodes.selectAll('.graph-node').classed('dimmed', false);
    gLinks.selectAll('.graph-link').classed('highlighted', false).classed('dimmed', false);
  }

  function selectNode(node) {
    activeNode = node;
    gNodes.selectAll('.graph-node').classed('active', d => d.id === node.id);
    highlightNodeBranch(node);
    openDrawer(node);
  }

  function focusOnNode(node) {
    if (!node || node.x === undefined || node.y === undefined) return;
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    const scale = node.type === 'species' ? 1.8 : 1.3;
    
    // Desplazar un poco a la izquierda para dejar espacio al drawer si está abierto
    const offsetX = detailDrawer.classList.contains('open') ? width * 0.35 : width * 0.5;

    svg.transition()
      .duration(750)
      .call(
        zoomBehavior.transform,
        d3.zoomIdentity
          .translate(offsetX, height / 2)
          .scale(scale)
          .translate(-node.x, -node.y)
      );
  }

  // --- Drawer / Panel de Información ---
  function openDrawer(node) {
    drawerTitle.textContent = node.label || node.common_name || node.id;
    drawerScientific.textContent = node.scientific_name ? `(${node.scientific_name})` : '';
    drawerRank.textContent = getRankName(node.type);
    
    // Encontrar padre
    const parentNode = graphData.nodes.find(n => n.id === node.parent);
    drawerParent.textContent = parentNode ? (parentNode.label || parentNode.common_name) : 'Raíz';

    drawerDescription.textContent = node.description || 'No hay descripción disponible para esta especie.';

    if (node.original_image || node.image) {
      drawerImage.src = node.original_image || node.image;
      drawerImage.alt = node.label || node.scientific_name;
      drawerImage.style.display = 'block';
    } else {
      drawerImage.style.display = 'none';
    }

    drawerBadge.textContent = node.type.toUpperCase();
    drawerBadge.style.color = getNodeColor(node);

    if (node.wiki_url) {
      drawerWikiLink.href = node.wiki_url;
      drawerWikiLink.style.display = 'flex';
    } else {
      drawerWikiLink.style.display = 'none';
    }

    drawerFocusBtn.onclick = () => focusOnNode(node);

    detailDrawer.classList.add('open');
    detailDrawer.setAttribute('aria-hidden', 'false');
  }

  function closeDrawer() {
    detailDrawer.classList.remove('open');
    detailDrawer.setAttribute('aria-hidden', 'true');
    activeNode = null;
    gNodes.selectAll('.graph-node').classed('active', false);
    resetHighlights();
  }

  // --- Filtros y Buscador ---
  function setupEventListeners() {
    // Cerrar drawer
    btnCloseDrawer.addEventListener('click', closeDrawer);

    // Botón centrar vista
    btnResetZoom.addEventListener('click', () => {
      svg.transition().duration(600).call(
        zoomBehavior.transform,
        d3.zoomIdentity
      );
    });

    // Botón pausar/reanudar física
    btnTogglePhysics.addEventListener('click', () => {
      if (physicsRunning) {
        simulation.stop();
        btnTogglePhysics.innerHTML = '▶️ Física';
        physicsRunning = false;
      } else {
        simulation.alpha(0.3).restart();
        btnTogglePhysics.innerHTML = '⏸️ Física';
        physicsRunning = true;
      }
    });

    // Buscador en tiempo real
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.trim().toLowerCase();
      clearSearchBtn.style.display = query ? 'block' : 'none';

      if (!query) {
        resetHighlights();
        return;
      }

      const matches = graphData.nodes.filter(n => {
        const title = (n.label || '').toLowerCase();
        const sci = (n.scientific_name || '').toLowerCase();
        const desc = (n.description || '').toLowerCase();
        return title.includes(query) || sci.includes(query) || desc.includes(query);
      });

      if (matches.length > 0) {
        const matchIds = new Set(matches.map(m => m.id));
        gNodes.selectAll('.graph-node').classed('dimmed', d => !matchIds.has(d.id));
        gLinks.selectAll('.graph-link').classed('dimmed', true);

        // Si hay una coincidencia exacta o la primera
        const topMatch = matches[0];
        focusOnNode(topMatch);
        selectNode(topMatch);
      } else {
        gNodes.selectAll('.graph-node').classed('dimmed', true);
      }
    });

    clearSearchBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearSearchBtn.style.display = 'none';
      resetHighlights();
      closeDrawer();
    });

    // Filtro por suborden / rama
    groupFilter.addEventListener('change', (e) => {
      const selected = e.target.value;
      if (selected === 'all') {
        gNodes.selectAll('.graph-node').classed('dimmed', false);
        gLinks.selectAll('.graph-link').classed('dimmed', false);
        return;
      }

      // Encontrar todos los descendientes del grupo seleccionado
      const visibleIds = new Set(['carnivora', selected]);
      
      // Familias que pertenecen a este suborden
      graphData.nodes.forEach(n => {
        if (n.parent === selected) {
          visibleIds.add(n.id);
          // Especies que pertenecen a estas familias
          graphData.nodes.forEach(sp => {
            if (sp.parent === n.id) visibleIds.add(sp.id);
          });
        }
      });

      gNodes.selectAll('.graph-node').classed('dimmed', d => !visibleIds.has(d.id));
      gLinks.selectAll('.graph-link').classed('dimmed', l => {
        const sId = typeof l.source === 'object' ? l.source.id : l.source;
        const tId = typeof l.target === 'object' ? l.target.id : l.target;
        return !visibleIds.has(sId) || !visibleIds.has(tId);
      });

      // Enfocar en el nodo del suborden
      const targetSub = graphData.nodes.find(n => n.id === selected);
      if (targetSub) {
        focusOnNode(targetSub);
      }
    });
  }

  // --- Arrastre de Nodos (D3 Drag) ---
  function drag(simulation) {
    function dragstarted(event) {
      if (!event.active && physicsRunning) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event) {
      if (!event.active && physicsRunning) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended);
  }

  // Iniciar al cargar el DOM
  document.addEventListener('DOMContentLoaded', init);
})();

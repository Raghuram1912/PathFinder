/* ============================================================
   graph.js — Graph Data Model, SVG Renderer & Editor
   ============================================================
   Exports (global):
     class Graph       — adjacency-list graph with CRUD operations
     class GraphRenderer — SVG rendering of Graph
     class GraphEditor — mouse / tool interaction layer
   ============================================================ */

/* ============================================================
   1. GRAPH DATA MODEL
   ============================================================ */
class Graph {
  constructor() {
    /** @type {Map<string, {id:string, label:string, x:number, y:number}>} */
    this.nodes = new Map();
    /** @type {Map<string, {id:string, from:string, to:string, weight:number}>} */
    this.edges = new Map();
    /** Whether edges have direction */
    this.directed = false;
    /** Counter for generating unique node IDs */
    this._nodeCounter = 0;
    /** Counter for generating unique edge IDs */
    this._edgeCounter = 0;
  }

  /* ---------- helpers ---------- */

  /** Generate next label: A, B, ... Z, AA, AB, ... */
  _nextLabel() {
    let n = this._nodeCounter++;
    let label = '';
    do {
      label = String.fromCharCode(65 + (n % 26)) + label;
      n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    return label;
  }

  /** Generate a unique edge ID */
  _nextEdgeId() {
    return 'e' + (this._edgeCounter++);
  }

  /* ---------- node CRUD ---------- */

  /**
   * Add a node at position (x, y).
   * @param {number} x  SVG x coordinate
   * @param {number} y  SVG y coordinate
   * @param {string} [label]  Optional label override
   * @returns {{id:string, label:string, x:number, y:number}}
   */
  addNode(x, y, label) {
    const id = label || this._nextLabel();
    // Prevent duplicates when importing
    if (this.nodes.has(id)) return this.nodes.get(id);
    const node = { id, label: id, x, y };
    this.nodes.set(id, node);
    return node;
  }

  /** Remove a node and all its connected edges */
  removeNode(id) {
    if (!this.nodes.has(id)) return [];
    // Collect edges to remove
    const removedEdges = [];
    for (const [eid, edge] of this.edges) {
      if (edge.from === id || edge.to === id) {
        removedEdges.push({ ...edge });
        this.edges.delete(eid);
      }
    }
    const node = { ...this.nodes.get(id) };
    this.nodes.delete(id);
    return { node, removedEdges };
  }

  /** Move a node to new position */
  moveNode(id, x, y) {
    const node = this.nodes.get(id);
    if (node) { node.x = x; node.y = y; }
  }

  /** Look up node by label */
  getNodeByLabel(label) {
    return this.nodes.get(label) || null;
  }

  /* ---------- edge CRUD ---------- */

  /**
   * Add an edge between two nodes.
   * @returns {object|null} The created edge, or null if invalid.
   */
  addEdge(fromId, toId, weight, edgeId) {
    if (!this.nodes.has(fromId) || !this.nodes.has(toId)) return null;
    if (fromId === toId) return null; // no self-loops

    // Check for duplicate edge
    for (const [, e] of this.edges) {
      if (e.from === fromId && e.to === toId) return null;
      if (!this.directed && e.from === toId && e.to === fromId) return null;
    }

    const id = edgeId || this._nextEdgeId();
    const edge = { id, from: fromId, to: toId, weight: Number(weight) };
    this.edges.set(id, edge);
    return edge;
  }

  /** Remove an edge by ID */
  removeEdge(id) {
    const edge = this.edges.get(id);
    if (edge) {
      this.edges.delete(id);
      return { ...edge };
    }
    return null;
  }

  /** Update edge weight */
  setEdgeWeight(id, weight) {
    const edge = this.edges.get(id);
    if (edge) edge.weight = Number(weight);
  }

  /** Find edge between two nodes */
  getEdgeBetween(fromId, toId) {
    for (const [, e] of this.edges) {
      if (e.from === fromId && e.to === toId) return e;
      if (!this.directed && e.from === toId && e.to === fromId) return e;
    }
    return null;
  }

  /* ---------- graph queries ---------- */

  /**
   * Get neighbors of a node (respecting directed/undirected).
   * Returns array of { nodeId, edgeId, weight }.
   */
  getNeighbors(nodeId) {
    const neighbors = [];
    for (const [, e] of this.edges) {
      if (e.from === nodeId) {
        neighbors.push({ nodeId: e.to, edgeId: e.id, weight: e.weight });
      }
      if (!this.directed && e.to === nodeId) {
        neighbors.push({ nodeId: e.from, edgeId: e.id, weight: e.weight });
      }
    }
    return neighbors;
  }

  /** Check if graph has any negative-weight edges */
  hasNegativeWeights() {
    for (const [, e] of this.edges) {
      if (e.weight < 0) return true;
    }
    return false;
  }

  /** Get all node IDs */
  getNodeIds() {
    return Array.from(this.nodes.keys());
  }

  /** Get node count */
  get nodeCount() { return this.nodes.size; }

  /** Get edge count */
  get edgeCount() { return this.edges.size; }

  /* ---------- toggle directed ---------- */

  toggleDirected() {
    this.directed = !this.directed;
    // When switching to undirected, remove duplicate reverse edges
    if (!this.directed) {
      const seen = new Set();
      const toRemove = [];
      for (const [eid, e] of this.edges) {
        const key = [e.from, e.to].sort().join('-');
        if (seen.has(key)) {
          toRemove.push(eid);
        } else {
          seen.add(key);
        }
      }
      toRemove.forEach(id => this.edges.delete(id));
    }
    return this.directed;
  }

  /* ---------- serialization ---------- */

  /** Export graph to a plain JSON-serializable object */
  toJSON() {
    return {
      directed: this.directed,
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
    };
  }

  /** Import graph from a JSON object */
  static fromJSON(json) {
    const g = new Graph();
    g.directed = !!json.directed;
    // Determine the highest label index so _nodeCounter doesn't collide
    let maxIdx = -1;
    for (const n of json.nodes) {
      g.nodes.set(n.id || n.label, {
        id: n.id || n.label,
        label: n.label || n.id,
        x: n.x,
        y: n.y,
      });
      // Parse label index
      const idx = Graph._labelToIndex(n.label || n.id);
      if (idx > maxIdx) maxIdx = idx;
    }
    g._nodeCounter = maxIdx + 1;

    let maxEdge = -1;
    for (const e of json.edges) {
      const eid = e.id || g._nextEdgeId();
      g.edges.set(eid, { id: eid, from: e.from, to: e.to, weight: Number(e.weight) });
      const num = parseInt((eid || '').replace('e', ''), 10);
      if (!isNaN(num) && num > maxEdge) maxEdge = num;
    }
    g._edgeCounter = maxEdge + 1;
    return g;
  }

  /** Helper: convert label like "A"→0, "Z"→25, "AA"→26 */
  static _labelToIndex(label) {
    let idx = 0;
    for (let i = 0; i < label.length; i++) {
      idx = idx * 26 + (label.charCodeAt(i) - 64);
    }
    return idx - 1;
  }

  /* ---------- clear ---------- */

  clear() {
    this.nodes.clear();
    this.edges.clear();
    this._nodeCounter = 0;
    this._edgeCounter = 0;
  }

  /* ---------- random graph generator ---------- */

  /**
   * Generate a random graph with the given node/edge count.
   * Uses a grid-jitter layout to avoid overlaps.
   * @param {number} nodeCount
   * @param {number} edgeCount
   * @param {number} width   Canvas width
   * @param {number} height  Canvas height
   * @returns {Graph}
   */
  static generateRandom(nodeCount, edgeCount, width, height) {
    const g = new Graph();
    const padding = 50;
    const usableW = width - 2 * padding;
    const usableH = height - 2 * padding;

    // Place nodes in a circle with jitter for natural look
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(usableW, usableH) * 0.4;

    for (let i = 0; i < nodeCount; i++) {
      const angle = (2 * Math.PI * i) / nodeCount - Math.PI / 2;
      const jitterR = (Math.random() - 0.5) * radius * 0.2;
      const jitterA = (Math.random() - 0.5) * 0.3;
      const x = cx + (radius + jitterR) * Math.cos(angle + jitterA);
      const y = cy + (radius + jitterR) * Math.sin(angle + jitterA);
      g.addNode(
        Math.max(padding, Math.min(width - padding, x)),
        Math.max(padding, Math.min(height - padding, y))
      );
    }

    const nodeIds = g.getNodeIds();

    // Ensure connected: create a spanning path first
    const shuffled = [...nodeIds].sort(() => Math.random() - 0.5);
    for (let i = 0; i < shuffled.length - 1; i++) {
      const w = Math.floor(Math.random() * 10) + 1;
      g.addEdge(shuffled[i], shuffled[i + 1], w);
    }

    // Add remaining random edges
    let attempts = 0;
    while (g.edgeCount < edgeCount && attempts < edgeCount * 10) {
      const a = nodeIds[Math.floor(Math.random() * nodeIds.length)];
      const b = nodeIds[Math.floor(Math.random() * nodeIds.length)];
      if (a !== b) {
        const w = Math.floor(Math.random() * 15) + 1;
        g.addEdge(a, b, w);
      }
      attempts++;
    }

    return g;
  }

  /* ---------- sample graphs ---------- */

  static getSampleGraphs() {
    return {
      small: {
        name: 'Small (5 nodes)',
        data: {
          directed: false,
          nodes: [
            { id: 'A', label: 'A', x: 150, y: 100 },
            { id: 'B', label: 'B', x: 350, y: 80 },
            { id: 'C', label: 'C', x: 150, y: 300 },
            { id: 'D', label: 'D', x: 350, y: 300 },
            { id: 'E', label: 'E', x: 500, y: 200 },
          ],
          edges: [
            { id: 'e0', from: 'A', to: 'B', weight: 4 },
            { id: 'e1', from: 'A', to: 'C', weight: 2 },
            { id: 'e2', from: 'C', to: 'B', weight: 1 },
            { id: 'e3', from: 'B', to: 'D', weight: 5 },
            { id: 'e4', from: 'C', to: 'D', weight: 8 },
            { id: 'e5', from: 'D', to: 'E', weight: 3 },
          ],
        },
      },
      medium: {
        name: 'Medium (8 nodes)',
        data: {
          directed: false,
          nodes: [
            { id: 'A', label: 'A', x: 100, y: 150 },
            { id: 'B', label: 'B', x: 250, y: 60 },
            { id: 'C', label: 'C', x: 250, y: 250 },
            { id: 'D', label: 'D', x: 400, y: 100 },
            { id: 'E', label: 'E', x: 400, y: 280 },
            { id: 'F', label: 'F', x: 550, y: 60 },
            { id: 'G', label: 'G', x: 550, y: 200 },
            { id: 'H', label: 'H', x: 650, y: 300 },
          ],
          edges: [
            { id: 'e0', from: 'A', to: 'B', weight: 3 },
            { id: 'e1', from: 'A', to: 'C', weight: 6 },
            { id: 'e2', from: 'B', to: 'D', weight: 2 },
            { id: 'e3', from: 'B', to: 'C', weight: 4 },
            { id: 'e4', from: 'C', to: 'E', weight: 1 },
            { id: 'e5', from: 'D', to: 'F', weight: 7 },
            { id: 'e6', from: 'D', to: 'G', weight: 3 },
            { id: 'e7', from: 'E', to: 'G', weight: 5 },
            { id: 'e8', from: 'E', to: 'H', weight: 8 },
            { id: 'e9', from: 'F', to: 'G', weight: 1 },
            { id: 'e10', from: 'G', to: 'H', weight: 2 },
          ],
        },
      },
      negative: {
        name: 'Negative Edge (6 nodes)',
        data: {
          directed: true,
          nodes: [
            { id: 'A', label: 'A', x: 100, y: 180 },
            { id: 'B', label: 'B', x: 280, y: 80 },
            { id: 'C', label: 'C', x: 280, y: 280 },
            { id: 'D', label: 'D', x: 460, y: 80 },
            { id: 'E', label: 'E', x: 460, y: 280 },
            { id: 'F', label: 'F', x: 600, y: 180 },
          ],
          edges: [
            { id: 'e0', from: 'A', to: 'B', weight: 4 },
            { id: 'e1', from: 'A', to: 'C', weight: 2 },
            { id: 'e2', from: 'B', to: 'D', weight: 3 },
            { id: 'e3', from: 'C', to: 'B', weight: -1 },
            { id: 'e4', from: 'C', to: 'E', weight: 5 },
            { id: 'e5', from: 'D', to: 'F', weight: 2 },
            { id: 'e6', from: 'E', to: 'D', weight: -3 },
            { id: 'e7', from: 'E', to: 'F', weight: 6 },
          ],
        },
      },
    };
  }

  /* ---------- parse edge list ---------- */

  /**
   * Parse an edge-list string.  One edge per line: "A B 5"
   * Returns { graph, errors }
   */
  static parseEdgeList(text, width, height) {
    const lines = text.trim().split('\n').filter(l => l.trim());
    const errors = [];
    const nodeLabels = new Set();
    const edgeDefs = [];

    lines.forEach((line, idx) => {
      const parts = line.trim().split(/\s+/);
      if (parts.length !== 3) {
        errors.push({ line: idx + 1, text: line, msg: 'Expected format: A B weight' });
        return;
      }
      const [from, to, wStr] = parts;
      const w = Number(wStr);
      if (isNaN(w)) {
        errors.push({ line: idx + 1, text: line, msg: `Invalid weight "${wStr}"` });
        return;
      }
      if (from === to) {
        errors.push({ line: idx + 1, text: line, msg: 'Self-loops not allowed' });
        return;
      }
      nodeLabels.add(from);
      nodeLabels.add(to);
      edgeDefs.push({ from, to, weight: w });
    });

    if (errors.length > 0) return { graph: null, errors };

    // Build graph with circular layout
    const g = new Graph();
    const labels = Array.from(nodeLabels).sort();
    const cx = width / 2, cy = height / 2;
    const r = Math.min(width, height) * 0.35;

    labels.forEach((label, i) => {
      const angle = (2 * Math.PI * i) / labels.length - Math.PI / 2;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      g.addNode(x, y, label);
    });

    // Reset _nodeCounter to account for imported labels
    const maxIdx = Math.max(...labels.map(l => Graph._labelToIndex(l)));
    g._nodeCounter = maxIdx + 1;

    edgeDefs.forEach(e => {
      const result = g.addEdge(e.from, e.to, e.weight);
      if (!result) {
        // Duplicate or invalid — silently skip
      }
    });

    return { graph: g, errors: [] };
  }
}


/* ============================================================
   2. SVG GRAPH RENDERER
   ============================================================
   Renders Graph data into an SVG element.
   Each node gets a <g class="node-group"> with circle + label.
   Each edge gets a <g> with line + weight pill.
   ============================================================ */
class GraphRenderer {
  /**
   * @param {SVGSVGElement} svg
   * @param {Graph} graph
   */
  constructor(svg, graph) {
    this.svg = svg;
    this.graph = graph;

    // Create layer groups so edges render beneath nodes
    this.edgeLayer = this._createGroup('edge-layer');
    this.nodeLayer = this._createGroup('node-layer');
    this.tempLayer = this._createGroup('temp-layer');

    // Arrowhead markers for directed edges
    this._createArrowMarkers();
  }

  /** Helper: create an SVG <g> and append to the root svg */
  _createGroup(className) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', className);
    this.svg.appendChild(g);
    return g;
  }

  /** Create SVG <marker> definitions for arrowheads */
  _createArrowMarkers() {
    let defs = this.svg.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      this.svg.prepend(defs);
    }

    const states = [
      { id: 'arrowhead',          cls: 'arrow-marker',          color: 'var(--edge-default)' },
      { id: 'arrowhead-relaxing', cls: 'arrow-marker-relaxing', color: 'var(--edge-relaxing)' },
      { id: 'arrowhead-path',     cls: 'arrow-marker-path',     color: 'var(--edge-path)' },
    ];

    states.forEach(({ id, cls, color }) => {
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      marker.setAttribute('id', id);
      marker.setAttribute('viewBox', '0 0 10 7');
      marker.setAttribute('refX', '10');
      marker.setAttribute('refY', '3.5');
      marker.setAttribute('markerWidth', '8');
      marker.setAttribute('markerHeight', '6');
      marker.setAttribute('orient', 'auto-start-reverse');
      marker.setAttribute('class', cls);
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M 0 0 L 10 3.5 L 0 7 z');
      path.setAttribute('fill', color);
      marker.appendChild(path);
      defs.appendChild(marker);
    });
  }

  /* ---------- full render ---------- */

  /** Re-render the entire graph from scratch */
  render() {
    this.edgeLayer.innerHTML = '';
    this.nodeLayer.innerHTML = '';
    this.tempLayer.innerHTML = '';

    // Render edges first (below nodes)
    for (const [, edge] of this.graph.edges) {
      this._renderEdge(edge);
    }

    // Render nodes on top
    for (const [, node] of this.graph.nodes) {
      this._renderNode(node);
    }
  }

  /* ---------- render individual elements ---------- */

  _renderNode(node) {
    const NS = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'node-group');
    g.setAttribute('data-node-id', node.id);
    g.setAttribute('transform', `translate(${node.x}, ${node.y})`);

    // Circle
    const circle = document.createElementNS(NS, 'circle');
    circle.setAttribute('class', 'node-circle');
    circle.setAttribute('r', '22');
    circle.setAttribute('cx', '0');
    circle.setAttribute('cy', '0');
    g.appendChild(circle);

    // Label
    const label = document.createElementNS(NS, 'text');
    label.setAttribute('class', 'node-label');
    label.setAttribute('x', '0');
    label.setAttribute('y', '1');
    label.textContent = node.label;
    g.appendChild(label);

    this.nodeLayer.appendChild(g);
  }

  _renderEdge(edge) {
    const NS = 'http://www.w3.org/2000/svg';
    const fromNode = this.graph.nodes.get(edge.from);
    const toNode = this.graph.nodes.get(edge.to);
    if (!fromNode || !toNode) return;

    const g = document.createElementNS(NS, 'g');
    g.setAttribute('data-edge-id', edge.id);

    // Calculate endpoint positions adjusted for node radius
    const { x1, y1, x2, y2 } = this._edgeEndpoints(fromNode, toNode);

    // Hit area (wider invisible line for easy clicking)
    const hitArea = document.createElementNS(NS, 'line');
    hitArea.setAttribute('class', 'edge-line-hitarea');
    hitArea.setAttribute('x1', x1); hitArea.setAttribute('y1', y1);
    hitArea.setAttribute('x2', x2); hitArea.setAttribute('y2', y2);
    g.appendChild(hitArea);

    // Visible line
    const line = document.createElementNS(NS, 'line');
    line.setAttribute('class', 'edge-line');
    line.setAttribute('x1', x1); line.setAttribute('y1', y1);
    line.setAttribute('x2', x2); line.setAttribute('y2', y2);

    // Add arrowhead for directed graphs
    if (this.graph.directed) {
      line.setAttribute('marker-end', 'url(#arrowhead)');
    }

    g.appendChild(line);

    // Weight pill at midpoint
    const mx = (fromNode.x + toNode.x) / 2;
    const my = (fromNode.y + toNode.y) / 2;

    const wg = document.createElementNS(NS, 'g');
    wg.setAttribute('class', 'edge-weight-group');
    wg.setAttribute('data-edge-id', edge.id);

    const pillW = Math.max(28, String(edge.weight).length * 10 + 12);
    const pill = document.createElementNS(NS, 'rect');
    pill.setAttribute('class', 'edge-weight-pill');
    pill.setAttribute('x', mx - pillW / 2);
    pill.setAttribute('y', my - 11);
    pill.setAttribute('width', pillW);
    pill.setAttribute('height', 22);
    wg.appendChild(pill);

    const wt = document.createElementNS(NS, 'text');
    wt.setAttribute('class', 'edge-weight-text' + (edge.weight < 0 ? ' negative' : ''));
    wt.setAttribute('x', mx);
    wt.setAttribute('y', my);
    wt.textContent = edge.weight;
    wg.appendChild(wt);

    g.appendChild(wg);

    this.edgeLayer.appendChild(g);
  }

  /** Compute edge line endpoints pulled inward to stop at node radius */
  _edgeEndpoints(fromNode, toNode) {
    const dx = toNode.x - fromNode.x;
    const dy = toNode.y - fromNode.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const nodeRadius = 22;
    // Pull in more for directed edges to leave room for arrowhead
    const pullIn = this.graph.directed ? nodeRadius + 6 : nodeRadius;

    return {
      x1: fromNode.x + (dx / dist) * nodeRadius,
      y1: fromNode.y + (dy / dist) * nodeRadius,
      x2: toNode.x - (dx / dist) * pullIn,
      y2: toNode.y - (dy / dist) * pullIn,
    };
  }

  /* ---------- update positions (for move tool) ---------- */

  /** Update a single node's position in the SVG */
  updateNodePosition(nodeId) {
    const node = this.graph.nodes.get(nodeId);
    if (!node) return;
    const g = this.nodeLayer.querySelector(`[data-node-id="${nodeId}"]`);
    if (g) g.setAttribute('transform', `translate(${node.x}, ${node.y})`);

    // Update all connected edges
    for (const [, edge] of this.graph.edges) {
      if (edge.from === nodeId || edge.to === nodeId) {
        this._updateEdgePosition(edge);
      }
    }
  }

  _updateEdgePosition(edge) {
    const fromNode = this.graph.nodes.get(edge.from);
    const toNode = this.graph.nodes.get(edge.to);
    if (!fromNode || !toNode) return;

    const g = this.edgeLayer.querySelector(`[data-edge-id="${edge.id}"]`);
    if (!g) return;

    const { x1, y1, x2, y2 } = this._edgeEndpoints(fromNode, toNode);

    const lines = g.querySelectorAll('line');
    lines.forEach(l => {
      l.setAttribute('x1', x1); l.setAttribute('y1', y1);
      l.setAttribute('x2', x2); l.setAttribute('y2', y2);
    });

    // Update weight pill position
    const mx = (fromNode.x + toNode.x) / 2;
    const my = (fromNode.y + toNode.y) / 2;
    const pill = g.querySelector('.edge-weight-pill');
    const text = g.querySelector('.edge-weight-text');
    if (pill) {
      const w = parseFloat(pill.getAttribute('width'));
      pill.setAttribute('x', mx - w / 2);
      pill.setAttribute('y', my - 11);
    }
    if (text) {
      text.setAttribute('x', mx);
      text.setAttribute('y', my);
    }
  }

  /* ---------- state management for visualization ---------- */

  /**
   * Set visual state of a node.
   * @param {string} nodeId
   * @param {'default'|'current'|'visited'|'source'|'dest'|'path'|'selected'} state
   */
  setNodeState(nodeId, state) {
    const g = this.nodeLayer.querySelector(`[data-node-id="${nodeId}"]`);
    if (!g) return;
    const circle = g.querySelector('.node-circle');
    if (!circle) return;

    // Remove all state classes
    circle.className.baseVal = 'node-circle';
    if (state !== 'default') {
      circle.classList.add(`state-${state}`);
    }
  }

  /**
   * Set visual state of an edge.
   * @param {string} edgeId
   * @param {'default'|'relaxing'|'path'|'selected'} state
   */
  setEdgeState(edgeId, state) {
    const g = this.edgeLayer.querySelector(`[data-edge-id="${edgeId}"]`);
    if (!g) return;
    const line = g.querySelector('.edge-line');
    if (!line) return;

    line.className.baseVal = 'edge-line';
    if (state !== 'default') {
      line.classList.add(`state-${state}`);
    }

    // Update arrowhead marker for directed graphs
    if (this.graph.directed) {
      if (state === 'relaxing') {
        line.setAttribute('marker-end', 'url(#arrowhead-relaxing)');
      } else if (state === 'path') {
        line.setAttribute('marker-end', 'url(#arrowhead-path)');
      } else {
        line.setAttribute('marker-end', 'url(#arrowhead)');
      }
    }
  }

  /** Clear all visual states back to default */
  clearAllStates() {
    this.nodeLayer.querySelectorAll('.node-circle').forEach(c => {
      c.className.baseVal = 'node-circle';
    });
    this.edgeLayer.querySelectorAll('.edge-line').forEach(l => {
      l.className.baseVal = 'edge-line';
      if (this.graph.directed) {
        l.setAttribute('marker-end', 'url(#arrowhead)');
      }
    });
  }

  /** Apply source/dest badges */
  setBadges(sourceId, destId) {
    const NS = 'http://www.w3.org/2000/svg';
    // Remove old badges
    this.nodeLayer.querySelectorAll('.node-badge, .node-badge-circle').forEach(el => el.remove());

    const addBadge = (nodeId, type) => {
      if (!nodeId) return;
      const g = this.nodeLayer.querySelector(`[data-node-id="${nodeId}"]`);
      if (!g) return;

      const bc = document.createElementNS(NS, 'circle');
      bc.setAttribute('class', `node-badge-circle badge-${type}`);
      bc.setAttribute('cx', '15');
      bc.setAttribute('cy', '-15');
      bc.setAttribute('r', '9');
      g.appendChild(bc);

      const bt = document.createElementNS(NS, 'text');
      bt.setAttribute('class', `node-badge badge-${type}`);
      bt.setAttribute('x', '15');
      bt.setAttribute('y', '-14');
      bt.textContent = type === 'source' ? 'S' : 'D';
      g.appendChild(bt);
    };

    addBadge(sourceId, 'source');
    addBadge(destId, 'dest');
  }

  /* ---------- temporary edge line (while drawing) ---------- */

  showTempEdge(x1, y1, x2, y2) {
    this.tempLayer.innerHTML = '';
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('class', 'temp-edge');
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
    this.tempLayer.appendChild(line);
  }

  hideTempEdge() {
    this.tempLayer.innerHTML = '';
  }

  /* ---------- hit testing ---------- */

  /** Get node ID at SVG point, or null */
  getNodeAtPoint(x, y) {
    for (const [, node] of this.graph.nodes) {
      const dx = node.x - x;
      const dy = node.y - y;
      if (dx * dx + dy * dy <= 26 * 26) return node.id;
    }
    return null;
  }

  /** Get edge ID at SVG point (approximate), or null */
  getEdgeAtPoint(x, y) {
    const threshold = 10;
    for (const [, edge] of this.graph.edges) {
      const from = this.graph.nodes.get(edge.from);
      const to = this.graph.nodes.get(edge.to);
      if (!from || !to) continue;

      // Point-to-line-segment distance
      const dist = this._pointToSegDist(x, y, from.x, from.y, to.x, to.y);
      if (dist < threshold) return edge.id;
    }
    return null;
  }

  /** Distance from point (px, py) to line segment (ax,ay)-(bx,by) */
  _pointToSegDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - ax, py - ay);
    let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  /** Get SVG coordinates from a mouse/touch event */
  getSVGPoint(event) {
    const rect = this.svg.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  /** Update weight display for an edge */
  updateEdgeWeight(edgeId) {
    const edge = this.graph.edges.get(edgeId);
    if (!edge) return;
    const g = this.edgeLayer.querySelector(`[data-edge-id="${edgeId}"]`);
    if (!g) return;
    const wt = g.querySelector('.edge-weight-text');
    if (wt) {
      wt.textContent = edge.weight;
      wt.className.baseVal = 'edge-weight-text' + (edge.weight < 0 ? ' negative' : '');
    }
    // Update pill width
    const pill = g.querySelector('.edge-weight-pill');
    if (pill) {
      const pillW = Math.max(28, String(edge.weight).length * 10 + 12);
      const mx = parseFloat(pill.getAttribute('x')) + parseFloat(pill.getAttribute('width')) / 2;
      pill.setAttribute('width', pillW);
      pill.setAttribute('x', mx - pillW / 2);
    }
  }
}


/* ============================================================
   3. GRAPH EDITOR — Mouse interaction & tool management
   ============================================================ */
class GraphEditor {
  /**
   * @param {SVGSVGElement} svg
   * @param {Graph} graph
   * @param {GraphRenderer} renderer
   */
  constructor(svg, graph, renderer) {
    this.svg = svg;
    this.graph = graph;
    this.renderer = renderer;

    /** Current tool: 'addNode'|'addEdge'|'move'|'delete'|'selectSource'|'selectDest' */
    this.tool = 'addNode';

    /** Source / Destination node IDs */
    this.sourceNode = null;
    this.destNode = null;

    /** Undo stack — stores { type, data } actions */
    this.undoStack = [];

    /** Drag state for addEdge */
    this._edgeStart = null;
    this._isDragging = false;

    /** Drag state for move */
    this._moveNode = null;
    this._moveStart = null;

    /** Callbacks */
    this.onGraphChanged = null;   // called after any graph mutation
    this.onSourceChanged = null;
    this.onDestChanged = null;
    this.onRequestWeight = null;  // called to get edge weight from user

    // Bind events
    this._bindEvents();
  }

  /* ---------- tool selection ---------- */

  setTool(tool) {
    this.tool = tool;
    this.cancelEdgeDrawing();

    // Update SVG cursor class
    this.svg.className.baseVal = '';
    this.svg.classList.add(`tool-${tool}`);
  }

  /* ---------- event binding ---------- */

  _bindEvents() {
    this.svg.addEventListener('mousedown', e => this._onMouseDown(e));
    this.svg.addEventListener('mousemove', e => this._onMouseMove(e));
    this.svg.addEventListener('mouseup',   e => this._onMouseUp(e));

    // Touch support
    this.svg.addEventListener('touchstart', e => {
      e.preventDefault();
      const touch = e.touches[0];
      this._onMouseDown(touch);
    }, { passive: false });
    this.svg.addEventListener('touchmove', e => {
      e.preventDefault();
      const touch = e.touches[0];
      this._onMouseMove(touch);
    }, { passive: false });
    this.svg.addEventListener('touchend', e => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      this._onMouseUp(touch);
    }, { passive: false });
  }

  _onMouseDown(e) {
    const pt = this.renderer.getSVGPoint(e);
    const hitNode = this.renderer.getNodeAtPoint(pt.x, pt.y);

    switch (this.tool) {
      case 'addNode':
        if (!hitNode) {
          this._addNodeAt(pt.x, pt.y);
        }
        break;

      case 'addEdge':
        if (hitNode) {
          this._edgeStart = hitNode;
          this._isDragging = true;
        }
        break;

      case 'move':
        if (hitNode) {
          this._moveNode = hitNode;
          this._moveStart = { ...this.graph.nodes.get(hitNode) };
          this._isDragging = true;
        }
        break;

      case 'delete':
        if (hitNode) {
          this._deleteNode(hitNode);
        } else {
          const hitEdge = this.renderer.getEdgeAtPoint(pt.x, pt.y);
          if (hitEdge) this._deleteEdge(hitEdge);
        }
        break;

      case 'selectSource':
        if (hitNode) this._setSource(hitNode);
        break;

      case 'selectDest':
        if (hitNode) this._setDest(hitNode);
        break;
    }
  }

  _onMouseMove(e) {
    if (!this._isDragging) return;
    const pt = this.renderer.getSVGPoint(e);

    if (this.tool === 'addEdge' && this._edgeStart) {
      const from = this.graph.nodes.get(this._edgeStart);
      this.renderer.showTempEdge(from.x, from.y, pt.x, pt.y);
    }

    if (this.tool === 'move' && this._moveNode) {
      this.graph.moveNode(this._moveNode, pt.x, pt.y);
      this.renderer.updateNodePosition(this._moveNode);
    }
  }

  _onMouseUp(e) {
    const pt = this.renderer.getSVGPoint(e);

    if (this.tool === 'addEdge' && this._edgeStart && this._isDragging) {
      const hitNode = this.renderer.getNodeAtPoint(pt.x, pt.y);
      if (hitNode && hitNode !== this._edgeStart) {
        // Request weight from the UI, then create edge
        if (this.onRequestWeight) {
          this.onRequestWeight(this._edgeStart, hitNode);
        }
      }
      this.renderer.hideTempEdge();
      this._edgeStart = null;
    }

    if (this.tool === 'move' && this._moveNode && this._isDragging) {
      // Push undo for the move
      const node = this.graph.nodes.get(this._moveNode);
      if (node && this._moveStart) {
        this.undoStack.push({
          type: 'moveNode',
          data: {
            id: this._moveNode,
            fromX: this._moveStart.x,
            fromY: this._moveStart.y,
            toX: node.x,
            toY: node.y,
          },
        });
      }
      this._moveNode = null;
      this._moveStart = null;
    }

    this._isDragging = false;
  }

  /* ---------- actions ---------- */

  _addNodeAt(x, y) {
    const node = this.graph.addNode(x, y);
    this.undoStack.push({ type: 'addNode', data: { ...node } });
    this.renderer.render();
    this._refreshBadges();
    this._notifyGraphChanged();
  }

  createEdge(fromId, toId, weight) {
    const edge = this.graph.addEdge(fromId, toId, weight);
    if (edge) {
      this.undoStack.push({ type: 'addEdge', data: { ...edge } });
      this.renderer.render();
      this._refreshBadges();
      this._notifyGraphChanged();
      return edge;
    }
    return null;
  }

  _deleteNode(nodeId) {
    const result = this.graph.removeNode(nodeId);
    if (result) {
      this.undoStack.push({ type: 'removeNode', data: result });
      if (this.sourceNode === nodeId) { this.sourceNode = null; if (this.onSourceChanged) this.onSourceChanged(null); }
      if (this.destNode === nodeId) { this.destNode = null; if (this.onDestChanged) this.onDestChanged(null); }
      this.renderer.render();
      this._refreshBadges();
      this._notifyGraphChanged();
    }
  }

  _deleteEdge(edgeId) {
    const edge = this.graph.removeEdge(edgeId);
    if (edge) {
      this.undoStack.push({ type: 'removeEdge', data: edge });
      this.renderer.render();
      this._refreshBadges();
      this._notifyGraphChanged();
    }
  }

  _setSource(nodeId) {
    this.sourceNode = nodeId;
    this._refreshBadges();
    if (this.onSourceChanged) this.onSourceChanged(nodeId);
  }

  _setDest(nodeId) {
    this.destNode = nodeId;
    this._refreshBadges();
    if (this.onDestChanged) this.onDestChanged(nodeId);
  }

  setSource(nodeId) { this._setSource(nodeId); }
  setDest(nodeId) { this._setDest(nodeId); }

  _refreshBadges() {
    this.renderer.clearAllStates();
    if (this.sourceNode) this.renderer.setNodeState(this.sourceNode, 'source');
    if (this.destNode) this.renderer.setNodeState(this.destNode, 'dest');
    this.renderer.setBadges(this.sourceNode, this.destNode);
  }

  refreshBadges() { this._refreshBadges(); }

  cancelEdgeDrawing() {
    this._edgeStart = null;
    this._isDragging = false;
    this.renderer.hideTempEdge();
  }

  /* ---------- undo ---------- */

  undo() {
    if (this.undoStack.length === 0) return false;
    const action = this.undoStack.pop();

    switch (action.type) {
      case 'addNode':
        this.graph.removeNode(action.data.id);
        if (this.sourceNode === action.data.id) { this.sourceNode = null; if (this.onSourceChanged) this.onSourceChanged(null); }
        if (this.destNode === action.data.id) { this.destNode = null; if (this.onDestChanged) this.onDestChanged(null); }
        break;
      case 'addEdge':
        this.graph.removeEdge(action.data.id);
        break;
      case 'removeNode':
        // Re-add node and its edges
        this.graph.addNode(action.data.node.x, action.data.node.y, action.data.node.label);
        action.data.removedEdges.forEach(e => {
          this.graph.addEdge(e.from, e.to, e.weight, e.id);
        });
        break;
      case 'removeEdge':
        this.graph.addEdge(action.data.from, action.data.to, action.data.weight, action.data.id);
        break;
      case 'moveNode':
        this.graph.moveNode(action.data.id, action.data.fromX, action.data.fromY);
        break;
    }

    this.renderer.render();
    this._refreshBadges();
    this._notifyGraphChanged();
    return true;
  }

  /* ---------- clear ---------- */

  clearGraph() {
    this.graph.clear();
    this.sourceNode = null;
    this.destNode = null;
    this.undoStack = [];
    this.renderer.render();
    if (this.onSourceChanged) this.onSourceChanged(null);
    if (this.onDestChanged) this.onDestChanged(null);
    this._notifyGraphChanged();
  }

  /* ---------- load graph ---------- */

  loadGraph(newGraph) {
    // Replace the current graph with a new one
    this.graph.nodes = newGraph.nodes;
    this.graph.edges = newGraph.edges;
    this.graph.directed = newGraph.directed;
    this.graph._nodeCounter = newGraph._nodeCounter;
    this.graph._edgeCounter = newGraph._edgeCounter;
    this.sourceNode = null;
    this.destNode = null;
    this.undoStack = [];
    this.renderer.render();
    if (this.onSourceChanged) this.onSourceChanged(null);
    if (this.onDestChanged) this.onDestChanged(null);
    this._notifyGraphChanged();
  }

  _notifyGraphChanged() {
    if (this.onGraphChanged) this.onGraphChanged();
  }
}

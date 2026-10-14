/* ============================================================
   app.js — Application Controller
   ============================================================
   Wires up the UI: toolbar, panels, playback engine, theme
   toggle, keyboard shortcuts, toasts, modals, compare mode,
   edge-list input, import/export, and first-time overlay.
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  const app = new PathFinderApp();
  window._app = app; // Debug access
});


class PathFinderApp {
  constructor() {
    // ---- Core components ----
    this.graph = new Graph();
    this.svg = document.getElementById('graph-svg');
    this.renderer = new GraphRenderer(this.svg, this.graph);
    this.editor = new GraphEditor(this.svg, this.graph, this.renderer);

    // ---- State ----
    this.currentAlgorithm = 'dijkstra';
    this.algorithmResult = null;
    this.currentStep = -1;
    this.isPlaying = false;
    this.playTimer = null;
    this.speed = 1; // seconds per step

    // ---- Init ----
    this._initToolbar();
    this._initAlgorithmPanel();
    this._initPlaybackControls();
    this._initEdgeListInput();
    this._initSampleGraphs();
    this._initRandomGraph();
    this._initImportExport();
    this._initDirectedToggle();
    this._initThemeToggle();
    this._initKeyboardShortcuts();
    this._initCardCollapse();
    this._initCompareMode();
    this._initWeightInput();
    this._initOnboarding();
    this._initLegend();

    // ---- Editor callbacks ----
    this.editor.onGraphChanged = () => this._onGraphChanged();
    this.editor.onSourceChanged = (id) => this._onSourceChanged(id);
    this.editor.onDestChanged = (id) => this._onDestChanged(id);
    this.editor.onRequestWeight = (from, to) => this._showWeightInput(from, to);

    // ---- Initial render ----
    this._updateEmptyState();
    this._updateNodeDropdowns();
    this._updateComplexityCard();
    this._updatePseudocode();
  }


  /* ============================================================
     TOOLBAR
     ============================================================ */
  _initToolbar() {
    const tools = ['addNode', 'addEdge', 'move', 'delete', 'selectSource', 'selectDest'];
    tools.forEach(tool => {
      const btn = document.getElementById(`tool-${tool}`);
      if (!btn) return;
      btn.addEventListener('click', () => {
        this._setActiveTool(tool);
      });
    });

    // Undo button
    document.getElementById('btn-undo')?.addEventListener('click', () => {
      if (!this.editor.undo()) {
        this._toast('Nothing to undo', '', 'info');
      }
    });

    // Clear button
    document.getElementById('btn-clear')?.addEventListener('click', () => {
      this.editor.clearGraph();
      this._resetPlayback();
      this._toast('Canvas cleared', '', 'info');
    });

    // Set default tool
    this._setActiveTool('addNode');
  }

  _setActiveTool(tool) {
    // Update button active state
    document.querySelectorAll('.canvas-toolbar .btn[id^="tool-"]').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(`tool-${tool}`);
    if (btn) btn.classList.add('active');
    this.editor.setTool(tool);
  }


  /* ============================================================
     ALGORITHM PANEL
     ============================================================ */
  _initAlgorithmPanel() {
    const select = document.getElementById('algorithm-select');
    if (select) {
      select.addEventListener('change', () => {
        this.currentAlgorithm = select.value;
        this._resetPlayback();
        this._updateComplexityCard();
        this._updatePseudocode();
      });
    }

    // Source / Dest dropdowns
    document.getElementById('source-select')?.addEventListener('change', (e) => {
      this.editor.setSource(e.target.value || null);
      this.editor.refreshBadges();
    });

    document.getElementById('dest-select')?.addEventListener('change', (e) => {
      this.editor.setDest(e.target.value || null);
      this.editor.refreshBadges();
    });

    // Run button
    document.getElementById('btn-run')?.addEventListener('click', () => {
      this._runAlgorithm();
    });
  }

  _updateNodeDropdowns() {
    const sourceSelect = document.getElementById('source-select');
    const destSelect = document.getElementById('dest-select');
    if (!sourceSelect || !destSelect) return;

    const nodes = this.graph.getNodeIds().sort();

    [sourceSelect, destSelect].forEach(sel => {
      const currentVal = sel.value;
      sel.innerHTML = '<option value="">— Select —</option>';
      nodes.forEach(id => {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = id;
        sel.appendChild(opt);
      });
      // Restore selection if still valid
      if (nodes.includes(currentVal)) sel.value = currentVal;
    });

    // Sync dropdown with editor state
    if (this.editor.sourceNode) sourceSelect.value = this.editor.sourceNode;
    if (this.editor.destNode) destSelect.value = this.editor.destNode;
  }


  /* ============================================================
     RUN ALGORITHM
     ============================================================ */
  _runAlgorithm() {
    // Validate
    if (!this.editor.sourceNode) {
      this._toast('No source selected', 'Click a node or use the Source dropdown.', 'warning');
      return;
    }
    if (!this.editor.destNode) {
      this._toast('No destination selected', 'Click a node or use the Destination dropdown.', 'warning');
      return;
    }
    if (this.graph.nodeCount === 0) {
      this._toast('Graph is empty', 'Add some nodes and edges first.', 'warning');
      return;
    }

    this._resetPlayback();

    // Check negative weights with Dijkstra
    if (this.currentAlgorithm === 'dijkstra' && this.graph.hasNegativeWeights()) {
      this._toast('Negative weights detected',
        'Dijkstra\'s algorithm may give incorrect results with negative edge weights. Consider using Bellman-Ford.',
        'warning');
    }

    // Run selected algorithm
    const algFns = { dijkstra, bellmanFord, bfs, aStar };
    const fn = algFns[this.currentAlgorithm];
    if (!fn) return;

    this.algorithmResult = fn(this.graph, this.editor.sourceNode, this.editor.destNode);

    // Handle warnings
    if (this.algorithmResult.warning) {
      this._toast('Algorithm Warning', this.algorithmResult.warning, 'warning');
    }

    // Handle negative cycle
    if (this.algorithmResult.negativeCycle) {
      this._toast('Negative Cycle Detected', 'The graph contains a negative-weight cycle. Shortest paths are undefined.', 'error');
    }

    // Update UI
    this._updateStepIndicator();
    this._clearStepLog();
    this._updatePseudocode();

    // Auto-play
    this._play();
  }


  /* ============================================================
     PLAYBACK ENGINE
     ============================================================
     Driven entirely by the step list. Stepping backward simply
     re-applies the snapshot at step N-1.
     ============================================================ */
  _initPlaybackControls() {
    document.getElementById('btn-play')?.addEventListener('click', () => this._togglePlayPause());
    document.getElementById('btn-step-fwd')?.addEventListener('click', () => this._stepForward());
    document.getElementById('btn-step-back')?.addEventListener('click', () => this._stepBack());
    document.getElementById('btn-reset')?.addEventListener('click', () => this._resetPlayback());

    const speedSlider = document.getElementById('speed-slider');
    if (speedSlider) {
      speedSlider.addEventListener('input', () => {
        this.speed = parseFloat(speedSlider.value);
        document.getElementById('speed-value').textContent = this.speed.toFixed(1) + 's';
      });
    }
  }

  _play() {
    if (!this.algorithmResult || this.algorithmResult.steps.length === 0) return;
    this.isPlaying = true;
    this._updatePlayButton();
    this._scheduleNextStep();
  }

  _pause() {
    this.isPlaying = false;
    clearTimeout(this.playTimer);
    this.playTimer = null;
    this._updatePlayButton();
  }

  _togglePlayPause() {
    if (this.isPlaying) {
      this._pause();
    } else {
      if (!this.algorithmResult) {
        this._runAlgorithm();
        return;
      }
      // If at end, restart
      if (this.currentStep >= this.algorithmResult.steps.length - 1) {
        this.currentStep = -1;
        this.renderer.clearAllStates();
        this.editor.refreshBadges();
      }
      this._play();
    }
  }

  _scheduleNextStep() {
    if (!this.isPlaying) return;
    this.playTimer = setTimeout(() => {
      if (this._stepForward()) {
        this._scheduleNextStep();
      } else {
        // Reached end — show final path
        this._showFinalPath();
        this._pause();
      }
    }, this.speed * 1000);
  }

  _stepForward() {
    if (!this.algorithmResult) return false;
    if (this.currentStep >= this.algorithmResult.steps.length - 1) return false;
    this.currentStep++;
    this._applyStep(this.currentStep);
    return true;
  }

  _stepBack() {
    if (!this.algorithmResult || this.currentStep <= 0) return false;
    this._pause();
    this.currentStep--;
    // Re-apply from scratch up to current step
    this.renderer.clearAllStates();
    this.editor.refreshBadges();
    this._applyStep(this.currentStep);
    return true;
  }

  _resetPlayback() {
    this._pause();
    this.currentStep = -1;
    this.algorithmResult = null;
    this.renderer.clearAllStates();
    this.editor.refreshBadges();
    this._updateStepIndicator();
    this._updateDistanceTable(null);
    this._updateResults(null);
    this._clearStepLog();
    this._updatePseudocodeHighlight(-1);
  }

  _applyStep(stepIndex) {
    const step = this.algorithmResult.steps[stepIndex];
    if (!step) return;

    // Clear previous highlighting
    this.renderer.clearAllStates();

    // Apply visited nodes
    if (step.visited) {
      step.visited.forEach(id => {
        this.renderer.setNodeState(id, 'visited');
      });
    }

    // Apply source/dest
    if (this.editor.sourceNode) this.renderer.setNodeState(this.editor.sourceNode, 'source');
    if (this.editor.destNode) this.renderer.setNodeState(this.editor.destNode, 'dest');

    // Highlight current node
    if (step.currentNode) {
      this.renderer.setNodeState(step.currentNode, 'current');
    }

    // Highlight edge being relaxed
    if (step.edge && step.edge.id) {
      this.renderer.setEdgeState(step.edge.id, 'relaxing');
    }

    // Re-apply badges
    this.renderer.setBadges(this.editor.sourceNode, this.editor.destNode);

    // Update UI panels
    this._updateDistanceTable(step);
    this._updatePseudocodeHighlight(step.lineNumber);
    this._addStepLogEntry(stepIndex, step.description);
    this._updateStepIndicator();
  }

  _showFinalPath() {
    if (!this.algorithmResult || this.algorithmResult.noPath) {
      this._updateResults(this.algorithmResult);
      if (this.algorithmResult && this.algorithmResult.noPath) {
        this._toast('No path found', `There is no path from ${this.editor.sourceNode} to ${this.editor.destNode}.`, 'warning');
      }
      return;
    }

    const path = this.algorithmResult.path;
    if (path.length === 0) return;

    // Clear and show path
    this.renderer.clearAllStates();

    // Mark visited nodes
    const lastStep = this.algorithmResult.steps[this.algorithmResult.steps.length - 1];
    if (lastStep && lastStep.visited) {
      lastStep.visited.forEach(id => this.renderer.setNodeState(id, 'visited'));
    }

    // Highlight path nodes and edges
    for (let i = 0; i < path.length; i++) {
      this.renderer.setNodeState(path[i], 'path');

      if (i < path.length - 1) {
        const edge = this.graph.getEdgeBetween(path[i], path[i + 1]);
        if (edge) this.renderer.setEdgeState(edge.id, 'path');
      }
    }

    // Source and dest badges
    this.renderer.setNodeState(this.editor.sourceNode, 'source');
    this.renderer.setNodeState(this.editor.destNode, 'dest');
    this.renderer.setBadges(this.editor.sourceNode, this.editor.destNode);

    this._updateResults(this.algorithmResult);
  }

  _updatePlayButton() {
    const btn = document.getElementById('btn-play');
    if (btn) {
      btn.textContent = this.isPlaying ? '⏸' : '▶';
      btn.setAttribute('aria-label', this.isPlaying ? 'Pause' : 'Play');
    }
  }

  _updateStepIndicator() {
    const el = document.getElementById('step-indicator');
    if (!el) return;
    if (!this.algorithmResult) {
      el.textContent = 'No algorithm running';
    } else {
      el.textContent = `Step ${Math.max(0, this.currentStep + 1)} / ${this.algorithmResult.steps.length}`;
    }
  }


  /* ============================================================
     DISTANCE TABLE
     ============================================================ */
  _updateDistanceTable(step) {
    const wrapper = document.getElementById('dist-table-body');
    if (!wrapper) return;

    if (!step) {
      wrapper.innerHTML = '<tr><td colspan="3" class="text-center text-muted" style="padding:16px">Run an algorithm to see the distance table</td></tr>';
      return;
    }

    const nodes = this.graph.getNodeIds().sort();
    let html = '';

    nodes.forEach(id => {
      const dist = step.distances[id];
      const prev = step.previous[id];
      const isCurrent = step.currentNode === id;
      const isChanged = step.edge && step.edge.to === id;

      let rowClass = '';
      if (isCurrent) rowClass = 'row-current';
      else if (isChanged) rowClass = 'row-changed';

      const distStr = (dist === Infinity || dist === null || dist === undefined) ? '∞' :
                      (typeof dist === 'number' && !Number.isInteger(dist)) ? dist.toFixed(1) : dist;
      const distClass = (dist === Infinity || dist === null || dist === undefined) ? 'cell-inf' : '';

      html += `<tr class="${rowClass}">
        <td class="cell-node">${id}</td>
        <td class="${distClass}">${distStr}</td>
        <td>${prev || '—'}</td>
      </tr>`;
    });

    wrapper.innerHTML = html;
  }


  /* ============================================================
     PSEUDOCODE PANEL
     ============================================================ */
  _updatePseudocode() {
    const wrapper = document.getElementById('pseudocode-content');
    if (!wrapper) return;

    const lines = PSEUDOCODE[this.currentAlgorithm] || [];
    let html = '';
    lines.forEach((line, i) => {
      html += `<div class="pseudocode-line" data-line="${i}">
        <span class="line-num">${i + 1}</span>
        <span class="line-text">${this._escapeHtml(line)}</span>
      </div>`;
    });
    wrapper.innerHTML = html;
  }

  _updatePseudocodeHighlight(lineNumber) {
    document.querySelectorAll('.pseudocode-line').forEach(el => {
      el.classList.toggle('active', parseInt(el.dataset.line) === lineNumber);
    });
    // Scroll active line into view
    const active = document.querySelector('.pseudocode-line.active');
    if (active) active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }


  /* ============================================================
     STEP LOG
     ============================================================ */
  _clearStepLog() {
    const log = document.getElementById('step-log-content');
    if (log) log.innerHTML = '';
  }

  _addStepLogEntry(index, description) {
    const log = document.getElementById('step-log-content');
    if (!log) return;

    // Remove active from previous entries
    log.querySelectorAll('.step-log-entry').forEach(el => el.classList.remove('active'));

    const entry = document.createElement('div');
    entry.className = 'step-log-entry active';
    entry.innerHTML = `<span class="step-num">#${index + 1}</span> ${this._escapeHtml(description)}`;
    log.appendChild(entry);

    // Auto-scroll
    log.scrollTop = log.scrollHeight;
  }


  /* ============================================================
     RESULTS CARD
     ============================================================ */
  _updateResults(result) {
    const pathEl = document.getElementById('results-path');
    const statsEl = document.getElementById('results-stats');
    const resultsCard = document.getElementById('results-card-body');

    if (!pathEl || !statsEl) return;

    if (!result) {
      if (resultsCard) resultsCard.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📊</div><div class="empty-state-text">Run an algorithm to see results</div></div>';
      return;
    }

    let html = '';

    if (result.noPath) {
      html = `<div class="empty-state"><div class="empty-state-icon">🚫</div><div class="empty-state-text">No path found from ${this.editor.sourceNode} to ${this.editor.destNode}</div></div>`;
    } else if (result.negativeCycle) {
      html = `<div class="warning-banner"><span class="warning-icon">⚠️</span><span>Negative cycle detected. Shortest paths are undefined.</span></div>`;
    } else {
      // Path display
      html = '<div class="results-path">';
      result.path.forEach((node, i) => {
        html += `<span class="path-node">${node}</span>`;
        if (i < result.path.length - 1) html += '<span class="path-arrow">→</span>';
      });
      html += '</div>';

      // Stats
      const lastStep = result.steps[result.steps.length - 1];
      const visitedCount = lastStep ? lastStep.visited.length : 0;

      html += `<div class="results-stats">
        <div class="stat-item"><span class="stat-label">Total Cost</span><span class="stat-value">${typeof result.cost === 'number' && !Number.isInteger(result.cost) ? result.cost.toFixed(1) : result.cost}</span></div>
        <div class="stat-item"><span class="stat-label">Steps</span><span class="stat-value">${result.steps.length}</span></div>
        <div class="stat-item"><span class="stat-label">Nodes Visited</span><span class="stat-value">${visitedCount}</span></div>
        <div class="stat-item"><span class="stat-label">Path Length</span><span class="stat-value">${result.path.length} nodes</span></div>
      </div>`;
    }

    if (resultsCard) resultsCard.innerHTML = html;
  }


  /* ============================================================
     COMPLEXITY CARD
     ============================================================ */
  _updateComplexityCard() {
    const info = COMPLEXITY[this.currentAlgorithm];
    if (!info) return;

    const el = document.getElementById('complexity-content');
    if (!el) return;

    el.innerHTML = `
      <div class="complexity-grid">
        <div class="complexity-item">
          <div class="comp-label">Time</div>
          <div class="comp-value">${info.time}</div>
        </div>
        <div class="complexity-item">
          <div class="comp-label">Space</div>
          <div class="comp-value">${info.space}</div>
        </div>
      </div>
      <div class="complexity-desc">${info.bestCase}</div>
      <div class="complexity-desc" style="border-left-color: var(--color-warning);">${info.limitations}</div>
    `;
  }


  /* ============================================================
     DIRECTED/UNDIRECTED TOGGLE
     ============================================================ */
  _initDirectedToggle() {
    const toggle = document.getElementById('directed-toggle');
    if (toggle) {
      toggle.addEventListener('change', () => {
        this.graph.directed = toggle.checked;
        this.renderer.render();
        this.editor.refreshBadges();
        this._toast(toggle.checked ? 'Directed mode' : 'Undirected mode', '', 'info');
      });
    }
  }


  /* ============================================================
     EDGE-LIST TEXT INPUT
     ============================================================ */
  _initEdgeListInput() {
    document.getElementById('btn-apply-edgelist')?.addEventListener('click', () => {
      const textarea = document.getElementById('edgelist-input');
      const errorEl = document.getElementById('edgelist-errors');
      if (!textarea) return;

      const text = textarea.value.trim();
      if (!text) {
        this._toast('Empty edge list', 'Enter edges in format: A B 5', 'warning');
        return;
      }

      const svgRect = this.svg.getBoundingClientRect();
      const { graph: newGraph, errors } = Graph.parseEdgeList(text, svgRect.width || 700, svgRect.height || 500);

      if (errors.length > 0) {
        if (errorEl) {
          errorEl.innerHTML = errors.map(e =>
            `<div class="error-line">Line ${e.line}: ${this._escapeHtml(e.msg)} — "${this._escapeHtml(e.text)}"</div>`
          ).join('');
          errorEl.classList.remove('hidden');
        }
        this._toast('Invalid edge list', `${errors.length} error(s) found.`, 'error');
        return;
      }

      if (errorEl) { errorEl.innerHTML = ''; errorEl.classList.add('hidden'); }

      newGraph.directed = this.graph.directed;
      this.editor.loadGraph(newGraph);
      this._resetPlayback();
      this._toast('Edge list applied', `${newGraph.nodeCount} nodes, ${newGraph.edgeCount} edges.`, 'success');
    });
  }


  /* ============================================================
     SAMPLE GRAPHS
     ============================================================ */
  _initSampleGraphs() {
    const select = document.getElementById('sample-select');
    if (select) {
      select.addEventListener('change', () => {
        const key = select.value;
        if (!key) return;

        const samples = Graph.getSampleGraphs();
        const sample = samples[key];
        if (!sample) return;

        const newGraph = Graph.fromJSON(sample.data);
        this.editor.loadGraph(newGraph);

        // Update directed toggle
        const toggle = document.getElementById('directed-toggle');
        if (toggle) toggle.checked = this.graph.directed;

        this._resetPlayback();
        this._toast('Sample graph loaded', sample.name, 'success');
        select.value = ''; // Reset dropdown
      });
    }
  }


  /* ============================================================
     RANDOM GRAPH GENERATOR
     ============================================================ */
  _initRandomGraph() {
    document.getElementById('btn-random-graph')?.addEventListener('click', () => {
      const nodesInput = document.getElementById('random-nodes');
      const edgesInput = document.getElementById('random-edges');
      const nodeCount = parseInt(nodesInput?.value) || 6;
      const edgeCount = parseInt(edgesInput?.value) || 8;

      if (nodeCount < 2 || nodeCount > 26) {
        this._toast('Invalid node count', 'Must be between 2 and 26.', 'error');
        return;
      }
      if (edgeCount < nodeCount - 1) {
        this._toast('Too few edges', `Need at least ${nodeCount - 1} edges for a connected graph.`, 'error');
        return;
      }

      const svgRect = this.svg.getBoundingClientRect();
      const newGraph = Graph.generateRandom(nodeCount, edgeCount, svgRect.width || 700, svgRect.height || 500);
      newGraph.directed = this.graph.directed;
      this.editor.loadGraph(newGraph);
      this._resetPlayback();
      this._toast('Random graph generated', `${newGraph.nodeCount} nodes, ${newGraph.edgeCount} edges.`, 'success');
    });
  }


  /* ============================================================
     IMPORT / EXPORT JSON
     ============================================================ */
  _initImportExport() {
    // Export
    document.getElementById('btn-export')?.addEventListener('click', () => {
      if (this.graph.nodeCount === 0) {
        this._toast('Nothing to export', 'Add some nodes first.', 'warning');
        return;
      }
      const json = JSON.stringify(this.graph.toJSON(), null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'pathfinder-graph.json';
      a.click();
      URL.revokeObjectURL(url);
      this._toast('Graph exported', 'JSON file downloaded.', 'success');
    });

    // Import
    document.getElementById('btn-import')?.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const json = JSON.parse(ev.target.result);
            const newGraph = Graph.fromJSON(json);
            this.editor.loadGraph(newGraph);
            const toggle = document.getElementById('directed-toggle');
            if (toggle) toggle.checked = this.graph.directed;
            this._resetPlayback();
            this._toast('Graph imported', `${newGraph.nodeCount} nodes, ${newGraph.edgeCount} edges.`, 'success');
          } catch (err) {
            this._toast('Import failed', 'Invalid JSON file.', 'error');
          }
        };
        reader.readAsText(file);
      });
      input.click();
    });
  }


  /* ============================================================
     WEIGHT INPUT POPUP
     ============================================================ */
  _initWeightInput() {
    this._weightPopup = document.getElementById('weight-input-popup');
    this._weightInput = document.getElementById('weight-input');
    this._weightFrom = null;
    this._weightTo = null;

    document.getElementById('weight-input-ok')?.addEventListener('click', () => this._confirmWeight());
    document.getElementById('weight-input-cancel')?.addEventListener('click', () => this._hideWeightInput());

    if (this._weightInput) {
      this._weightInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this._confirmWeight();
        if (e.key === 'Escape') this._hideWeightInput();
      });
    }
  }

  _showWeightInput(fromId, toId) {
    this._weightFrom = fromId;
    this._weightTo = toId;

    const fromNode = this.graph.nodes.get(fromId);
    const toNode = this.graph.nodes.get(toId);
    if (!fromNode || !toNode || !this._weightPopup) return;

    // Position near the midpoint
    const mx = (fromNode.x + toNode.x) / 2;
    const my = (fromNode.y + toNode.y) / 2;

    const svgRect = this.svg.getBoundingClientRect();
    this._weightPopup.style.left = (svgRect.left + mx - 60) + 'px';
    this._weightPopup.style.top = (svgRect.top + my - 50) + 'px';
    this._weightPopup.classList.add('visible');
    this._weightInput.value = '1';
    this._weightInput.select();
    this._weightInput.focus();
  }

  _confirmWeight() {
    const weight = parseFloat(this._weightInput?.value);
    if (isNaN(weight)) {
      this._toast('Invalid weight', 'Please enter a number.', 'error');
      return;
    }
    if (this._weightFrom && this._weightTo) {
      this.editor.createEdge(this._weightFrom, this._weightTo, weight);
    }
    this._hideWeightInput();
  }

  _hideWeightInput() {
    if (this._weightPopup) this._weightPopup.classList.remove('visible');
    this._weightFrom = null;
    this._weightTo = null;
  }


  /* ============================================================
     EDGE WEIGHT EDITING (click pill to edit)
     ============================================================ */
  _initWeightEditing() {
    // Delegated event on SVG for edge weight groups
    this.svg.addEventListener('dblclick', (e) => {
      const wg = e.target.closest('.edge-weight-group');
      if (!wg) return;
      const edgeId = wg.dataset.edgeId;
      if (!edgeId) return;

      const edge = this.graph.edges.get(edgeId);
      if (!edge) return;

      const newWeight = prompt(`Edit weight for edge ${edge.from}→${edge.to}:`, edge.weight);
      if (newWeight === null) return;
      const w = parseFloat(newWeight);
      if (isNaN(w)) {
        this._toast('Invalid weight', 'Please enter a number.', 'error');
        return;
      }
      this.graph.setEdgeWeight(edgeId, w);
      this.renderer.updateEdgeWeight(edgeId);
    });
  }


  /* ============================================================
     THEME TOGGLE
     ============================================================ */
  _initThemeToggle() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;

    // Load saved theme
    const saved = localStorage.getItem('pathfinder-theme') || 'dark';
    if (saved === 'light') document.documentElement.setAttribute('data-theme', 'light');
    this._updateThemeIcon(saved);

    btn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'light' ? 'dark' : 'light';
      if (next === 'dark') {
        document.documentElement.removeAttribute('data-theme');
      } else {
        document.documentElement.setAttribute('data-theme', 'light');
      }
      localStorage.setItem('pathfinder-theme', next);
      this._updateThemeIcon(next);
    });
  }

  _updateThemeIcon(theme) {
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = theme === 'light' ? '🌙' : '☀️';
  }


  /* ============================================================
     KEYBOARD SHORTCUTS
     ============================================================ */
  _initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Don't trigger if typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          this._togglePlayPause();
          break;
        case 'ArrowRight':
          e.preventDefault();
          this._stepForward();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          this._stepBack();
          break;
        case 'Escape':
          e.preventDefault();
          this.editor.cancelEdgeDrawing();
          this._hideWeightInput();
          this._hideModal('compare-modal');
          this._hideModal('random-modal');
          break;
        case 'Delete':
        case 'Backspace':
          if (this.editor.tool === 'delete') {
            // Already in delete mode
          }
          break;
      }
    });
  }


  /* ============================================================
     CARD COLLAPSE
     ============================================================ */
  _initCardCollapse() {
    document.querySelectorAll('.card-header').forEach(header => {
      header.addEventListener('click', () => {
        header.closest('.card')?.classList.toggle('collapsed');
      });
    });
  }


  /* ============================================================
     COMPARE MODE
     ============================================================ */
  _initCompareMode() {
    document.getElementById('btn-compare')?.addEventListener('click', () => {
      this._runCompare();
    });

    document.getElementById('compare-close')?.addEventListener('click', () => {
      this._hideModal('compare-modal');
    });
  }

  _runCompare() {
    if (!this.editor.sourceNode || !this.editor.destNode) {
      this._toast('Select source and destination', 'Both are required for comparison.', 'warning');
      return;
    }

    const src = this.editor.sourceNode;
    const dst = this.editor.destNode;

    const results = {
      'Dijkstra': dijkstra(this.graph, src, dst),
      'Bellman-Ford': bellmanFord(this.graph, src, dst),
      'BFS': bfs(this.graph, src, dst),
    };

    // Find best values for highlighting
    const costs = Object.values(results).filter(r => !r.noPath && !r.negativeCycle).map(r => r.cost);
    const minCost = Math.min(...costs);
    const steps = Object.values(results).map(r => r.steps.length);
    const minSteps = Math.min(...steps);

    let html = '<table class="compare-table"><thead><tr><th>Algorithm</th><th>Path</th><th>Cost</th><th>Steps</th><th>Visited</th></tr></thead><tbody>';

    Object.entries(results).forEach(([name, result]) => {
      const pathStr = result.noPath ? '<span class="no-path">No path</span>' :
                      result.negativeCycle ? '<span class="no-path">Neg. cycle</span>' :
                      result.path.join(' → ');
      const lastStep = result.steps[result.steps.length - 1];
      const visitedCount = lastStep ? lastStep.visited.length : 0;
      const costStr = result.noPath ? '—' : (typeof result.cost === 'number' && !Number.isInteger(result.cost)) ? result.cost.toFixed(1) : result.cost;
      const costClass = (!result.noPath && result.cost === minCost) ? 'best-value' : '';
      const stepClass = (result.steps.length === minSteps) ? 'best-value' : '';

      html += `<tr>
        <td style="font-weight:600; font-family: var(--font-sans);">${name}</td>
        <td style="font-size:0.75rem">${pathStr}</td>
        <td class="${costClass}">${costStr}</td>
        <td class="${stepClass}">${result.steps.length}</td>
        <td>${visitedCount}</td>
      </tr>`;
    });

    html += '</tbody></table>';

    document.getElementById('compare-body').innerHTML = html;
    this._showModal('compare-modal');
  }


  /* ============================================================
     FIRST-TIME ONBOARDING OVERLAY
     ============================================================ */
  _initOnboarding() {
    const overlay = document.getElementById('onboarding-overlay');
    if (!overlay) return;

    // Show only on first visit
    if (localStorage.getItem('pathfinder-onboarded')) {
      overlay.classList.remove('visible');
      return;
    }

    overlay.classList.add('visible');

    document.getElementById('onboarding-skip')?.addEventListener('click', () => {
      overlay.classList.remove('visible');
      localStorage.setItem('pathfinder-onboarded', 'true');
    });

    document.getElementById('onboarding-start')?.addEventListener('click', () => {
      overlay.classList.remove('visible');
      localStorage.setItem('pathfinder-onboarded', 'true');
    });
  }


  /* ============================================================
     COLOR LEGEND
     ============================================================ */
  _initLegend() {
    // Legend is static HTML, no JS needed.
    // We also init the weight editing here since it's an SVG event
    this._initWeightEditing();
  }


  /* ============================================================
     TOAST NOTIFICATION SYSTEM
     ============================================================ */
  _toast(title, message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌' };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
      <div class="toast-content">
        <div class="toast-title">${this._escapeHtml(title)}</div>
        ${message ? `<div class="toast-message">${this._escapeHtml(message)}</div>` : ''}
      </div>
      <button class="toast-close" aria-label="Close notification">✕</button>
    `;

    toast.querySelector('.toast-close').addEventListener('click', () => this._removeToast(toast));
    container.appendChild(toast);

    // Auto-remove after 5 seconds
    setTimeout(() => this._removeToast(toast), 5000);
  }

  _removeToast(toast) {
    if (!toast || !toast.parentNode) return;
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }


  /* ============================================================
     MODAL HELPERS
     ============================================================ */
  _showModal(id) {
    document.getElementById(id)?.classList.add('visible');
  }

  _hideModal(id) {
    document.getElementById(id)?.classList.remove('visible');
  }


  /* ============================================================
     GRAPH CHANGE HANDLER
     ============================================================ */
  _onGraphChanged() {
    this._updateEmptyState();
    this._updateNodeDropdowns();
  }

  _onSourceChanged(id) {
    const select = document.getElementById('source-select');
    if (select) select.value = id || '';
  }

  _onDestChanged(id) {
    const select = document.getElementById('dest-select');
    if (select) select.value = id || '';
  }

  _updateEmptyState() {
    const empty = document.getElementById('canvas-empty-state');
    if (empty) {
      empty.classList.toggle('hidden', this.graph.nodeCount > 0);
    }
  }


  /* ============================================================
     UTILITY
     ============================================================ */
  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

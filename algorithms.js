/* ============================================================
   algorithms.js — Shortest-Path Algorithms with Step-by-Step Output
   ============================================================
   Exports (global):
     class MinHeap
     function dijkstra(graph, sourceId, destId)
     function bellmanFord(graph, sourceId, destId)
     function bfs(graph, sourceId, destId)
     function aStar(graph, sourceId, destId)
     const PSEUDOCODE   — pseudocode text per algorithm
     const COMPLEXITY   — complexity info per algorithm
   ============================================================ */

/* ============================================================
   1. MIN-HEAP (Binary Heap) — used by Dijkstra and A*
   ============================================================
   Each element is { key: <priority>, value: <nodeId> }.
   Lower key = higher priority (min-heap).
   ============================================================ */
class MinHeap {
  constructor() {
    /** @type {Array<{key:number, value:string}>} */
    this.heap = [];
  }

  get size() { return this.heap.length; }

  /** Insert a new element with the given priority */
  push(key, value) {
    this.heap.push({ key, value });
    this._bubbleUp(this.heap.length - 1);
  }

  /** Extract the minimum element */
  pop() {
    if (this.heap.length === 0) return null;
    const min = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._sinkDown(0);
    }
    return min;
  }

  /** Check if heap is empty */
  isEmpty() { return this.heap.length === 0; }

  /* --- internal heap operations --- */

  _bubbleUp(i) {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      // If current element's key is smaller than parent, swap upward
      if (this.heap[i].key < this.heap[parent].key) {
        [this.heap[i], this.heap[parent]] = [this.heap[parent], this.heap[i]];
        i = parent;
      } else {
        break;
      }
    }
  }

  _sinkDown(i) {
    const n = this.heap.length;
    while (true) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;

      // Compare with left child
      if (left < n && this.heap[left].key < this.heap[smallest].key) {
        smallest = left;
      }
      // Compare with right child
      if (right < n && this.heap[right].key < this.heap[smallest].key) {
        smallest = right;
      }

      if (smallest !== i) {
        [this.heap[i], this.heap[smallest]] = [this.heap[smallest], this.heap[i]];
        i = smallest;
      } else {
        break;
      }
    }
  }
}


/* ============================================================
   HELPER: Reconstruct path from previous-node table
   ============================================================ */
function _reconstructPath(previous, sourceId, destId) {
  const path = [];
  let current = destId;
  while (current !== null) {
    path.unshift(current);
    current = previous[current];
  }
  // Verify path starts at source
  if (path[0] !== sourceId) return [];
  return path;
}

/** Deep-clone a simple object for step snapshots */
function _snap(obj) { return JSON.parse(JSON.stringify(obj)); }

/** Format distance for display (show ∞ for Infinity) */
function _fmtDist(d) {
  if (d === Infinity || d === null || d === undefined) return '∞';
  return String(d);
}


/* ============================================================
   2. DIJKSTRA'S ALGORITHM
   ============================================================
   Uses a min-heap priority queue.
   Time:  O((V + E) log V)
   Space: O(V)

   Returns:
   {
     steps:    [{currentNode, edge, distances, previous, visited, lineNumber, description}],
     path:     [nodeId, ...] or [],
     cost:     number or Infinity,
     noPath:   boolean,
     warning:  string or null  (negative-weight warning)
   }
   ============================================================ */
function dijkstra(graph, sourceId, destId) {
  const result = { steps: [], path: [], cost: Infinity, noPath: false, warning: null };

  // ---- Pre-checks ----
  if (graph.hasNegativeWeights()) {
    result.warning = 'Graph contains negative edge weights. Dijkstra may produce incorrect results. Use Bellman-Ford instead.';
  }

  const nodeIds = graph.getNodeIds();
  if (!nodeIds.includes(sourceId) || !nodeIds.includes(destId)) {
    result.noPath = true;
    return result;
  }

  // ---- Special case: source == destination ----
  if (sourceId === destId) {
    const distances = {};
    const previous = {};
    nodeIds.forEach(id => { distances[id] = Infinity; previous[id] = null; });
    distances[sourceId] = 0;
    result.steps.push({
      currentNode: sourceId, edge: null,
      distances: _snap(distances), previous: _snap(previous),
      visited: [sourceId], lineNumber: 0,
      description: `Source equals destination. Distance is 0.`,
    });
    result.path = [sourceId];
    result.cost = 0;
    return result;
  }

  // ---- Initialization ----
  // Line 0: Initialize distances to ∞, source distance to 0
  const distances = {};
  const previous = {};
  const visited = new Set();

  nodeIds.forEach(id => {
    distances[id] = Infinity;
    previous[id] = null;
  });
  distances[sourceId] = 0;

  result.steps.push({
    currentNode: null, edge: null,
    distances: _snap(distances), previous: _snap(previous),
    visited: [], lineNumber: 0,
    description: `Initialize all distances to ∞. Set distance of source ${sourceId} to 0.`,
  });

  // ---- Priority queue ----
  // Line 1: Add source to priority queue
  const pq = new MinHeap();
  pq.push(0, sourceId);

  result.steps.push({
    currentNode: sourceId, edge: null,
    distances: _snap(distances), previous: _snap(previous),
    visited: [], lineNumber: 1,
    description: `Add source ${sourceId} to priority queue with priority 0.`,
  });

  // ---- Main loop ----
  while (!pq.isEmpty()) {
    // Line 2: Extract node with minimum distance
    const { key: dist, value: u } = pq.pop();

    // Skip if already visited (stale entry in priority queue)
    if (visited.has(u)) continue;

    // Line 3: Mark node as visited
    visited.add(u);

    result.steps.push({
      currentNode: u, edge: null,
      distances: _snap(distances), previous: _snap(previous),
      visited: Array.from(visited), lineNumber: 3,
      description: `Visit node ${u} (distance = ${_fmtDist(distances[u])}).`,
    });

    // Early exit if we've reached the destination
    if (u === destId) {
      result.steps.push({
        currentNode: u, edge: null,
        distances: _snap(distances), previous: _snap(previous),
        visited: Array.from(visited), lineNumber: 7,
        description: `Destination ${destId} reached! Shortest distance = ${distances[destId]}.`,
      });
      break;
    }

    // Line 4-6: Relax all edges from u
    const neighbors = graph.getNeighbors(u);
    for (const { nodeId: v, edgeId, weight: w } of neighbors) {
      if (visited.has(v)) continue;

      const newDist = distances[u] + w;

      // Line 5: Check if new distance is shorter
      if (newDist < distances[v]) {
        const oldDist = distances[v];
        distances[v] = newDist;
        previous[v] = u;

        // Line 6: Update priority queue
        pq.push(newDist, v);

        result.steps.push({
          currentNode: u,
          edge: { from: u, to: v, id: edgeId },
          distances: _snap(distances), previous: _snap(previous),
          visited: Array.from(visited), lineNumber: 5,
          description: `Relaxing edge ${u}→${v}: ${_fmtDist(distances[u])} + ${w} = ${newDist} < ${_fmtDist(oldDist)}, update distance of ${v} to ${newDist}.`,
        });
      } else {
        result.steps.push({
          currentNode: u,
          edge: { from: u, to: v, id: edgeId },
          distances: _snap(distances), previous: _snap(previous),
          visited: Array.from(visited), lineNumber: 5,
          description: `Relaxing edge ${u}→${v}: ${_fmtDist(distances[u])} + ${w} = ${newDist} ≥ ${_fmtDist(distances[v])}, no update.`,
        });
      }
    }
  }

  // ---- Build final path ----
  result.path = _reconstructPath(previous, sourceId, destId);
  result.cost = distances[destId];
  result.noPath = result.path.length === 0 || distances[destId] === Infinity;

  if (result.noPath) {
    result.steps.push({
      currentNode: null, edge: null,
      distances: _snap(distances), previous: _snap(previous),
      visited: Array.from(visited), lineNumber: 8,
      description: `No path found from ${sourceId} to ${destId}.`,
    });
  }

  return result;
}


/* ============================================================
   3. BELLMAN-FORD ALGORITHM
   ============================================================
   Relaxes all edges V-1 times. Detects negative cycles with
   one additional iteration.
   Time:  O(V * E)
   Space: O(V)
   ============================================================ */
function bellmanFord(graph, sourceId, destId) {
  const result = { steps: [], path: [], cost: Infinity, noPath: false, warning: null, negativeCycle: false };

  const nodeIds = graph.getNodeIds();
  if (!nodeIds.includes(sourceId) || !nodeIds.includes(destId)) {
    result.noPath = true;
    return result;
  }

  if (sourceId === destId) {
    const distances = {};
    const previous = {};
    nodeIds.forEach(id => { distances[id] = Infinity; previous[id] = null; });
    distances[sourceId] = 0;
    result.steps.push({
      currentNode: sourceId, edge: null,
      distances: _snap(distances), previous: _snap(previous),
      visited: [sourceId], lineNumber: 0,
      description: `Source equals destination. Distance is 0.`,
    });
    result.path = [sourceId];
    result.cost = 0;
    return result;
  }

  // ---- Initialization ----
  const distances = {};
  const previous = {};
  nodeIds.forEach(id => { distances[id] = Infinity; previous[id] = null; });
  distances[sourceId] = 0;

  result.steps.push({
    currentNode: null, edge: null,
    distances: _snap(distances), previous: _snap(previous),
    visited: [], lineNumber: 0,
    description: `Initialize all distances to ∞. Set distance of source ${sourceId} to 0.`,
  });

  // Collect all edges (respect directed/undirected)
  const allEdges = [];
  for (const [, e] of graph.edges) {
    allEdges.push({ from: e.from, to: e.to, weight: e.weight, id: e.id });
    if (!graph.directed) {
      allEdges.push({ from: e.to, to: e.from, weight: e.weight, id: e.id });
    }
  }

  const V = nodeIds.length;
  const visited = new Set();

  // ---- V-1 relaxation iterations ----
  for (let i = 0; i < V - 1; i++) {
    let anyUpdate = false;

    result.steps.push({
      currentNode: null, edge: null,
      distances: _snap(distances), previous: _snap(previous),
      visited: Array.from(visited), lineNumber: 1,
      description: `--- Iteration ${i + 1} of ${V - 1} ---`,
    });

    // Line 2-4: Relax every edge
    for (const edge of allEdges) {
      if (distances[edge.from] === Infinity) continue; // Can't relax from unreachable node

      visited.add(edge.from);
      const newDist = distances[edge.from] + edge.weight;

      if (newDist < distances[edge.to]) {
        const oldDist = distances[edge.to];
        distances[edge.to] = newDist;
        previous[edge.to] = edge.from;
        anyUpdate = true;

        result.steps.push({
          currentNode: edge.from,
          edge: { from: edge.from, to: edge.to, id: edge.id },
          distances: _snap(distances), previous: _snap(previous),
          visited: Array.from(visited), lineNumber: 3,
          description: `Relaxing edge ${edge.from}→${edge.to}: ${_fmtDist(distances[edge.from])} + ${edge.weight} = ${newDist} < ${_fmtDist(oldDist)}, update distance of ${edge.to} to ${newDist}.`,
        });
      }
    }

    // Early termination if no updates this iteration
    if (!anyUpdate) {
      result.steps.push({
        currentNode: null, edge: null,
        distances: _snap(distances), previous: _snap(previous),
        visited: Array.from(visited), lineNumber: 4,
        description: `No updates in iteration ${i + 1}. Terminating early.`,
      });
      break;
    }
  }

  // ---- Negative cycle detection ----
  // Line 5: One more pass — if any distance decreases, there's a negative cycle
  for (const edge of allEdges) {
    if (distances[edge.from] === Infinity) continue;
    const newDist = distances[edge.from] + edge.weight;
    if (newDist < distances[edge.to]) {
      result.negativeCycle = true;
      result.warning = 'Negative cycle detected! Shortest path is undefined.';

      result.steps.push({
        currentNode: edge.from,
        edge: { from: edge.from, to: edge.to, id: edge.id },
        distances: _snap(distances), previous: _snap(previous),
        visited: Array.from(visited), lineNumber: 5,
        description: `⚠ Negative cycle detected: edge ${edge.from}→${edge.to} can still be relaxed (${_fmtDist(distances[edge.from])} + ${edge.weight} < ${_fmtDist(distances[edge.to])}).`,
      });
      break;
    }
  }

  if (!result.negativeCycle) {
    result.steps.push({
      currentNode: null, edge: null,
      distances: _snap(distances), previous: _snap(previous),
      visited: Array.from(visited), lineNumber: 6,
      description: `No negative cycle detected. Algorithm complete.`,
    });
  }

  // ---- Build path ----
  if (!result.negativeCycle) {
    result.path = _reconstructPath(previous, sourceId, destId);
    result.cost = distances[destId];
    result.noPath = result.path.length === 0 || distances[destId] === Infinity;

    if (result.noPath) {
      result.steps.push({
        currentNode: null, edge: null,
        distances: _snap(distances), previous: _snap(previous),
        visited: Array.from(visited), lineNumber: 7,
        description: `No path found from ${sourceId} to ${destId}.`,
      });
    }
  }

  return result;
}


/* ============================================================
   4. BFS (Breadth-First Search) — Unweighted shortest path
   ============================================================
   Treats all edges as weight 1. Uses a FIFO queue.
   Time:  O(V + E)
   Space: O(V)
   ============================================================ */
function bfs(graph, sourceId, destId) {
  const result = { steps: [], path: [], cost: Infinity, noPath: false, warning: null };

  const nodeIds = graph.getNodeIds();
  if (!nodeIds.includes(sourceId) || !nodeIds.includes(destId)) {
    result.noPath = true;
    return result;
  }

  if (sourceId === destId) {
    const distances = {};
    const previous = {};
    nodeIds.forEach(id => { distances[id] = Infinity; previous[id] = null; });
    distances[sourceId] = 0;
    result.steps.push({
      currentNode: sourceId, edge: null,
      distances: _snap(distances), previous: _snap(previous),
      visited: [sourceId], lineNumber: 0,
      description: `Source equals destination. Distance is 0.`,
    });
    result.path = [sourceId];
    result.cost = 0;
    return result;
  }

  // ---- Initialization ----
  const distances = {};
  const previous = {};
  const visited = new Set();

  nodeIds.forEach(id => { distances[id] = Infinity; previous[id] = null; });
  distances[sourceId] = 0;
  visited.add(sourceId);

  result.steps.push({
    currentNode: null, edge: null,
    distances: _snap(distances), previous: _snap(previous),
    visited: Array.from(visited), lineNumber: 0,
    description: `Initialize all distances to ∞. Set distance of source ${sourceId} to 0. Add ${sourceId} to queue.`,
  });

  // ---- BFS Queue ----
  const queue = [sourceId];

  while (queue.length > 0) {
    // Line 1: Dequeue front node
    const u = queue.shift();

    result.steps.push({
      currentNode: u, edge: null,
      distances: _snap(distances), previous: _snap(previous),
      visited: Array.from(visited), lineNumber: 1,
      description: `Dequeue node ${u} (distance = ${distances[u]}).`,
    });

    // Early exit
    if (u === destId) {
      result.steps.push({
        currentNode: u, edge: null,
        distances: _snap(distances), previous: _snap(previous),
        visited: Array.from(visited), lineNumber: 5,
        description: `Destination ${destId} reached! Distance = ${distances[destId]} hops.`,
      });
      break;
    }

    // Line 2-4: Explore neighbors
    const neighbors = graph.getNeighbors(u);
    for (const { nodeId: v, edgeId } of neighbors) {
      if (!visited.has(v)) {
        visited.add(v);
        distances[v] = distances[u] + 1;
        previous[v] = u;
        queue.push(v);

        result.steps.push({
          currentNode: u,
          edge: { from: u, to: v, id: edgeId },
          distances: _snap(distances), previous: _snap(previous),
          visited: Array.from(visited), lineNumber: 3,
          description: `Discover node ${v} via edge ${u}→${v}. Distance = ${distances[v]} hops. Add to queue.`,
        });
      }
    }
  }

  // ---- Build path ----
  result.path = _reconstructPath(previous, sourceId, destId);
  result.cost = distances[destId];
  result.noPath = result.path.length === 0 || distances[destId] === Infinity;

  if (result.noPath) {
    result.steps.push({
      currentNode: null, edge: null,
      distances: _snap(distances), previous: _snap(previous),
      visited: Array.from(visited), lineNumber: 6,
      description: `No path found from ${sourceId} to ${destId}.`,
    });
  }

  return result;
}


/* ============================================================
   5. A* ALGORITHM
   ============================================================
   Uses Euclidean distance between node positions as heuristic.
   Time:  O((V + E) log V)  — same worst case as Dijkstra
   Space: O(V)
   ============================================================ */
function aStar(graph, sourceId, destId) {
  const result = { steps: [], path: [], cost: Infinity, noPath: false, warning: null };

  if (graph.hasNegativeWeights()) {
    result.warning = 'Graph contains negative edge weights. A* may produce incorrect results.';
  }

  const nodeIds = graph.getNodeIds();
  if (!nodeIds.includes(sourceId) || !nodeIds.includes(destId)) {
    result.noPath = true;
    return result;
  }

  if (sourceId === destId) {
    const distances = {};
    const previous = {};
    nodeIds.forEach(id => { distances[id] = Infinity; previous[id] = null; });
    distances[sourceId] = 0;
    result.steps.push({
      currentNode: sourceId, edge: null,
      distances: _snap(distances), previous: _snap(previous),
      visited: [sourceId], lineNumber: 0,
      description: `Source equals destination. Distance is 0.`,
    });
    result.path = [sourceId];
    result.cost = 0;
    return result;
  }

  // ---- Heuristic function: Euclidean distance to destination ----
  const destNode = graph.nodes.get(destId);
  function heuristic(nodeId) {
    const n = graph.nodes.get(nodeId);
    if (!n || !destNode) return 0;
    const dx = n.x - destNode.x;
    const dy = n.y - destNode.y;
    // Scale down to be roughly comparable to edge weights
    return Math.sqrt(dx * dx + dy * dy) / 50;
  }

  // ---- Initialization ----
  const gScore = {};   // g(n): cost from source to n
  const fScore = {};   // f(n) = g(n) + h(n)
  const previous = {};
  const visited = new Set();

  nodeIds.forEach(id => {
    gScore[id] = Infinity;
    fScore[id] = Infinity;
    previous[id] = null;
  });
  gScore[sourceId] = 0;
  fScore[sourceId] = heuristic(sourceId);

  // Report distances as gScore for the distance table
  result.steps.push({
    currentNode: null, edge: null,
    distances: _snap(gScore), previous: _snap(previous),
    visited: [], lineNumber: 0,
    description: `Initialize all distances to ∞. Set g(${sourceId}) = 0, f(${sourceId}) = ${fScore[sourceId].toFixed(1)} (heuristic).`,
  });

  const openSet = new MinHeap();
  openSet.push(fScore[sourceId], sourceId);

  result.steps.push({
    currentNode: sourceId, edge: null,
    distances: _snap(gScore), previous: _snap(previous),
    visited: [], lineNumber: 1,
    description: `Add source ${sourceId} to open set with f-score = ${fScore[sourceId].toFixed(1)}.`,
  });

  // ---- Main loop ----
  while (!openSet.isEmpty()) {
    const { value: u } = openSet.pop();

    if (visited.has(u)) continue;
    visited.add(u);

    result.steps.push({
      currentNode: u, edge: null,
      distances: _snap(gScore), previous: _snap(previous),
      visited: Array.from(visited), lineNumber: 3,
      description: `Visit node ${u} (g = ${_fmtDist(gScore[u])}, f = ${_fmtDist(fScore[u])}).`,
    });

    if (u === destId) {
      result.steps.push({
        currentNode: u, edge: null,
        distances: _snap(gScore), previous: _snap(previous),
        visited: Array.from(visited), lineNumber: 7,
        description: `Destination ${destId} reached! Shortest distance = ${gScore[destId]}.`,
      });
      break;
    }

    const neighbors = graph.getNeighbors(u);
    for (const { nodeId: v, edgeId, weight: w } of neighbors) {
      if (visited.has(v)) continue;

      const tentativeG = gScore[u] + w;

      if (tentativeG < gScore[v]) {
        const oldG = gScore[v];
        previous[v] = u;
        gScore[v] = tentativeG;
        fScore[v] = tentativeG + heuristic(v);
        openSet.push(fScore[v], v);

        result.steps.push({
          currentNode: u,
          edge: { from: u, to: v, id: edgeId },
          distances: _snap(gScore), previous: _snap(previous),
          visited: Array.from(visited), lineNumber: 5,
          description: `Relaxing edge ${u}→${v}: g = ${_fmtDist(gScore[u])} + ${w} = ${tentativeG} < ${_fmtDist(oldG)}, f(${v}) = ${fScore[v].toFixed(1)}.`,
        });
      } else {
        result.steps.push({
          currentNode: u,
          edge: { from: u, to: v, id: edgeId },
          distances: _snap(gScore), previous: _snap(previous),
          visited: Array.from(visited), lineNumber: 5,
          description: `Relaxing edge ${u}→${v}: g = ${_fmtDist(gScore[u])} + ${w} = ${tentativeG} ≥ ${_fmtDist(gScore[v])}, no update.`,
        });
      }
    }
  }

  // ---- Build path ----
  result.path = _reconstructPath(previous, sourceId, destId);
  result.cost = gScore[destId];
  result.noPath = result.path.length === 0 || gScore[destId] === Infinity;

  if (result.noPath) {
    result.steps.push({
      currentNode: null, edge: null,
      distances: _snap(gScore), previous: _snap(previous),
      visited: Array.from(visited), lineNumber: 8,
      description: `No path found from ${sourceId} to ${destId}.`,
    });
  }

  return result;
}


/* ============================================================
   6. PSEUDOCODE DEFINITIONS
   ============================================================ */
const PSEUDOCODE = {
  dijkstra: [
    /* 0 */ 'Initialize dist[v] = ∞ for all v; dist[source] = 0',
    /* 1 */ 'Add source to priority queue PQ with priority 0',
    /* 2 */ 'while PQ is not empty:',
    /* 3 */ '    u = PQ.extractMin()',
    /* 4 */ '    for each neighbor v of u:',
    /* 5 */ '        if dist[u] + w(u,v) < dist[v]:',
    /* 6 */ '            dist[v] = dist[u] + w(u,v); prev[v] = u',
    /* 7 */ '            PQ.decreaseKey(v, dist[v])',
    /* 8 */ 'return dist[], prev[]',
  ],
  bellmanFord: [
    /* 0 */ 'Initialize dist[v] = ∞ for all v; dist[source] = 0',
    /* 1 */ 'for i = 1 to |V| - 1:',
    /* 2 */ '    for each edge (u, v) with weight w:',
    /* 3 */ '        if dist[u] + w < dist[v]:',
    /* 4 */ '            dist[v] = dist[u] + w; prev[v] = u',
    /* 5 */ 'for each edge (u, v) with weight w:',
    /* 6 */ '    if dist[u] + w < dist[v]: NEGATIVE CYCLE!',
    /* 7 */ 'return dist[], prev[]',
  ],
  bfs: [
    /* 0 */ 'Initialize dist[v] = ∞ for all v; dist[source] = 0',
    /* 1 */ 'Enqueue source into queue Q',
    /* 2 */ 'while Q is not empty:',
    /* 3 */ '    u = Q.dequeue()',
    /* 4 */ '    for each neighbor v of u:',
    /* 5 */ '        if v not visited:',
    /* 6 */ '            dist[v] = dist[u] + 1; prev[v] = u',
    /* 7 */ '            Q.enqueue(v)',
    /* 8 */ 'return dist[], prev[]',
  ],
  aStar: [
    /* 0 */ 'Initialize g[v] = ∞, f[v] = ∞; g[source] = 0',
    /* 1 */ 'f[source] = h(source); Add source to open set',
    /* 2 */ 'while open set is not empty:',
    /* 3 */ '    u = node with lowest f in open set',
    /* 4 */ '    if u == destination: return path',
    /* 5 */ '    for each neighbor v of u:',
    /* 6 */ '        tentative_g = g[u] + w(u,v)',
    /* 7 */ '        if tentative_g < g[v]:',
    /* 8 */ '            g[v] = tentative_g; f[v] = g[v] + h(v)',
    /* 9 */ '            prev[v] = u',
  ],
};


/* ============================================================
   7. COMPLEXITY INFORMATION
   ============================================================ */
const COMPLEXITY = {
  dijkstra: {
    time: 'O((V + E) log V)',
    space: 'O(V)',
    bestCase: 'Weighted graphs with non-negative edge weights. Efficient with sparse graphs and a binary heap.',
    limitations: 'Cannot handle negative edge weights. Greedy approach assumes non-negative weights for correctness.',
  },
  bellmanFord: {
    time: 'O(V × E)',
    space: 'O(V)',
    bestCase: 'Graphs with negative edge weights (but no negative cycles). Also useful for detecting negative cycles.',
    limitations: 'Slower than Dijkstra for non-negative weight graphs. Cannot find shortest paths if a negative cycle is reachable from the source.',
  },
  bfs: {
    time: 'O(V + E)',
    space: 'O(V)',
    bestCase: 'Unweighted graphs or when all edge weights are equal. Fastest shortest-path algorithm for this case.',
    limitations: 'Only works correctly for unweighted (or equal-weight) graphs. Ignores actual edge weights.',
  },
  aStar: {
    time: 'O((V + E) log V)',
    space: 'O(V)',
    bestCase: 'Graphs with spatial coordinates where a good heuristic (e.g., Euclidean distance) can guide the search toward the destination.',
    limitations: 'Requires an admissible heuristic. Performance degrades with poor heuristics. Cannot handle negative weights.',
  },
};

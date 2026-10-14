# PathFinder — Shortest Path Algorithm Visualizer

> **Design and Analysis of Algorithms (DAA) Capstone Project**  
> *Title:* Implementation of an Interactive Web App for Shortest Path Algorithm with Graph Input and Visual Path Display  
> *Technology Stack:* Pure Vanilla HTML5, CSS3, Modern JavaScript (ES6+), SVG. Zero external libraries, zero frameworks, zero build steps.

---

## Table of Contents
1. [Project Overview & Problem Statement](#project-overview--problem-statement)
2. [Quick Start & How to Run](#quick-start--how-to-run)
3. [Architecture & System Design](#architecture--system-design)
4. [Algorithm Deep-Dive](#algorithm-deep-dive)
   - [Dijkstra's Algorithm (Min-Heap)](#1-dijkstras-algorithm)
   - [Bellman-Ford Algorithm](#2-bellman-ford-algorithm)
   - [Breadth-First Search (BFS)](#3-breadth-first-search-bfs)
   - [A* Search Algorithm](#4-a-search-algorithm)
5. [Algorithms Comparative Analysis](#algorithms-comparative-analysis)
6. [Interactive Features & User Guide](#interactive-features--user-guide)
   - [Graph Creation & Manipulation](#graph-creation--manipulation)
   - [Batch Edge-List Input](#batch-edge-list-input)
   - [Visualization & Playback Controls](#visualization--playback-controls)
   - [Side Panel & Learning Aids](#side-panel--learning-aids)
   - [Multi-Algorithm Compare Mode](#multi-algorithm-compare-mode)
   - [Keyboard Shortcuts](#keyboard-shortcuts)
7. [Edge Cases & Error Handling](#edge-cases--error-handling)
8. [Academic Verification & Test Cases](#academic-verification--test-cases)
9. [Project File Structure](#project-file-structure)

---

## Project Overview & Problem Statement

### DAA Problem Statement
Shortest path computation is one of the foundational problems in graph theory and combinatorial optimization with applications spanning network routing protocols (OSPF, IS-IS), GPS navigation systems, robotics motion planning, social network analysis, and logistics.

While algorithm textbooks explain shortest-path algorithms through static matrices and traces, students and engineers frequently struggle to develop intuition regarding:
1. How priority queues and relaxation steps iteratively mutate distance estimates.
2. Why Dijkstra fails when encountering negative edge weights.
3. How Bellman-Ford iteratively relaxes all edges $|V|-1$ times and identifies negative cycles on the $|V|$-th pass.
4. How heuristic functions guide $A^*$ directly toward the target node compared to uniform search.

### Solution: PathFinder
**PathFinder** is an interactive, browser-based pedagogical simulation platform that provides:
- A responsive **SVG-based Graph Editor** enabling arbitrary directed or undirected graphs with custom positive or negative weights.
- Step-by-step visual execution of **Dijkstra**, **Bellman-Ford**, **BFS**, and **$A^*$**.
- Synchronized **Pseudocode Line Highlighting**, **Live Distance Tables**, and a **Plain-English Step Log**.
- An automated **Multi-Algorithm Compare Mode** that benchmarks path optimality, total operations, and visited node counts side-by-side.

---

## Quick Start & How to Run

### Zero Installation Required
This application has **no build step**, **no dependencies**, and requires **no package manager**.

#### Method 1: Direct File Launch
Simply locate `index.html` on your computer and double-click it, or open it in any modern browser:
- Google Chrome
- Mozilla Firefox
- Microsoft Edge
- Apple Safari

#### Method 2: Local Static Server (Optional)
If running inside a developer environment or preview server:
```bash
# Using Python 3
python -m http.server 8080

# Using Node.js (npx)
npx serve .
```
Navigate to `http://localhost:8080` in your web browser.

---

## Architecture & System Design

The application follows a clean **Model-View-Controller (MVC)** architectural pattern decoupled into discrete modules:

```
┌─────────────────────────────────────────────────────────────┐
│                     index.html (View)                       │
│  - Semantic HTML5 Layout & ARIA Accessibility Elements      │
│  - Inline SVG Canvas Viewport (<svg id="graph-svg">)        │
│  - Modal Dialogs, Control Panels, Toolbars, and Toasts      │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      app.js (Controller)                    │
│  - Application State & Lifecycle Management                 │
│  - Playback Engine (Step forward, backward, auto-play)      │
│  - Synchronous Panel Updater (Tables, logs, pseudocode)     │
│  - Event Delegation, Modals, Keyboard Shortcuts, Themes     │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
               ▼                               ▼
┌──────────────────────────────┐ ┌─────────────────────────────┐
│      graph.js (Model/View)   │ │  algorithms.js (Algorithms) │
│ - Graph Adjacency Model      │ │ - MinHeap Binary Priority Q │
│ - GraphRenderer (SVG Engine) │ │ - Dijkstra Generator        │
│ - GraphEditor (Pointer CRUD) │ │ - Bellman-Ford Generator    │
│ - JSON Import/Export & Undo  │ │ - BFS Generator             │
│ - Random Graph Layout Engine │ │ - A* Search Generator       │
└──────────────────────────────┘ └─────────────────────────────┘
```

---

## Algorithm Deep-Dive

### 1. Dijkstra's Algorithm
- **Category:** Greedy Single-Source Shortest Path
- **Data Structure:** Custom Binary Min-Heap Priority Queue
- **Mathematical Principle:** Triangular inequality relaxation:
  $$\text{if } d[u] + w(u, v) < d[v] \implies d[v] \leftarrow d[u] + w(u, v), \quad \pi[v] \leftarrow u$$

#### Pseudocode
```text
function Dijkstra(Graph, source, destination):
    Initialize dist[v] = ∞ for all v ∈ V, dist[source] = 0
    Initialize prev[v] = null for all v ∈ V
    Insert (0, source) into MinHeap Q

    while Q is not empty:
        u = Q.extractMin()
        if u == destination: break
        if dist[u] < priority: continue  // Stale entry check

        for each neighbor v of u with edge weight w(u, v):
            if dist[u] + w(u, v) < dist[v]:
                dist[v] = dist[u] + w(u, v)
                prev[v] = u
                Q.insert(dist[v], v)

    return dist, prev
```

- **Time Complexity:** $O((|V| + |E|) \log |V|)$ using our binary min-heap.
- **Space Complexity:** $O(|V|)$ to maintain distance arrays and priority queue.
- **Limitation:** Cannot handle edges with negative weights ($w(u, v) < 0$). A non-negative assumption guarantees that once a node is extracted from the min-heap, its shortest path is definitively optimal. Negative edges violate this greedy invariant.

---

### 2. Bellman-Ford Algorithm
- **Category:** Dynamic Programming Single-Source Shortest Path
- **Key Capability:** Handles arbitrary negative weights and detects reachable negative weight cycles.

#### Mathematical Principle
In a graph without negative cycles, any simple shortest path contains at most $|V| - 1$ edges. Thus, relaxing all edges $|V| - 1$ times guarantees that shortest paths up to $|V| - 1$ edges are discovered. If an edge can still be relaxed on the $|V|$-th iteration, a negative cycle exists.

#### Pseudocode
```text
function BellmanFord(Graph, source, destination):
    Initialize dist[v] = ∞ for all v ∈ V, dist[source] = 0
    Initialize prev[v] = null for all v ∈ V

    // Iterate |V| - 1 times
    for i = 1 to |V| - 1:
        updated = false
        for each edge (u, v) with weight w:
            if dist[u] != ∞ and dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
                prev[v] = u
                updated = true
        if not updated: break // Early termination optimization

    // Check for negative-weight cycles
    for each edge (u, v) with weight w:
        if dist[u] != ∞ and dist[u] + w < dist[v]:
            return NEGATIVE_CYCLE_DETECTED

    return dist, prev
```

- **Time Complexity:** $O(|V| \cdot |E|)$ worst-case; with early-stopping when no updates occur in a pass, best case is $O(|E|)$.
- **Space Complexity:** $O(|V|)$ for the distance and predecessor mappings.
- **Limitation:** Slower than Dijkstra for non-negative graphs. If a negative cycle is reachable, shortest paths are undefined ($-\infty$).

---

### 3. Breadth-First Search (BFS)
- **Category:** Unweighted Shortest Path (Queue-based Traversal)
- **Mathematical Principle:** In graphs where all edge weights are uniform ($w(u, v) = 1$), the order of node visits by BFS corresponds exactly to increasing path length in terms of edge count.

#### Pseudocode
```text
function BFS(Graph, source, destination):
    Initialize dist[v] = ∞ for all v ∈ V, dist[source] = 0
    Initialize prev[v] = null for all v ∈ V
    Initialize FIFO Queue Q
    Q.enqueue(source)

    while Q is not empty:
        u = Q.dequeue()
        if u == destination: break

        for each neighbor v of u:
            if dist[v] == ∞:  // Unvisited node
                dist[v] = dist[u] + 1
                prev[v] = u
                Q.enqueue(v)

    return dist, prev
```

- **Time Complexity:** $O(|V| + |E|)$
- **Space Complexity:** $O(|V|)$ for the FIFO queue and visited states.
- **Limitation:** Ignores edge weights (treats every edge as weight 1). In weighted graphs, BFS finds the minimum edge-count path, which is often not the minimum total weight path.

---

### 4. A* Search Algorithm
- **Category:** Informed / Heuristic Best-First Search
- **Evaluation Function:**
  $$f(n) = g(n) + h(n)$$
  - $g(n)$: Exact accumulated cost from source to node $n$.
  - $h(n)$: Estimated heuristic cost from node $n$ to destination.

#### Heuristic Choice in PathFinder
Because PathFinder nodes exist in a 2D Euclidean coordinate space $(x, y)$, the heuristic is computed using scaled Euclidean distance:
$$h(n) = \frac{\sqrt{(x_{\text{dest}} - x_n)^2 + (y_{\text{dest}} - y_n)^2}}{\text{scale\_factor}}$$

#### Admissibility & Consistency
- **Admissible:** $h(n) \le h^*(n)$ (never overestimates the true cost to reach destination).
- **Consistent (Monotone):** $h(u) \le w(u, v) + h(v)$ (satisfies the triangle inequality).  
When $h(n)$ is consistent and admissible, $A^*$ is guaranteed to return the optimal shortest path while visiting fewer nodes than Dijkstra.

#### Pseudocode
```text
function AStar(Graph, source, destination):
    Initialize g[v] = ∞, f[v] = ∞ for all v ∈ V
    g[source] = 0
    f[source] = h(source, destination)
    Insert (f[source], source) into MinHeap OpenSet

    while OpenSet is not empty:
        u = OpenSet.extractMin()
        if u == destination: return path

        for each neighbor v of u with weight w(u, v):
            tentative_g = g[u] + w(u, v)
            if tentative_g < g[v]:
                g[v] = tentative_g
                f[v] = tentative_g + h(v, destination)
                prev[v] = u
                OpenSet.insert(f[v], v)

    return dist, prev
```

- **Time Complexity:** $O((|V| + |E|) \log |V|)$ worst-case; significantly faster average-case exploration toward the goal.
- **Space Complexity:** $O(|V|)$

---

## Algorithms Comparative Analysis

| Feature | Dijkstra | Bellman-Ford | Breadth-First Search (BFS) | A* Search |
| :--- | :--- | :--- | :--- | :--- |
| **Strategy** | Greedy Best-First | Dynamic Programming | FIFO Layer-by-Layer | Informed Best-First |
| **Time Complexity** | $O((V + E) \log V)$ | $O(V \cdot E)$ | $O(V + E)$ | $O((V + E) \log V)$ |
| **Space Complexity** | $O(V)$ | $O(V)$ | $O(V)$ | $O(V)$ |
| **Weights Handled** | Non-negative ($\ge 0$) | Arbitrary (Positive & Negative) | Unweighted (all $w = 1$) | Non-negative ($\ge 0$) |
| **Negative Cycle Detection** | ❌ Fails / Loops | ✅ Detected & Reported | ❌ N/A | ❌ Fails |
| **Optimal Path Guarantee** | ✅ Yes (non-negative) | ✅ Yes (no negative cycles) | ✅ Yes (for unweighted) | ✅ Yes (admissible $h$) |
| **Heuristic Guided** | ❌ No ($h(n) = 0$) | ❌ No | ❌ No | ✅ Yes ($h(n) \ge 0$) |
| **Best Application** | General routing, network packet routing | Finance arbitrage, graphs with negative weights | Shortest hops, social friend degrees | Video game AI, robotics, GPS navigation |

---

## Interactive Features & User Guide

### Graph Creation & Manipulation
1. **Add Node (`⊕ Node`):** Click anywhere on the SVG grid canvas. Nodes are automatically named with alphabetic identifiers (`A`, `B`, `C` ... `Z`, `AA`, `AB`...).
2. **Add Edge (`🔗 Edge`):** Click and drag a connection line from a source node to a target node. An inline modal prompts for the desired edge weight.
3. **Move Node (`✋ Move`):** Drag any node to reposition it. All connected edges, labels, and midpoint weight pills update smoothly in real time.
4. **Delete Element (`🗑 Delete`):** Click on any node or edge to remove it from the graph.
5. **Directed / Undirected Toggle:** Switch between directed graphs (with SVG markers and arrowheads) and undirected graphs with one click.
6. **Edit Edge Weights:** Double-click on any edge's midpoint weight pill to open a prompt to change its weight.
7. **Undo (`↩ Undo`) & Clear (`✕ Clear`):** Comprehensive undo history using the Command Pattern allows undoing additions, moves, and deletions.

---

### Batch Edge-List Input
Need to quickly test a graph from an exam or textbook? Open the **Edge List** panel in the sidebar, paste space-separated tuples, and click **Apply**:
```text
A B 4
A C 2
B D 5
C B 1
C D 8
D E 3
```
- Supports 2-column format (`A B`, default weight 1) or 3-column format (`A B 5`).
- Validates syntax and line structure with explicit line-number error reporting.

---

### Visualization & Playback Controls
- **▶ Run Algorithm:** Prepares the step sequence snapshots and begins execution.
- **⏸ / ▶ Play & Pause (Spacebar):** Smooth animated step progression.
- **⏩ Step Forward (`→`):** Advance exactly one algorithm step.
- **⏪ Step Back (`←`):** Revert to the previous step state.
- **⏮ Reset:** Reset visual states to the initial layout while preserving the graph structure.
- **Speed Slider:** Control playback rate from **0.25x** up to **4x** speed.

#### Color Legend & Visual States
| Element | Visual Appearance | Meaning |
| :--- | :--- | :--- |
| **Source Node** | Emerald Green Glow with badge `S` | Starting vertex |
| **Destination Node**| Crimson Red Glow with badge `D` | Goal vertex |
| **Current Node** | Vivid Amber / Yellow Glow | Vertex currently being popped and evaluated |
| **Visited Node** | Neon Violet / Purple | Vertex settled / closed |
| **Relaxing Edge** | Pulsing Amber with animated glow | Edge currently undergoing relaxation test |
| **Final Path** | Bright Electric Cyan with thick stroke & shadow | Optimal shortest path from Source to Destination |

---

### Side Panel & Learning Aids
1. **Live Distance Table:** Displays all vertices with current accumulated distance $d[v]$ and predecessor $\pi[v]$. Values update in real time with row highlights.
2. **Interactive Pseudocode:** Displays the algorithm pseudocode, highlighting the exact line being executed at each step.
3. **Plain-English Step Log:** Auto-scrolling transcript of operations (e.g., *"Relaxed edge A → C: updated dist[C] from ∞ to 2 via A"*).
4. **Complexity Card:** Summarizes theoretical time complexity, space complexity, recommended applications, and theoretical limitations.
5. **Results Summary:** Displays the final path sequence, total path weight, step count, and total nodes explored.

---

### Multi-Algorithm Compare Mode
Click the **Compare** button in the header to run **Dijkstra**, **Bellman-Ford**, and **BFS** on your exact graph simultaneously. A benchmark modal presents:
- Computed path for each algorithm
- Total path cost
- Total algorithm steps required
- Number of nodes visited
- Visual badges highlighting the most optimal cost and lowest step count

---

### Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>Space</kbd> | Toggle Play / Pause |
| <kbd>→</kbd> (Right Arrow) | Step forward one step |
| <kbd>←</kbd> (Left Arrow) | Step backward one step |
| <kbd>Escape</kbd> | Cancel edge drawing / dismiss modal |
| <kbd>Ctrl</kbd> + <kbd>Z</kbd> | Undo last graph mutation |

---

## Edge Cases & Error Handling

PathFinder has been hardened against common edge cases:

1. **Disconnected Graphs:**  
   If no valid path connects Source and Destination, the system alerts the user with a notification toast and sets the results card to `"No path found"` with total cost $\infty$.
2. **Source Equals Destination:**  
   Handled gracefully with path `[S]`, cost $0$, and $0$ edge relaxations.
3. **Single Node Graphs:**  
   PathFinder allows single-node configurations without crashing.
4. **Negative Edges in Dijkstra:**  
   Dijkstra checks for negative edge weights before running. If detected, a warning toast alerts the user that greedy Dijkstra may yield non-optimal results and suggests switching to Bellman-Ford.
5. **Negative Weight Cycles in Bellman-Ford:**  
   Bellman-Ford performs the $|V|$-th relaxation pass. If any edge can still be relaxed, it halts, triggers an error banner: `"Negative cycle detected!"`, and identifies that shortest paths are ill-defined.
6. **Dense & Large Graphs:**  
   Graph rendering uses direct DOM element attributes and hardware-accelerated SVG transforms, maintaining 60 FPS performance on 20+ node graphs.

---

## Academic Verification & Test Cases

### Test Case 1: Standard Textbook Weighted Graph (Dijkstra)
- **Nodes:** A, B, C, D, E
- **Edges:**
  - `A → B (weight 4)`
  - `A → C (weight 2)`
  - `C → B (weight 1)`
  - `B → D (weight 5)`
  - `C → D (weight 8)`
  - `D → E (weight 3)`
- **Source:** `A`, **Destination:** `E`
- **Expected Step Sequence:**
  1. $d[A] = 0$. Neighbors $B$ (cost 4) and $C$ (cost 2) relaxed.
  2. Extract min node $C$ ($d=2$). Relax edge $C \to B$: $d[B] = \min(4, 2 + 1) = 3$. Relax edge $C \to D$: $d[D] = \min(\infty, 2 + 8) = 10$.
  3. Extract min node $B$ ($d=3$). Relax edge $B \to D$: $d[D] = \min(10, 3 + 5) = 8$.
  4. Extract min node $D$ ($d=8$). Relax edge $D \to E$: $d[E] = \min(\infty, 8 + 3) = 11$.
  5. Extract min node $E$ ($d=11$). Destination reached!
- **Verification Output:**
  - Path: `A → C → B → D → E`
  - Total Cost: `11`

---

### Test Case 2: Negative Edge Weight Graph (Bellman-Ford)
- **Nodes:** A, B, C, D
- **Edges:**
  - `A → B (weight 4)`
  - `A → C (weight 5)`
  - `B → C (weight -3)`
  - `C → D (weight 3)`
- **Source:** `A`, **Destination:** `D`
- **Behavior:**
  - Dijkstra would greedily settle $B$ at $4$ and $C$ at $5$, failing to recognize that $A \to B \to C$ gives $4 + (-3) = 1$.
  - Bellman-Ford updates $d[C] = 1$ via $B$, finding the true optimal path.
- **Verification Output:**
  - Path: `A → B → C → D`
  - Total Cost: `4`

---

### Test Case 3: Negative Weight Cycle Detection
- **Nodes:** A, B, C, D
- **Edges:**
  - `A → B (weight 1)`
  - `B → C (weight 2)`
  - `C → D (weight -6)`
  - `D → B (weight 1)`
- **Cycle Cost:** $B \to C \to D \to B = 2 + (-6) + 1 = -3 < 0$.
- **Verification Output:**
  - Bellman-Ford reports: `"Negative cycle detected! Shortest path is undefined."`

---

### Test Case 4: Weighted vs Unweighted (Dijkstra vs BFS)
- **Nodes:** A, B, C
- **Edges:**
  - `A → B (weight 10)`
  - `A → C (weight 2)`
  - `C → B (weight 3)`
- **Source:** `A`, **Destination:** `B`
- **Comparison Output:**
  - **BFS Result:** Direct edge `A → B` (1 hop, total weight 10).
  - **Dijkstra Result:** Multi-hop path `A → C → B` (2 hops, total weight $2 + 3 = 5$).
  - Demonstrates why BFS is suitable only for unweighted graphs.

---

## Project File Structure

```
c:/Users/HP/OneDrive/Documents/Desktop/SHOREST PATH/
├── index.html        # Semantic HTML5 layout, toolbar, SVG viewport, modals, overlays
├── style.css         # Complete CSS design system, dark/light themes, animations, layouts
├── graph.js          # Graph data structures, SVG renderer, pointer interaction, undo stack
├── algorithms.js     # MinHeap class, Dijkstra, Bellman-Ford, BFS, A*, pseudocode definitions
├── app.js            # Controller wiring UI elements, playback engine, compare mode, events
└── README.md         # Comprehensive project documentation and academic report
```

---

## Authors & Acknowledgments
- Developed for the **Design and Analysis of Algorithms (DAA)** curriculum.
- Built using standards-compliant Web APIs and mathematical formulations of graph theory algorithms.

# Research notes (2026-10-26)

Two research passes ran alongside the build: one on graph-visualization
libraries for the evidence panel, one on chat-composer and Angular stack
patterns. Both are condensed here; versions came from search snippets and
should be re-checked with `npm view <pkg> version license` before pinning.

## Graph visualization for a 20–80 node evidence subgraph

| Library | Version | License | Renderer | Angular fit | Verdict |
|---|---|---|---|---|---|
| `d3-force` + `d3-zoom` + `d3-drag` | 3.0.0 | ISC | SVG/canvas, your code | Excellent, plain DOM | Full control of rings, dimming, edge labels. **Used for the default Force view and Replay.** |
| `d3-hierarchy` | 3.x | ISC | SVG | Excellent | Radial/cluster trees. **Used for the Radial view.** |
| `3d-force-graph` (+ `three`) | 1.80.1 (three ≥0.179) | MIT | WebGL | Excellent, `ForceGraph3D()(el)` | Best wow factor; per-node three objects, camera fly-to. Lazy-load. **Used for the 3D view.** |
| `cytoscape` | 3.34.x | MIT | Canvas | Good, vanilla | Strongest built-in selectors/layouts (breadthfirst, concentric, cose). Fastest polished 2D if not hand-rolling. |
| `sigma` + `graphology` | 4.0.x | MIT | WebGL | Good, vanilla | Built for thousands of nodes; custom rings need a node program. Overkill here. |
| `@antv/g6` v5 | 5.1.1 | MIT | Canvas/SVG/WebGL | Good, vanilla | Rich plugins (tooltip, minimap, legend, combos). Snyk flagged 5.2.1 and 5.3.1; pin 5.1.1 if used. |
| `@neo4j-nvl/base` | 1.x / 2.0 | custom | WebGL | Vanilla `new NVL(container, nodes, rels)` | Native Neo4j look; read LICENSE.txt first. |
| `vis-network` | 10.1.0 | Apache-2.0/MIT | Canvas | OK | Dated look, weak custom rings. Skip. |
| `@swimlane/ngx-graph` | 21.0.0-alpha | MIT | SVG | Angular-native, alpha | DAG layouts only; slow cadence. Fallback only. |
| `echarts` graph series | 5/6 | Apache-2.0 | Canvas | OK | Decent force/circular; limited per-node effects. |
| `@cosmos.gl/graph` | 3.1.0 | MIT | WebGL GPU | Vanilla | 100k+ nodes; minimal labels. Skip. |
| `reagraph` | – | MIT | React | React only | Skip. |

Design patterns from open-source Graph-RAG UIs (verified):
- [kinfi4/graph-rag-ui](https://github.com/kinfi4/graph-rag-ui): dashed ring = seed node, glow = evidence, node size = activation, a toggle to compare retrieval strategies.
- [niravpatidar37/Graph-RAG PR #2](https://github.com/niravpatidar37/Graph-RAG/pull/2): source chips and graph-fact chips that highlight the edge; click a node to trace 2 hops.
- [SanoberRehman/hierarchical-graphrag](https://github.com/SanoberRehman/hierarchical-graphrag): Graph Inspector plus the list of triples used.
- [Chuan Zhang's Neo4j demo](https://chuan-zhang.medium.com/knowledge-graphs-in-rag-a-realistic-demo-with-neo4j-d07149a1e418): Answer / Generated Cypher / Agent Trace / Retrieved Rows tabs, Graph RAG vs Vector RAG toggle.

UI ideas by value (✔ = implemented in Lattice):
1. ✔ Three node states: seed = dashed ring, used-in-answer = solid ring with halo, retrieved-but-unused = plain.
2. ✔ Focus mode dimming everything outside the used set.
3. ✔ Retrieval trace replay with a step scrubber.
4. ✔ Labels always on; edge labels and property tooltip on hover.
5. ✔ Legend by label with counts.
6. ✔ Triples list (Facts tab) with used facts first; click-to-expand neighbours needs a backend call (open).
7. Legend as a filter, minimap: skipped at this graph size.

Angular notes: no dedicated 2025–2026 Angular graph wrapper is worth using; drive the vanilla DOM libraries directly. Under zoneless, let d3 write straight to SVG in its tick handler and keep Angular for data and highlight signals. Create instances in `afterNextRender`, dispose in `DestroyRef.onDestroy`, watch size with `ResizeObserver`.

## Chat composer and Angular stack

Composer patterns (sources: aiuxplayground composer teardown, AYDesign prompt-input patterns 2026):
- The market splits: ChatGPT/Gemini keep the bar calm behind one "+" menu; Claude/Perplexity put controls on the bar. **When the mode is the product, keep it visible** — retrieval mode is the product here, so Lattice shows source, mode, context and LLM as bar pills.
- Send button states: disabled when empty, accent when ready, busy indicator while streaming. Enter sends, Shift+Enter newlines, Esc closes popovers. ✔
- Empty state: greeting plus suggestion chips. ✔ (Lattice sends on click for demo pace.)

Answer and evidence rendering (sources: AYDesign citation patterns 2026, Perplexity citations case, arXiv 2601.14611):
- Inline numbered chips after each claim with a hover card (title, scope path, snippet); click scrolls to and highlights the source. ✔
- Order: answer → stats → collapsible Evidence with count badge → related questions. ✔
- Show the traversal breadcrumb on each source (World > North America > USA). ✔
- Confidence as dot plus word, never colour alone. ✔
- Steps timeline with per-step timing. ✔ (Trace tab)
- Hover actions (copy, regenerate, thumbs) fade in. ✔
- LLM off → ranked facts list instead of prose. ✔

Stack notes:
- Angular 22 shipped 2026-06-03 (OnPush default, Signal Forms and resource API stable). Lattice is on **Angular 21.2 LTS** to match the team's other Angular repos; nothing here blocks a v22 upgrade.
- `@angular/animations` is deprecated since 20.2; Lattice uses CSS keyframes only.
- `lucide-angular` 1.0.0 peers up to Angular 21; `@lucide/angular` is the successor when moving to 22.
- Spartan UI (brain + helm on Tailwind 4) is the recommended kit if a component library is wanted; Lattice hand-rolls tokens with CDK overlay instead, same as Meridian and Stratum.
- Markdown: `marked` + `DOMPurify` with `[n]` turned into citation elements. ✔

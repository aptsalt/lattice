# Lattice — Graph-RAG chat UI (Angular 21) — design spec

Date: 2026-10-26 · Status: built against this spec (autonomous run; see "Assumptions")

## 1. Intent

A public demo of a **hybrid Graph-RAG chatbot** over a Neo4j knowledge graph of
HR **leave policy** (World → North America → USA / Mexico / Canada). The real
system is Angular + FastAPI + Neo4j. This repo delivers the **Angular UI** with
a faithful in-browser mock of the FastAPI contract, so the demo runs on GitHub
Pages with no backend, and the README explains the full hybrid architecture
(lexical + vector + graph traversal, RRF fusion, Cypher, LLM grounding).

Audience: a demo to stakeholders and engineers who know the Streamlit version.
Success = the same functionality as Streamlit, in a world-class UI, with the
evidence subgraph shown in several switchable interactive variants.

## 2. What the Streamlit version does (parity list)

From the screenshots of the Streamlit "Knowledge Graph Chatbot":

| Streamlit | Lattice |
|---|---|
| Sidebar: Data source (Live Neo4j / Offline resolved.json) | Composer **source pill** (Live · Offline) |
| Sidebar: Retrieval mode dropdown (lexical, …) | Composer **mode pill** (Lexical · Vector · Hybrid · Graph) |
| Sidebar: Use conversation context toggle | Composer **context chip** (toggle) |
| Sidebar: Generate LLM answer toggle | Composer **LLM chip** (toggle; off = extractive answer) |
| Sidebar: Clear conversation | Chat header "⋯" menu → Clear; sidebar conversation delete |
| Suggested questions on empty state | Suggestion chips above the composer (empty state hero) |
| Answer with `confidence: high` badge | Confidence badge (high / medium / low) on the answer |
| Stats line "42 facts · 6 passages · 10 matched entities · lexical · live" | Same stats line under the answer |
| Evidence expander → Subgraph / Facts / Sources tabs | Evidence panel → **Graph** (4 variants) / Facts / Sources / **Cypher** / **Trace** |
| Subgraph: force graph, yellow ring = used in answer | Default Force variant keeps the ring-highlight convention |
| Facts table: subject · relation · object · confidence | Same table, sortable, filter to "used" |
| Sources: `[n] §x.y Title · breadcrumb` + passage text | Same, with inline `[n]` citations in the answer that scroll/highlight the source |

User rule: **left panel = conversations only**. Every toggle and choice lives in
or around the composer.

## 3. Visual direction (SenseAI shot + dashboard)

- Dark graphite canvas (#0f1117 → #1a1d26 panels), lavender accent for greeting
  and highlights, one accent only (violet-blue), status colors reserved.
- Monospace-flavoured type for UI chrome (JetBrains Mono / Geist Mono) with
  Inter for answer prose. SenseAI uses mono everywhere; we use mono for chrome
  and sans for reading text (clarity first).
- Empty state: centred logo tile, "Hi, {name}", "Can I help you with
  anything?", three-line sub-copy, suggestion chips, floating composer.
- Composer: rounded 16px container, textarea on top, icon row below:
  left = attach-like icons (source pill, mode pill, context chip, LLM chip),
  right = send pill. Popovers open from pills (CDK overlay).
- Messages: avatar + name + time, bubble for the user, open text for the
  assistant; hover action rail (copy, regenerate, thumbs).
- Light theme supported through tokens; dark is default (SenseAI is dark).
- Graph canvas look borrowed from the Claude dashboard ecosystem view: soft
  radial nebula background, glow halos on active nodes, legend card bottom-left.

## 4. Architecture (frontend)

```
src/app/
  core/
    models.ts          API contract types (ChatRequest, ChatResponse, Subgraph, Fact, Passage, Trace)
    graph-data.ts      the leave-policy knowledge graph (nodes, edges, passages)
    rag-engine.ts      in-browser mock of FastAPI /chat: entity match → expand → facts → passages → answer
    chat-store.ts      signals: conversations, messages, settings, streaming state (localStorage persisted)
    theme.ts           dark/light signal
  features/
    shell/             app shell: sidebar (conversations) + outlet
    sidebar/           conversation list, search, new chat, rename/delete
    chat/              chat view: hero empty state, message list, composer
    composer/          composer with pills, popovers, chips, send
    message/           assistant message: streamed markdown, citations, stats, confidence
    evidence/          evidence panel: tab strip + variants
      graph-force/     d3-force SVG (default)
      graph-radial/    d3-hierarchy radial taxonomy tree
      graph-orbit/     canvas 3D projection (dashboard-inspired)
      graph-trace/     stepwise retrieval replay on the force layout
      facts-table/
      sources-list/
      cypher-view/
      trace-steps/
    architecture/      /architecture route: hybrid Graph-RAG explainer (diagram + API contract)
```

- Angular 21: standalone, zoneless, signals, `@defer` for graph variants,
  OnPush, new control flow, `httpResource`-shaped engine seam so a real
  FastAPI base URL can be swapped in through `environment.apiBase`.
- Dependencies: `@angular/cdk` (overlay, a11y), `d3-force`/`d3-selection`/
  `d3-zoom`/`d3-drag`/`d3-hierarchy`, `marked` + `dompurify`, `lucide-angular`.
- No Angular Material, no Tailwind: hand-rolled tokens in `styles.scss` (same
  house style as Meridian and Stratum).

## 5. Mock engine behaviour (mirrors FastAPI)

`POST /chat` request: `{ question, conversationId, settings: { source, mode, useContext, generateAnswer } }`.

Pipeline (each step emitted to the Trace):
1. **Resolve** — if `useContext`, rewrite follow-ups ("and in Canada?") using the last turn's country/leave-type.
2. **Lexical** — token match against node names/aliases (BM25-like score).
3. **Vector** — synonym/semantic match table (mock embeddings) when mode ∈ {vector, hybrid}.
4. **Fuse** — RRF of lexical + vector ranks (hybrid), or either alone.
5. **Expand** — Cypher-shaped traversal 1–2 hops from seeds (graph mode = 3 hops with path scoring).
6. **Rank facts** — triples sorted by confidence × seed proximity; mark `usedInAnswer`.
7. **Passages** — sections cited by used facts.
8. **Answer** — if `generateAnswer`: authored grounded prose with `[n]` citations, streamed token by token; else extractive bullet list of facts.
9. **Confidence** — high (≥2 seeds and authored answer), medium (1 seed), low (no seed → "I can't find that in the graph").

Source `offline` adds a "resolved.json" badge and zero latency; `live` simulates 400–900 ms Neo4j latency with a step timeline.

## 6. Evidence graph variants

| Variant | Library | Why it is in the demo |
|---|---|---|
| **Force** (default) | d3-force + SVG | Parity with Streamlit, best labels, ring highlight, focus-dim, drag/pin, zoom, hover tooltip, edge labels on hover, legend by label |
| **Radial** | d3-hierarchy | The domain is a taxonomy (World → NA → country → policy → leave type → rule); a radial tree reads it instantly |
| **Orbit** | canvas 2D, 3D projection | "Wow" view inspired by the Claude dashboard ecosystem viz: depth, slow rotation, glow halos, zero dependencies |
| **Trace** | force layout + timeline | Replays retrieval: seeds light up, hops expand, answer nodes ring — explains *why* the answer is grounded |

All variants share one `SubgraphViewModel` (nodes with label, group color, used flag, seed flag; edges with relation) and one legend/tooltip component.

## 7. Testing

- Vitest unit tests for `rag-engine` (mode differences, context resolution, confidence, citation numbering) and `chat-store` (persistence, clear).
- Playwright smoke script (e2e/) that loads the app, sends a suggested question, opens Evidence, switches all four graph variants, asserts 0 console errors.

## 8. Assumptions made (autonomous run)

1. Repo name `lattice`, public, under `aptsalt`. Product name "Lattice".
2. Leave-policy content is realistic but illustrative (FMLA, LFT 2023 reform, Canada Labour Code / EI figures); not legal advice, stated in the README.
3. Backend not built; API contract + Cypher samples documented so FastAPI can be dropped in.
4. Dark theme default, light available.

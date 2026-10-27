import { Injectable } from '@angular/core';
import {
  ALL_NODES,
  EDGES,
  NODE_BY_ID,
  PASSAGES,
  PASSAGE_BY_ID,
} from './graph-data';
import {
  ChatRequest,
  ChatResponse,
  Citation,
  Confidence,
  Facet,
  Fact,
  GraphEdge,
  GraphNode,
  Passage,
  RetrievalMode,
  Subgraph,
  SubgraphEdge,
  SubgraphNode,
  TraceStep,
} from './models';

/**
 * In-browser stand-in for the FastAPI `/chat` endpoint.
 *
 * It runs the same hybrid pipeline the Python service runs against Neo4j:
 *   resolve → lexical → vector → fuse (RRF) → expand (Cypher) → rank → passages → answer
 * and returns the identical `ChatResponse` shape, so the UI is backend-agnostic.
 */

type CountryCode = 'USA' | 'MEX' | 'CAN';

interface Seed {
  id: string;
  score: number;
  via: ('lexical' | 'vector')[];
}

interface Intent {
  countries: CountryCode[];
  leaveTypes: string[];
  facets: Facet[];
  wantsComparison: boolean;
  wantsRegulations: boolean;
}

const COUNTRY_IDS: Record<CountryCode, string> = { USA: 'usa', MEX: 'mex', CAN: 'can' };
const COUNTRY_NAMES: Record<CountryCode, string> = { USA: 'United States', MEX: 'Mexico', CAN: 'Canada' };

/** Mock "embedding" neighbourhood: a phrase → node ids it is semantically close to. */
const SEMANTIC: [RegExp, string[]][] = [
  [/\b(days? off|time away|break|rest)\b/, ['lt-annual']],
  [/\b(unwell|doctor|hospital|surgery|injur)/, ['lt-sick', 'r-g-sick-cert']],
  [/\b(having a (baby|child)|expecting|pregnan|bonding|new ?born|adopt)/, ['lt-parental']],
  [/\b(lose|lost|expire|forfeit|use it or lose it|roll)/, ['r-g-carry']],
  [/\b(how (far|early)|in advance|ahead of time|book)/, ['r-g-notice']],
  [/\b(permission|sign[- ]?off|authori[sz]|who (do i|should i) ask)/, ['r-g-approval']],
  [/\b(law|legal|statut|legislation|act|code|regulat)/, ['reg-fmla', 'reg-lft', 'reg-clc']],
  [/\b(money|paid|pay|salary|%|percent)/, ['r-mx-prima', 'r-ca-parental']],
  [/\b(first year|new (hire|joiner|employee|starter)|just (joined|started))/, ['r-mx-vac', 'r-us-pto', 'r-ca-vac']],
  [/\b(grieving|funeral|passed away|died)/, ['lt-bereavement']],
];

const FACET_PATTERNS: [RegExp, Facet][] = [
  [/\b(carry|carryover|roll ?over|unused|expire|lapse|forfeit|lose)/, 'carryover'],
  [/\b(notice|advance|ahead|book|request)/, 'notice'],
  [/\b(approv|sign[- ]?off|authori[sz]|who (approves|signs|decides)|permission)/, 'approval'],
  [/\b(eligib|qualif|certificate|doctor|proof|tenure|hours)/, 'eligibility'],
  [/\b(paid|pay|salary|premium|prima|top[- ]?up|%|percent|bonus)/, 'pay'],
  [/\b(law|legal|statut|regulat|legislation|act\b|code\b|govern)/, 'regulation'],
  [/\b(how (many|much|long)|days|weeks|entitle|get\b|receive|allowance)/, 'entitlement'],
];

const STOP = new Set(['the', 'a', 'an', 'of', 'in', 'for', 'to', 'is', 'are', 'do', 'does', 'i', 'my', 'we', 'and', 'or', 'what', 'how', 'who', 'which', 'when', 'can', 'get', 'have', 'has', 'on', 'at', 'by', 'with', 'about', 'me', 'it', 'that', 'this', 'be', 'if', 'than', 'much', 'many', 'long', 'there', 'their', 'our', 'your', 'as', 'from', 'vs', 'versus', 'between', 'across', 'compare', 'need', 'give', 'leave']);

const tokenize = (s: string): string[] =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9%áéíóúñ\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !STOP.has(t));

const uid = (): string => Math.random().toString(36).slice(2, 10);

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

@Injectable({ providedIn: 'root' })
export class RagEngine {
  private readonly adjacency = buildAdjacency(EDGES);

  /** Mirrors `POST /chat`. Resolves after the simulated Neo4j round-trip. */
  async chat(req: ChatRequest): Promise<ChatResponse> {
    const t0 = performance.now();
    const trace: TraceStep[] = [];
    const { settings } = req;
    const live = settings.source === 'live';

    // 1. resolve follow-ups against the conversation
    const resolved = settings.useContext ? resolveWithContext(req.question, req.history) : req.question;
    const intent = detectIntent(resolved);
    trace.push({
      id: 'resolve',
      title: settings.useContext ? 'Resolve conversation context' : 'Context off — question used as typed',
      detail:
        resolved === req.question
          ? 'No pronouns or ellipsis to resolve.'
          : `Rewrote "${req.question}" → "${resolved}" using the previous turn.`,
      ms: 2,
      nodeIds: [],
    });

    // 2. lexical
    const lexical = settings.mode === 'vector' ? [] : lexicalMatch(resolved);
    if (settings.mode !== 'vector') {
      await sleep(live ? 90 : 5);
      trace.push({
        id: 'lexical',
        title: 'Lexical match (full-text index)',
        detail: `${lexical.length} entities matched on names and aliases.`,
        ms: live ? 38 : 3,
        nodeIds: lexical.map((s) => s.id),
        cypher: `CALL db.index.fulltext.queryNodes('entity_names', $q)\nYIELD node, score\nRETURN node.id AS id, labels(node)[0] AS label, score\nORDER BY score DESC LIMIT 25`,
      });
    }

    // 3. vector
    const vector = settings.mode === 'lexical' ? [] : vectorMatch(resolved);
    if (settings.mode !== 'lexical') {
      await sleep(live ? 160 : 5);
      trace.push({
        id: 'vector',
        title: 'Vector match (embedding index)',
        detail: `${vector.length} entities within cosine distance of the question embedding.`,
        ms: live ? 112 : 4,
        nodeIds: vector.map((s) => s.id),
        cypher: `CALL db.index.vector.queryNodes('entity_embeddings', 12, $embedding)\nYIELD node, score\nRETURN node.id AS id, score`,
      });
    }

    // 4. fuse
    const seeds = fuse(lexical, vector, settings.mode);
    trace.push({
      id: 'fuse',
      title: settings.mode === 'hybrid' ? 'Reciprocal-rank fusion' : settings.mode === 'graph' ? 'Seed selection for traversal' : 'Rank seeds',
      detail: `${seeds.length} seed entities after ${settings.mode === 'hybrid' ? 'RRF (k = 60)' : 'ranking'}.`,
      ms: 1,
      nodeIds: seeds.map((s) => s.id),
    });

    // 5. expand
    const hops = settings.mode === 'graph' ? 3 : 2;
    const { nodes, edges } = this.expand(seeds, intent, hops);
    await sleep(live ? 220 : 8);
    const expandCypher = buildCypher(seeds, hops, intent);
    trace.push({
      id: 'expand',
      title: `Expand subgraph (${hops} hops)`,
      detail: `${nodes.length} nodes and ${edges.length} relationships pulled around the seeds${intent.countries.length ? `, scoped to ${intent.countries.map((c) => COUNTRY_NAMES[c]).join(', ')}` : ''}.`,
      ms: live ? 184 : 6,
      nodeIds: nodes.map((x) => x.id),
      cypher: expandCypher,
    });

    // 6. rank facts and choose the rules the answer will rely on
    const usedRules = pickRules(nodes, intent, seeds);
    const usedIds = new Set<string>(usedRules.map((r) => r.id));
    for (const r of usedRules) {
      // the leave type / country / regulation each rule hangs off is "used" too
      for (const e of this.adjacency.get(r.id) ?? []) {
        const other = e.source === r.id ? e.target : e.source;
        const on = NODE_BY_ID.get(other);
        if (!on) continue;
        if (on.label === 'LeaveType' || on.label === 'Regulation' || (on.label === 'Approver' && intent.facets.includes('approval'))) usedIds.add(other);
      }
    }
    for (const c of intent.countries) usedIds.add(COUNTRY_IDS[c]);

    const facts = buildFacts(edges, usedIds);
    trace.push({
      id: 'rank',
      title: 'Rank facts by confidence × seed proximity',
      detail: `${facts.length} facts; ${facts.filter((f) => f.usedInAnswer).length} selected as grounding.`,
      ms: 3,
      nodeIds: [...usedIds],
    });

    // 7. passages
    const passages = collectPassages(usedRules, intent);
    trace.push({
      id: 'passages',
      title: 'Fetch cited passages',
      detail: `${passages.length} policy sections cited by the selected rules.`,
      ms: live ? 41 : 2,
      nodeIds: passages.map((x) => x.id),
      cypher: `MATCH (r:Rule)-[:CITED_IN]->(s:Section)\nWHERE r.id IN $ruleIds\nRETURN s.id, s.ref, s.title, s.breadcrumb, s.text`,
    });

    // 8. answer
    const citations: Citation[] = passages.map((x, i) => ({ n: i + 1, passageId: x.id }));
    const citeOf = (sectionId?: string): string => {
      const c = citations.find((x) => x.passageId === sectionId);
      return c ? ` [${c.n}]` : '';
    };
    const confidence = scoreConfidence(seeds, usedRules);
    const answerMarkdown = settings.generateAnswer
      ? composeAnswer(resolved, intent, usedRules, citeOf, confidence)
      : extractiveAnswer(usedRules, citeOf, confidence);
    trace.push({
      id: 'answer',
      title: settings.generateAnswer ? 'Generate grounded answer (LLM)' : 'Extractive answer (LLM off)',
      detail: settings.generateAnswer
        ? `Prompted with ${facts.filter((f) => f.usedInAnswer).length} facts and ${passages.length} passages; citations enforced by section id.`
        : 'Returned the grounding facts verbatim without an LLM pass.',
      ms: settings.generateAnswer ? (live ? 640 : 120) : 1,
      nodeIds: [...usedIds],
    });

    const subgraph: Subgraph = {
      nodes: nodes.map<SubgraphNode>((x) => ({
        ...x,
        seed: seeds.some((s) => s.id === x.id),
        used: usedIds.has(x.id),
        hop: hopOf(x.id, seeds, this.adjacency),
      })),
      edges: edges.map<SubgraphEdge>((x) => ({ ...x, used: usedIds.has(x.source) && usedIds.has(x.target) })),
    };

    const latencyMs = Math.round(performance.now() - t0) + trace.reduce((a, s) => a + s.ms, 0);
    return {
      id: uid(),
      resolvedQuestion: resolved,
      answerMarkdown,
      confidence,
      stats: {
        facts: facts.length,
        passages: passages.length,
        matchedEntities: seeds.length,
        mode: settings.mode,
        source: settings.source,
        latencyMs,
      },
      facts,
      passages,
      citations,
      subgraph,
      trace,
      cypher: expandCypher,
    };
  }

  /** Breadth-first expansion from seeds, filtered by country scope when the question names countries. */
  private expand(seeds: Seed[], intent: Intent, hops: number): { nodes: GraphNode[]; edges: GraphEdge[] } {
    const allowed = (node: GraphNode): boolean => {
      if (!intent.countries.length) return true;
      if (!node.country || node.country === 'GLOBAL') return true;
      return intent.countries.includes(node.country);
    };
    const keep = new Map<string, GraphNode>();
    const frontier: string[] = [];
    for (const s of seeds) {
      const node = NODE_BY_ID.get(s.id);
      if (node && allowed(node)) {
        keep.set(s.id, node);
        frontier.push(s.id);
      }
    }
    let current = frontier;
    for (let h = 0; h < hops && current.length; h++) {
      const next: string[] = [];
      for (const id of current) {
        for (const e of this.adjacency.get(id) ?? []) {
          const other = e.source === id ? e.target : e.source;
          const on = NODE_BY_ID.get(other);
          if (!on || keep.has(other) || !allowed(on)) continue;
          // Sections are only pulled in by the passages step, not the traversal.
          if (on.label === 'Section') continue;
          // Hop 2+ should not wander from a country into unrelated regions' rule sets.
          if (h >= 1 && on.label === 'Rule' && intent.leaveTypes.length && !ruleTouchesLeaveTypes(on.id, intent.leaveTypes, this.adjacency)) continue;
          keep.set(other, on);
          next.push(other);
        }
      }
      current = next;
      if (keep.size > 70) break;
    }
    const edges = EDGES.filter((e) => keep.has(e.source) && keep.has(e.target));
    return { nodes: [...keep.values()], edges };
  }
}

// ─── helpers ───────────────────────────────────────────────────────────────

function buildAdjacency(edges: GraphEdge[]): Map<string, GraphEdge[]> {
  const m = new Map<string, GraphEdge[]>();
  for (const e of edges) {
    (m.get(e.source) ?? m.set(e.source, []).get(e.source)!).push(e);
    (m.get(e.target) ?? m.set(e.target, []).get(e.target)!).push(e);
  }
  return m;
}

function ruleTouchesLeaveTypes(ruleId: string, leaveTypes: string[], adj: Map<string, GraphEdge[]>): boolean {
  for (const e of adj.get(ruleId) ?? []) {
    if (e.relation === 'HAS_RULE' && leaveTypes.includes(e.source)) return true;
  }
  return false;
}

function hopOf(id: string, seeds: Seed[], adj: Map<string, GraphEdge[]>): number {
  if (seeds.some((s) => s.id === id)) return 0;
  const seen = new Set(seeds.map((s) => s.id));
  let frontier = [...seen];
  for (let h = 1; h <= 4; h++) {
    const next: string[] = [];
    for (const f of frontier) {
      for (const e of adj.get(f) ?? []) {
        const other = e.source === f ? e.target : e.source;
        if (other === id) return h;
        if (!seen.has(other)) {
          seen.add(other);
          next.push(other);
        }
      }
    }
    frontier = next;
  }
  return 4;
}

export function resolveWithContext(question: string, history: ChatRequest['history']): string {
  const q = question.trim();
  const lastUser = [...history].reverse().find((h) => h.role === 'user')?.text ?? '';
  if (!lastUser) return q;
  const prev = detectIntent(lastUser);
  const cur = detectIntent(q);
  const short = tokenize(q).length <= 6;
  const startsLikeFollowUp = /^(and|what about|how about|same|also|ok|okay|now)\b/i.test(q) || /\b(there|it|that|those|they|them)\b/i.test(q);
  if (!short && !startsLikeFollowUp) return q;

  const parts: string[] = [];
  // Follow-up names a country but no leave type → reuse the previous leave type + facet.
  if (cur.countries.length && !cur.leaveTypes.length && prev.leaveTypes.length) {
    const lt = prev.leaveTypes.map((id) => NODE_BY_ID.get(id)?.name.toLowerCase()).filter(Boolean).join(' and ');
    const facet = prev.facets[0] ?? cur.facets[0];
    parts.push(facetQuestion(facet, lt, cur.countries));
    return parts.join(' ');
  }
  // Follow-up names a leave type or facet but no country → reuse the previous country.
  if (!cur.countries.length && prev.countries.length && (cur.leaveTypes.length || cur.facets.length)) {
    const lt = (cur.leaveTypes.length ? cur.leaveTypes : prev.leaveTypes).map((id) => NODE_BY_ID.get(id)?.name.toLowerCase()).filter(Boolean).join(' and ');
    const facet = cur.facets[0] ?? prev.facets[0];
    return facetQuestion(facet, lt || 'leave', prev.countries);
  }
  return q;
}

function facetQuestion(facet: Facet | undefined, leaveType: string, countries: CountryCode[]): string {
  const where = countries.map((c) => COUNTRY_NAMES[c]).join(' and ');
  switch (facet) {
    case 'carryover':
      return `What is the carryover rule for unused ${leaveType} in ${where}?`;
    case 'notice':
      return `How much notice is required for ${leaveType} in ${where}?`;
    case 'approval':
      return `Who approves ${leaveType} in ${where}?`;
    case 'pay':
      return `How is ${leaveType} paid in ${where}?`;
    case 'regulation':
      return `Which regulations govern ${leaveType} in ${where}?`;
    case 'eligibility':
      return `Who is eligible for ${leaveType} in ${where}?`;
    default:
      return `How much ${leaveType} do employees get in ${where}?`;
  }
}

export function detectIntent(question: string): Intent {
  const q = question.toLowerCase();
  const countries: CountryCode[] = [];
  const hit = (aliases: string[] | undefined, name: string): boolean =>
    [name.toLowerCase(), ...(aliases ?? [])].some((a) => new RegExp(`(^|[^a-z])${escapeRe(a)}([^a-z]|$)`, 'i').test(q));
  for (const code of ['USA', 'MEX', 'CAN'] as CountryCode[]) {
    const node = NODE_BY_ID.get(COUNTRY_IDS[code])!;
    if (hit(node.aliases, node.name)) countries.push(code);
  }
  const leaveTypes = ALL_NODES.filter((x) => x.label === 'LeaveType' && hit(x.aliases, x.name)).map((x) => x.id);
  const facets = FACET_PATTERNS.filter(([re]) => re.test(q)).map(([, f]) => f);
  const wantsRegulations = /\b(regulation|law|statute|legislation|act\b|code\b|govern)/.test(q);
  if (wantsRegulations && !facets.includes('regulation')) facets.push('regulation');
  if (!facets.length) facets.push('entitlement');
  return {
    countries,
    leaveTypes,
    facets,
    wantsComparison: /\b(compare|comparison|versus|vs\.?|difference|differ|across|between|each country|all countries)\b/.test(q) || countries.length > 1,
    wantsRegulations,
  };
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function lexicalMatch(question: string): Seed[] {
  const q = question.toLowerCase();
  const tokens = tokenize(question);
  const out: Seed[] = [];
  for (const node of ALL_NODES) {
    if (node.label === 'Section') continue;
    const names = [node.name.toLowerCase(), ...(node.aliases ?? [])];
    let score = 0;
    for (const a of names) {
      if (new RegExp(`(^|[^a-z])${escapeRe(a)}([^a-z]|$)`).test(q)) score = Math.max(score, a.includes(' ') ? 2.4 : 1.6);
    }
    if (!score) {
      const nameTokens = new Set(names.flatMap((a) => a.split(/\s+/)));
      const overlap = tokens.filter((t) => nameTokens.has(t)).length;
      if (overlap >= 2) score = 0.9 * overlap;
    }
    if (score > 0) out.push({ id: node.id, score, via: ['lexical'] });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 12);
}

function vectorMatch(question: string): Seed[] {
  const q = question.toLowerCase();
  const scores = new Map<string, number>();
  for (const [re, ids] of SEMANTIC) {
    if (re.test(q)) for (const id of ids) scores.set(id, (scores.get(id) ?? 0) + 0.82);
  }
  // Soft matches: individual tokens against aliases (what an embedding would catch across wording).
  // Country words are excluded for non-Country nodes, otherwise "Mexico" would pull in every Mexican rule.
  const countryTokens = new Set(
    ALL_NODES.filter((x) => x.label === 'Country' || x.label === 'Region').flatMap((x) => [x.name.toLowerCase(), ...(x.aliases ?? [])].flatMap((a) => a.split(/\s+/))),
  );
  const tokens = tokenize(question);
  for (const node of ALL_NODES) {
    if (node.label === 'Section') continue;
    const geo = node.label === 'Country' || node.label === 'Region';
    const nameTokens = new Set([node.name.toLowerCase(), ...(node.aliases ?? [])].flatMap((a) => a.split(/\s+/)));
    const overlap = tokens.filter((t) => (geo || !countryTokens.has(t)) && (nameTokens.has(t) || [...nameTokens].some((n) => n.length > 4 && (t.startsWith(n) || n.startsWith(t))))).length;
    if (overlap) scores.set(node.id, (scores.get(node.id) ?? 0) + 0.31 * overlap);
  }
  return [...scores.entries()]
    .map(([id, score]) => ({ id, score, via: ['vector'] as Seed['via'] }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
}

function fuse(lexical: Seed[], vector: Seed[], mode: RetrievalMode): Seed[] {
  if (mode === 'lexical') return lexical.slice(0, 10);
  if (mode === 'vector') return vector.slice(0, 10);
  const k = 60;
  const fused = new Map<string, Seed>();
  const add = (list: Seed[]) =>
    list.forEach((s, rank) => {
      const cur = fused.get(s.id) ?? { id: s.id, score: 0, via: [] };
      cur.score += 1 / (k + rank + 1);
      cur.via = [...new Set([...cur.via, ...s.via])];
      fused.set(s.id, cur);
    });
  add(lexical);
  add(vector);
  return [...fused.values()].sort((a, b) => b.score - a.score).slice(0, mode === 'graph' ? 8 : 10);
}

function pickRules(nodes: GraphNode[], intent: Intent, seeds: Seed[]): GraphNode[] {
  const seedIds = new Set(seeds.map((s) => s.id));
  const rules = nodes.filter((x) => x.label === 'Rule');
  const specificFacet = intent.facets.some((f) => f !== 'entitlement');
  const scored = rules.map((r) => {
    let s = 0;
    if (seedIds.has(r.id)) s += 3;
    const facetHit = r.facets?.some((f) => intent.facets.includes(f)) ?? false;
    if (facetHit) s += 2;
    else if (specificFacet) s -= 1.5;
    if (intent.countries.length) {
      if (r.country && intent.countries.includes(r.country as CountryCode)) s += 2;
      else if (r.country === 'GLOBAL') s += intent.facets.includes('entitlement') && !intent.facets.includes('carryover') ? 0.4 : 1;
    } else if (r.country === 'GLOBAL') s += 1.2;
    if (intent.leaveTypes.length) {
      if (ruleTouchesLeaveTypes(r.id, intent.leaveTypes, ADJ)) s += 2;
      else s -= 2.5;
    }
    if (intent.wantsRegulations && r.facets?.includes('regulation')) s += 1;
    return { r, s };
  });
  const threshold = intent.countries.length && intent.leaveTypes.length ? 4 : 2.4;
  const sorted = scored.filter((x) => x.s >= threshold).sort((a, b) => b.s - a.s);
  const limit = intent.wantsComparison ? 9 : intent.countries.length === 1 ? 4 : 5;
  return sorted.slice(0, limit).map((x) => x.r);
}

const ADJ = buildAdjacency(EDGES);

function buildFacts(edges: GraphEdge[], usedIds: Set<string>): Fact[] {
  return edges
    .map<Fact>((e) => {
      const s = NODE_BY_ID.get(e.source)!;
      const o = NODE_BY_ID.get(e.target)!;
      return {
        subject: s.name,
        subjectId: s.id,
        relation: e.relation,
        object: o.name,
        objectId: o.id,
        confidence: e.confidence,
        usedInAnswer: usedIds.has(e.source) && usedIds.has(e.target),
        sectionId: e.sectionId,
      };
    })
    .sort((a, b) => Number(b.usedInAnswer) - Number(a.usedInAnswer) || b.confidence - a.confidence);
}

function collectPassages(rules: GraphNode[], intent: Intent): Passage[] {
  const ids: string[] = [];
  for (const r of rules) {
    for (const e of ADJ.get(r.id) ?? []) {
      if (e.relation === 'CITED_IN' && !ids.includes(e.target)) ids.push(e.target);
    }
  }
  if (!ids.length) {
    // fall back to the scope passage so a low-confidence answer still shows where to look
    ids.push('s-g-1');
  }
  const list = ids.map((id) => PASSAGE_BY_ID.get(id)!).filter(Boolean);
  const order = (c: Passage['country']): number => (c === 'GLOBAL' ? 9 : intent.countries.indexOf(c as CountryCode) + 1 || 5);
  return list.sort((a, b) => order(a.country) - order(b.country)).slice(0, 8);
}

function scoreConfidence(seeds: Seed[], rules: GraphNode[]): Confidence {
  if (!rules.length) return 'low';
  if (seeds.length >= 2 && rules.length >= 2) return 'high';
  if (seeds.length >= 1 && rules.length >= 1) return 'medium';
  return 'low';
}

const LT_LABEL: Record<string, string> = {
  'lt-annual': 'annual leave',
  'lt-sick': 'sick leave',
  'lt-parental': 'parental leave',
  'lt-bereavement': 'bereavement leave',
  'lt-holidays': 'public holidays',
  'lt-jury': 'jury and civic duty leave',
};

function composeAnswer(question: string, intent: Intent, rules: GraphNode[], cite: (s?: string) => string, confidence: Confidence): string {
  if (!rules.length) {
    return `I can't find that in the leave-policy graph. The graph covers **annual, sick, parental, bereavement, public-holiday and jury-duty leave** for the **United States, Mexico and Canada**, plus the global policy they inherit from${cite('s-g-1')}. Try naming a country and a leave type.`;
  }
  const sectionOf = (r: GraphNode): string | undefined => ADJ.get(r.id)?.find((e) => e.relation === 'CITED_IN')?.target;
  const byCountry = new Map<string, GraphNode[]>();
  for (const r of rules) {
    const key = r.country ?? 'GLOBAL';
    (byCountry.get(key) ?? byCountry.set(key, []).get(key)!).push(r);
  }
  const ltText = intent.leaveTypes.map((id) => LT_LABEL[id] ?? NODE_BY_ID.get(id)?.name.toLowerCase()).join(' and ') || 'leave';
  const facet = intent.facets[0];
  const lead = leadSentence(facet, ltText, intent, byCountry);

  const lines: string[] = [lead, ''];
  const countryOrder = ['USA', 'MEX', 'CAN', 'GLOBAL'].filter((c) => byCountry.has(c));
  const multi = countryOrder.length > 1;
  for (const c of countryOrder) {
    const rs = byCountry.get(c)!;
    const heading = c === 'GLOBAL' ? 'Global baseline' : COUNTRY_NAMES[c as CountryCode];
    if (multi) lines.push(`**${heading}**`);
    for (const r of rs) {
      lines.push(`- ${r.summary ?? r.name}${cite(sectionOf(r))}`);
    }
    if (multi) lines.push('');
  }
  const closing = closingSentence(facet, intent, byCountry);
  if (closing) lines.push(closing);
  if (confidence === 'medium') lines.push('', '_Only one entity in the question matched the graph, so check the cited sections before relying on this._');
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function leadSentence(facet: Facet | undefined, lt: string, intent: Intent, byCountry: Map<string, GraphNode[]>): string {
  const where = intent.countries.length ? intent.countries.map((c) => COUNTRY_NAMES[c]).join(', ').replace(/, ([^,]*)$/, ' and $1') : 'the policy';
  switch (facet) {
    case 'carryover':
      return `Here is how unused ${lt} is carried over in ${where}:`;
    case 'notice':
      return `Notice requirements for ${lt} in ${where}:`;
    case 'approval':
      return `Approval for ${lt} in ${where} works as follows:`;
    case 'pay':
      return `Pay during ${lt} in ${where}:`;
    case 'regulation':
      return `The ${lt} rules in ${where} are governed by these statutes and policy clauses:`;
    case 'eligibility':
      return `Eligibility for ${lt} in ${where}:`;
    default:
      return intent.countries.length > 1 ? `Here is the ${lt} entitlement across ${where}:` : `Here is the ${lt} entitlement in ${where}:`;
  }
}

function closingSentence(facet: Facet | undefined, intent: Intent, byCountry: Map<string, GraphNode[]>): string {
  const hasOverride = [...byCountry.values()].flat().some((r) => ADJ.get(r.id)?.some((e) => e.relation === 'OVERRIDES' && e.source === r.id));
  if (facet === 'carryover' && hasOverride) {
    return 'Country clauses marked as overrides replace the global carryover rule rather than adding to it.';
  }
  if (intent.wantsComparison && byCountry.size > 1) {
    return 'Each country policy inherits the global policy and may only add to an entitlement, so the global baseline is the floor in every case.';
  }
  return '';
}

function extractiveAnswer(rules: GraphNode[], cite: (s?: string) => string, confidence: Confidence): string {
  if (!rules.length) return 'No matching rules in the graph.';
  const sectionOf = (r: GraphNode): string | undefined => ADJ.get(r.id)?.find((e) => e.relation === 'CITED_IN')?.target;
  const lines = ['**Grounding facts (LLM off)**', ''];
  for (const r of rules) {
    const scope = r.country === 'GLOBAL' || !r.country ? 'Global' : COUNTRY_NAMES[r.country as CountryCode];
    lines.push(`- \`${scope}\` **${r.name}** — ${r.summary ?? ''}${cite(sectionOf(r))}`);
  }
  if (confidence === 'low') lines.push('', '_Low confidence: no seed entity matched strongly._');
  return lines.join('\n');
}

function buildCypher(seeds: Seed[], hops: number, intent: Intent): string {
  const ids = seeds.map((s) => `'${s.id}'`).join(', ');
  const scope = intent.countries.length ? `\n  AND (m.country IS NULL OR m.country = 'GLOBAL' OR m.country IN [${intent.countries.map((c) => `'${c}'`).join(', ')}])` : '';
  return `// seeds from ${intent.leaveTypes.length || intent.countries.length ? 'lexical + vector fusion' : 'fusion'}
MATCH (seed)
WHERE seed.id IN [${ids}]
CALL apoc.path.subgraphAll(seed, {
  maxLevel: ${hops},
  relationshipFilter: 'PART_OF|HAS_POLICY|INHERITS_FROM|COVERS|HAS_RULE|GOVERNED_BY|APPLIES_TO|APPROVED_BY|OVERRIDES',
  labelFilter: '-Section'
})
YIELD nodes, relationships
UNWIND nodes AS m
WITH seed, m, relationships
WHERE true${scope}
RETURN seed.id AS seed,
       collect(DISTINCT m { .id, .name, label: labels(m)[0], .country }) AS nodes,
       [r IN relationships | { source: startNode(r).id, target: endNode(r).id, type: type(r), confidence: r.confidence, section: r.section }] AS edges`;
}

export const PASSAGE_COUNT = PASSAGES.length;

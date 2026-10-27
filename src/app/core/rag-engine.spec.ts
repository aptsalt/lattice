import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, ChatRequest } from './models';
import { RagEngine, detectIntent, resolveWithContext } from './rag-engine';

const req = (question: string, patch: Partial<ChatRequest> = {}): ChatRequest => ({
  question,
  conversationId: 'c1',
  settings: { ...DEFAULT_SETTINGS, source: 'offline' },
  history: [],
  ...patch,
});

describe('detectIntent', () => {
  it('finds countries, leave types and facets', () => {
    const i = detectIntent('What is the carryover rule for unused annual leave in Canada?');
    expect(i.countries).toEqual(['CAN']);
    expect(i.leaveTypes).toContain('lt-annual');
    expect(i.facets[0]).toBe('carryover');
  });

  it('treats multi-country questions as comparisons', () => {
    const i = detectIntent('Compare parental leave in the USA, Mexico and Canada.');
    expect(i.countries).toEqual(['USA', 'MEX', 'CAN']);
    expect(i.wantsComparison).toBe(true);
  });
});

describe('resolveWithContext', () => {
  it('rewrites "and in Canada?" using the previous leave type and facet', () => {
    const out = resolveWithContext('And in Canada?', [{ role: 'user', text: 'What is the carryover rule for unused annual leave in Mexico?' }]);
    expect(out.toLowerCase()).toContain('canada');
    expect(out.toLowerCase()).toContain('carryover');
    expect(out.toLowerCase()).toContain('annual leave');
  });

  it('keeps a self-contained question untouched', () => {
    const q = 'How many vacation days does a new employee in Mexico get?';
    expect(resolveWithContext(q, [{ role: 'user', text: 'Who approves sick leave in Canada?' }])).toBe(q);
  });
});

describe('RagEngine.chat', () => {
  const engine = new RagEngine();

  it('answers a Mexico vacation question from Mexican rules only', async () => {
    const res = await engine.chat(req('How many vacation days does a new full-time employee in Mexico get?'));
    expect(res.confidence).toBe('high');
    expect(res.answerMarkdown).toContain('15 working days');
    expect(res.answerMarkdown).not.toMatch(/maternity/i);
    expect(res.passages.every((p) => p.country === 'MEX' || p.country === 'GLOBAL')).toBe(true);
    // every citation number in the prose maps to a returned passage
    const cited = [...res.answerMarkdown.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1]));
    for (const n of cited) expect(res.citations.some((c) => c.n === n)).toBe(true);
  });

  it('scopes the subgraph to the countries in the question', async () => {
    const res = await engine.chat(req('Who approves sick leave longer than three days in the USA?'));
    expect(res.subgraph.nodes.some((n) => n.country === 'MEX' || n.country === 'CAN')).toBe(false);
    expect(res.answerMarkdown).toMatch(/HRBP|HR Business Partner/);
  });

  it('marks used nodes and keeps used edges inside used nodes', async () => {
    const res = await engine.chat(req('Which regulations govern leave in Mexico?'));
    const used = new Set(res.subgraph.nodes.filter((n) => n.used).map((n) => n.id));
    expect(used.size).toBeGreaterThan(0);
    for (const e of res.subgraph.edges.filter((x) => x.used)) {
      expect(used.has(e.source) && used.has(e.target)).toBe(true);
    }
    expect(res.subgraph.nodes.some((n) => n.id === 'reg-lft' && n.used)).toBe(true);
  });

  it('returns an extractive answer when the LLM is off', async () => {
    const res = await engine.chat(req('What is the carryover rule for unused annual leave in Canada?', { settings: { ...DEFAULT_SETTINGS, generateAnswer: false } }));
    expect(res.answerMarkdown).toContain('LLM off');
    expect(res.answerMarkdown).toMatch(/Canada vacation carryover/);
  });

  it('skips the vector step in lexical mode and the lexical step in vector mode', async () => {
    const lex = await engine.chat(req('sick leave in Canada', { settings: { ...DEFAULT_SETTINGS, mode: 'lexical' } }));
    expect(lex.trace.some((s) => s.id === 'vector')).toBe(false);
    const vec = await engine.chat(req('sick leave in Canada', { settings: { ...DEFAULT_SETTINGS, mode: 'vector' } }));
    expect(vec.trace.some((s) => s.id === 'lexical')).toBe(false);
    expect(vec.stats.mode).toBe('vector');
  });

  it('expands three hops in graph mode', async () => {
    const res = await engine.chat(req('parental leave in Canada', { settings: { ...DEFAULT_SETTINGS, mode: 'graph' } }));
    expect(res.trace.find((s) => s.id === 'expand')?.title).toContain('3 hops');
  });

  it('is honest when nothing matches', async () => {
    const res = await engine.chat(req('What is the office wifi password?'));
    expect(res.confidence).toBe('low');
    expect(res.answerMarkdown).toMatch(/can't find that/);
  });
});

import { Injectable, computed, effect, inject, signal } from '@angular/core';
import {
  AssistantMessage,
  ChatRequest,
  ChatSettings,
  Conversation,
  DEFAULT_SETTINGS,
  Message,
} from './models';
import { RagEngine } from './rag-engine';

const STORAGE_KEY = 'lattice.conversations.v1';
const SETTINGS_KEY = 'lattice.settings.v1';

const uid = (): string => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/**
 * Signal-based conversation state. Persists to localStorage so the demo
 * survives a refresh; a real deployment keeps this server-side.
 */
@Injectable({ providedIn: 'root' })
export class ChatStore {
  private readonly engine = inject(RagEngine);

  readonly conversations = signal<Conversation[]>(load<Conversation[]>(STORAGE_KEY) ?? []);
  readonly activeId = signal<string | null>(null);
  readonly settings = signal<ChatSettings>({ ...DEFAULT_SETTINGS, ...(load<Partial<ChatSettings>>(SETTINGS_KEY) ?? {}) });
  readonly busy = signal(false);
  readonly search = signal('');

  readonly active = computed(() => this.conversations().find((c) => c.id === this.activeId()) ?? null);
  readonly messages = computed<Message[]>(() => this.active()?.messages ?? []);
  readonly isEmpty = computed(() => this.messages().length === 0);

  readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const list = [...this.conversations()].sort((a, b) => b.updatedAt - a.updatedAt);
    return q ? list.filter((c) => c.title.toLowerCase().includes(q) || c.messages.some((m) => m.text.toLowerCase().includes(q))) : list;
  });

  /** Conversations grouped by recency for the sidebar. */
  readonly groups = computed(() => {
    const now = Date.now();
    const day = 86_400_000;
    const buckets: { label: string; items: Conversation[] }[] = [
      { label: 'Today', items: [] },
      { label: 'Yesterday', items: [] },
      { label: 'Previous 7 days', items: [] },
      { label: 'Older', items: [] },
    ];
    for (const c of this.filtered()) {
      const age = now - c.updatedAt;
      const i = age < day ? 0 : age < 2 * day ? 1 : age < 7 * day ? 2 : 3;
      buckets[i].items.push(c);
    }
    return buckets.filter((b) => b.items.length);
  });

  constructor() {
    effect(() => save(STORAGE_KEY, this.conversations()));
    effect(() => save(SETTINGS_KEY, this.settings()));
  }

  newConversation(): void {
    this.activeId.set(null);
  }

  select(id: string): void {
    this.activeId.set(id);
  }

  rename(id: string, title: string): void {
    const t = title.trim();
    if (!t) return;
    this.conversations.update((list) => list.map((c) => (c.id === id ? { ...c, title: t } : c)));
  }

  remove(id: string): void {
    this.conversations.update((list) => list.filter((c) => c.id !== id));
    if (this.activeId() === id) this.activeId.set(null);
  }

  clearActive(): void {
    const id = this.activeId();
    if (!id) return;
    this.conversations.update((list) => list.map((c) => (c.id === id ? { ...c, messages: [], updatedAt: Date.now() } : c)));
  }

  patchSettings(patch: Partial<ChatSettings>): void {
    this.settings.update((s) => ({ ...s, ...patch }));
  }

  async send(text: string): Promise<void> {
    const question = text.trim();
    if (!question || this.busy()) return;

    let id = this.activeId();
    if (!id) {
      id = uid();
      const now = Date.now();
      this.conversations.update((list) => [{ id: id!, title: titleFrom(question), createdAt: now, updatedAt: now, messages: [] }, ...list]);
      this.activeId.set(id);
    }
    const settings = this.settings();
    const history = this.messages().map((m) => ({ role: m.role, text: m.text }));
    const userMsg: Message = { id: uid(), role: 'user', text: question, at: Date.now() };
    const assistantId = uid();
    const assistant: AssistantMessage = { id: assistantId, role: 'assistant', at: Date.now(), text: '', streaming: true, settings };
    this.append(id, userMsg);
    this.append(id, assistant);
    this.busy.set(true);

    try {
      const req: ChatRequest = { question, conversationId: id, settings, history: settings.useContext ? history : [] };
      const res = await this.engine.chat(req);
      // attach the response first so evidence is ready while the prose streams in
      this.patchMessage(id, assistantId, { response: res });
      await this.stream(id, assistantId, res.answerMarkdown);
      this.patchMessage(id, assistantId, { streaming: false, text: res.answerMarkdown });
    } catch (err) {
      this.patchMessage(id, assistantId, { streaming: false, error: err instanceof Error ? err.message : 'Request failed' });
    } finally {
      this.busy.set(false);
    }
  }

  async regenerate(assistantId: string): Promise<void> {
    const conv = this.active();
    if (!conv) return;
    const idx = conv.messages.findIndex((m) => m.id === assistantId);
    const user = idx > 0 ? conv.messages[idx - 1] : undefined;
    if (!user || user.role !== 'user') return;
    this.conversations.update((list) => list.map((c) => (c.id === conv.id ? { ...c, messages: c.messages.slice(0, idx - 1) } : c)));
    await this.send(user.text);
  }

  private async stream(convId: string, msgId: string, full: string): Promise<void> {
    // Token-ish streaming: word chunks at a cadence that reads like an LLM.
    const words = full.split(/(\s+)/);
    let acc = '';
    for (let i = 0; i < words.length; i++) {
      acc += words[i];
      if (i % 3 === 0) {
        this.patchMessage(convId, msgId, { text: acc });
        await new Promise((r) => setTimeout(r, 14));
      }
    }
  }

  private append(convId: string, msg: Message): void {
    this.conversations.update((list) => list.map((c) => (c.id === convId ? { ...c, messages: [...c.messages, msg], updatedAt: Date.now() } : c)));
  }

  private patchMessage(convId: string, msgId: string, patch: Partial<AssistantMessage>): void {
    this.conversations.update((list) =>
      list.map((c) =>
        c.id === convId ? { ...c, messages: c.messages.map((m) => (m.id === msgId ? ({ ...m, ...patch } as Message) : m)) } : c,
      ),
    );
  }
}

function titleFrom(q: string): string {
  const t = q.replace(/\s+/g, ' ').trim();
  return t.length > 48 ? t.slice(0, 46).trimEnd() + '…' : t;
}

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode) — state stays in memory */
  }
}

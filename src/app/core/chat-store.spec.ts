import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ChatStore } from './chat-store';

describe('ChatStore', () => {
  let store: ChatStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    store = TestBed.inject(ChatStore);
    store.patchSettings({ source: 'offline' });
  });

  it('creates a conversation on first send and streams an answer', async () => {
    expect(store.conversations().length).toBe(0);
    await store.send('How many vacation days does a new employee in Mexico get?');
    expect(store.conversations().length).toBe(1);
    const msgs = store.messages();
    expect(msgs.length).toBe(2);
    expect(msgs[1].role).toBe('assistant');
    expect(msgs[1].role === 'assistant' && msgs[1].streaming).toBe(false);
    expect(msgs[1].text.length).toBeGreaterThan(20);
  });

  it('persists conversations and settings to localStorage', async () => {
    await store.send('Which regulations govern leave in Mexico?');
    store.patchSettings({ mode: 'graph' });
    TestBed.tick(); // flush the persistence effects
    expect(JSON.parse(localStorage.getItem('lattice.conversations.v1') ?? '[]').length).toBe(1);
    expect(JSON.parse(localStorage.getItem('lattice.settings.v1') ?? '{}').mode).toBe('graph');
  });

  it('clears, renames and removes', async () => {
    await store.send('Who approves sick leave in the USA?');
    const id = store.activeId()!;
    store.rename(id, 'Sick leave approvals');
    expect(store.active()?.title).toBe('Sick leave approvals');
    store.clearActive();
    expect(store.messages().length).toBe(0);
    store.remove(id);
    expect(store.conversations().length).toBe(0);
    expect(store.activeId()).toBeNull();
  });
});

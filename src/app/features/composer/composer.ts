import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { OverlayModule } from '@angular/cdk/overlay';
import { LucideAngularModule } from 'lucide-angular';
import { ChatStore } from '../../core/chat-store';
import { ICONS } from '../../core/icons';
import { DataSource, RetrievalMode } from '../../core/models';
import { MENU_ABOVE } from '../../core/overlay-positions';
import { detectIntent } from '../../core/rag-engine';

interface Option<T extends string> {
  value: T;
  label: string;
  hint: string;
}

export const SOURCE_OPTIONS: Option<DataSource>[] = [
  { value: 'live', label: 'Live Neo4j', hint: 'Bolt connection, Cypher per request' },
  { value: 'offline', label: 'Offline snapshot', hint: 'resolved.json exported from the graph' },
];

export const MODE_OPTIONS: Option<RetrievalMode>[] = [
  { value: 'lexical', label: 'Lexical', hint: 'Full-text index on names and aliases' },
  { value: 'vector', label: 'Vector', hint: 'Embedding similarity on entities' },
  { value: 'hybrid', label: 'Hybrid', hint: 'Lexical + vector fused with RRF' },
  { value: 'graph', label: 'Graph', hint: '3-hop traversal from fused seeds' },
];

@Component({
  selector: 'app-composer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, OverlayModule],
  templateUrl: './composer.html',
  styleUrl: './composer.scss',
})
export class ComposerComponent {
  readonly store = inject(ChatStore);
  readonly icons = ICONS;
  readonly send = output<string>();

  readonly text = signal('');
  readonly openMenu = signal<'source' | 'mode' | null>(null);
  readonly positions = MENU_ABOVE;
  readonly sourceOptions = SOURCE_OPTIONS;
  readonly modeOptions = MODE_OPTIONS;

  readonly canSend = computed(() => this.text().trim().length > 0 && !this.store.busy());
  readonly sourceLabel = computed(() => SOURCE_OPTIONS.find((o) => o.value === this.store.settings().source)!.label);
  readonly modeLabel = computed(() => MODE_OPTIONS.find((o) => o.value === this.store.settings().mode)!.label);

  /** Follow-up chips that show off context resolution after an answer. */
  readonly followUps = computed<string[]>(() => {
    const msgs = this.store.messages();
    if (this.store.busy() || !msgs.length) return [];
    const lastUser = [...msgs].reverse().find((m) => m.role === 'user');
    if (!lastUser) return [];
    const intent = detectIntent(lastUser.text);
    const chips: string[] = [];
    const countries: { code: 'USA' | 'MEX' | 'CAN'; name: string }[] = [
      { code: 'CAN', name: 'Canada' },
      { code: 'MEX', name: 'Mexico' },
      { code: 'USA', name: 'the US' },
    ];
    for (const c of countries) if (!intent.countries.includes(c.code) && chips.length < 2) chips.push(`And in ${c.name}?`);
    if (!intent.facets.includes('approval')) chips.push('Who approves it?');
    if (!intent.facets.includes('regulation')) chips.push('Which law governs that?');
    if (!intent.facets.includes('carryover') && intent.leaveTypes.includes('lt-annual')) chips.push('Can I carry it over?');
    return chips.slice(0, 4);
  });

  private readonly textarea = viewChild<ElementRef<HTMLTextAreaElement>>('ta');

  onInput(ev: Event): void {
    const el = ev.target as HTMLTextAreaElement;
    this.text.set(el.value);
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px';
  }

  onKeydown(ev: KeyboardEvent): void {
    if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) {
      ev.preventDefault();
      this.submit();
    }
  }

  submit(): void {
    if (!this.canSend()) return;
    const value = this.text().trim();
    this.text.set('');
    const el = this.textarea()?.nativeElement;
    if (el) {
      el.value = '';
      el.style.height = 'auto';
    }
    this.send.emit(value);
  }

  useFollowUp(q: string): void {
    if (this.store.busy()) return;
    this.send.emit(q);
  }

  toggleMenu(which: 'source' | 'mode'): void {
    this.openMenu.update((m) => (m === which ? null : which));
  }

  chooseSource(v: DataSource): void {
    this.store.patchSettings({ source: v });
    this.openMenu.set(null);
  }

  chooseMode(v: RetrievalMode): void {
    this.store.patchSettings({ mode: v });
    this.openMenu.set(null);
  }

  toggleContext(): void {
    this.store.patchSettings({ useContext: !this.store.settings().useContext });
  }

  toggleLlm(): void {
    this.store.patchSettings({ generateAnswer: !this.store.settings().generateAnswer });
  }
}

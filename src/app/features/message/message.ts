import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { LucideAngularModule } from 'lucide-angular';
import { ChatStore } from '../../core/chat-store';
import { ICONS } from '../../core/icons';
import { renderMarkdown } from '../../core/markdown';
import { AssistantMessage } from '../../core/models';
import { EvidenceComponent, EvidenceTab } from '../evidence/evidence';

@Component({
  selector: 'app-message',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, LucideAngularModule, EvidenceComponent],
  templateUrl: './message.html',
  styleUrl: './message.scss',
})
export class MessageComponent {
  readonly message = input.required<AssistantMessage>();
  readonly store = inject(ChatStore);
  readonly icons = ICONS;
  private readonly sanitizer = inject(DomSanitizer);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly evidenceOpen = signal(false);
  readonly evidenceTab = signal<EvidenceTab>('graph');
  readonly highlightPassage = signal<string | null>(null);
  readonly copied = signal(false);
  readonly vote = signal<'up' | 'down' | null>(null);

  readonly html = computed<SafeHtml>(() => this.sanitizer.bypassSecurityTrustHtml(renderMarkdown(this.message().text)));
  readonly response = computed(() => this.message().response);
  readonly usedFacts = computed(() => this.response()?.facts.filter((f) => f.usedInAnswer).length ?? 0);
  /** The user turn this answer replies to (for the "resolved" hint). */
  readonly previousQuestion = computed(() => {
    const msgs = this.store.messages();
    const i = msgs.findIndex((m) => m.id === this.message().id);
    return i > 0 ? msgs[i - 1].text : '';
  });

  onBodyClick(ev: Event): void {
    const el = (ev.target as HTMLElement).closest<HTMLElement>('.cite');
    if (!el) return;
    this.openCitation(Number(el.dataset['n']));
  }

  onBodyKeydown(ev: KeyboardEvent): void {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    const el = (ev.target as HTMLElement).closest<HTMLElement>('.cite');
    if (!el) return;
    ev.preventDefault();
    this.openCitation(Number(el.dataset['n']));
  }

  private openCitation(n: number): void {
    const c = this.response()?.citations.find((x) => x.n === n);
    if (!c) return;
    this.evidenceTab.set('sources');
    this.evidenceOpen.set(true);
    this.highlightPassage.set(c.passageId);
    this.revealEvidence();
  }

  toggleEvidence(): void {
    this.evidenceOpen.update((v) => !v);
    if (this.evidenceOpen()) this.revealEvidence();
  }

  /** Bring the freshly opened panel into view (it opens below the fold of a long answer). */
  private revealEvidence(): void {
    requestAnimationFrame(() => {
      const el = this.host.nativeElement.querySelector<HTMLElement>('app-evidence');
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.message().text);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1400);
    } catch {
      /* clipboard blocked */
    }
  }

  regenerate(): void {
    void this.store.regenerate(this.message().id);
  }

  setVote(v: 'up' | 'down'): void {
    this.vote.update((cur) => (cur === v ? null : v));
  }
}

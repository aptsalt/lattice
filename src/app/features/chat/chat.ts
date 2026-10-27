import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { OverlayModule } from '@angular/cdk/overlay';
import { LucideAngularModule } from 'lucide-angular';
import { ChatStore } from '../../core/chat-store';
import { ICONS } from '../../core/icons';
import { SUGGESTED_QUESTIONS } from '../../core/graph-data';
import { ComposerComponent } from '../composer/composer';
import { MessageComponent } from '../message/message';
import { MENU_BELOW } from '../../core/overlay-positions';
import { LayoutService } from '../../core/layout';

@Component({
  selector: 'app-chat',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, LucideAngularModule, OverlayModule, ComposerComponent, MessageComponent],
  templateUrl: './chat.html',
  styleUrl: './chat.scss',
})
export class ChatComponent {
  readonly store = inject(ChatStore);
  readonly layout = inject(LayoutService);
  readonly icons = ICONS;
  readonly suggestions = SUGGESTED_QUESTIONS;
  readonly menuOpen = signal(false);
  readonly positions = MENU_BELOW;

  readonly title = computed(() => this.store.active()?.title ?? 'New conversation');
  readonly greeting = computed(() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  });

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private lastCount = 0;
  private lastLen = 0;

  constructor() {
    // keep the newest message in view while it streams
    afterRenderEffect(() => {
      const msgs = this.store.messages();
      const el = this.scroller()?.nativeElement;
      if (!el) return;
      const last = msgs[msgs.length - 1];
      const len = last?.text.length ?? 0;
      const countChanged = msgs.length !== this.lastCount;
      const grew = countChanged || len !== this.lastLen;
      this.lastCount = msgs.length;
      this.lastLen = len;
      if (!grew) return;
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
      // a new turn always scrolls; streaming only follows if the reader is already at the bottom
      if (nearBottom || countChanged) el.scrollTo({ top: el.scrollHeight });
    });
  }

  ask(q: string): void {
    void this.store.send(q);
  }

  clear(): void {
    this.store.clearActive();
    this.menuOpen.set(false);
  }

  export(): void {
    const conv = this.store.active();
    if (!conv) return;
    const blob = new Blob([JSON.stringify(conv, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${conv.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.menuOpen.set(false);
  }
}

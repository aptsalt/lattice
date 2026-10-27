import { ChangeDetectionStrategy, Component, ElementRef, afterRenderEffect, computed, input, viewChildren } from '@angular/core';
import { Citation, Passage } from '../../../core/models';

@Component({
  selector: 'app-sources-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="sources">
      @for (s of rows(); track s.passage.id) {
        <li class="source" [class.hl]="s.passage.id === highlight()" [attr.data-id]="s.passage.id" #item>
          <div class="head">
            <span class="n mono">[{{ s.n }}]</span>
            <span class="ref mono">{{ s.passage.ref }}</span>
            <strong class="title">{{ s.passage.title }}</strong>
            <span class="scope mono" [attr.data-c]="s.passage.country">{{ s.passage.country }}</span>
          </div>
          <div class="crumb">{{ s.passage.breadcrumb }}</div>
          <p class="text">{{ s.passage.text }}</p>
        </li>
      }
    </ol>
  `,
  styles: `
    :host {
      display: block;
      max-height: 480px;
      overflow: auto;
    }
    .sources {
      margin: 0;
      padding: 6px 0;
      list-style: none;
    }
    .source {
      padding: 12px 16px;
      border-top: 1px solid var(--line);
      transition: background 300ms ease;
      &:first-child {
        border-top: 0;
      }
      &.hl {
        background: color-mix(in srgb, var(--accent) 10%, transparent);
        box-shadow: inset 3px 0 0 var(--accent);
      }
    }
    .head {
      display: flex;
      align-items: baseline;
      gap: 8px;
      flex-wrap: wrap;
      font-size: 13px;
    }
    .n {
      color: var(--accent-2);
      font-size: 11.5px;
    }
    .ref {
      color: var(--muted);
      font-size: 12px;
    }
    .title {
      font-weight: 600;
    }
    .scope {
      margin-left: auto;
      padding: 1px 6px;
      border-radius: 4px;
      background: var(--panel-3);
      font-size: 10.5px;
      color: var(--muted);
      &[data-c='USA'] {
        color: #60a5fa;
      }
      &[data-c='MEX'] {
        color: #34d399;
      }
      &[data-c='CAN'] {
        color: #f472b6;
      }
    }
    .crumb {
      margin: 3px 0 8px;
      font-size: 11.5px;
      color: var(--faint);
    }
    .text {
      margin: 0;
      font-size: 13.5px;
      line-height: 1.6;
      color: var(--text);
    }
  `,
})
export class SourcesListComponent {
  readonly passages = input.required<Passage[]>();
  readonly citations = input.required<Citation[]>();
  readonly highlight = input<string | null>(null);

  readonly rows = computed(() =>
    this.passages().map((passage) => ({ passage, n: this.citations().find((c) => c.passageId === passage.id)?.n ?? '·' })),
  );

  private readonly items = viewChildren<ElementRef<HTMLElement>>('item');

  constructor() {
    afterRenderEffect(() => {
      const id = this.highlight();
      if (!id) return;
      const el = this.items().find((x) => x.nativeElement.dataset['id'] === id)?.nativeElement;
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }
}

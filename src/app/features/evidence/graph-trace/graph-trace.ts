import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ICONS } from '../../../core/icons';
import { Subgraph, TraceStep } from '../../../core/models';
import { GraphForceComponent } from '../graph-force/graph-force';

/**
 * Replay: the force layout with a timeline that lights nodes up in the order
 * the retrieval pipeline touched them — seeds, expansion, grounding — so the
 * viewer sees *why* the answer is grounded, not just *that* it is.
 */
@Component({
  selector: 'app-graph-trace',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, GraphForceComponent],
  template: `
    <app-graph-force [subgraph]="subgraph()" [visible]="visible()" (selected)="selected.emit($event)" />
    <div class="timeline">
      <button class="play" type="button" (click)="toggle()" [attr.aria-label]="playing() ? 'Pause' : 'Play'">
        <lucide-icon [img]="playing() ? icons.pause : icons.play" [size]="14" />
      </button>
      <div class="steps" role="list">
        @for (s of steps(); track s.id; let i = $index) {
          <button class="step" type="button" role="listitem" [class.done]="i <= index()" [class.now]="i === index()" (click)="go(i)" [title]="s.detail">
            <span class="mono">{{ i + 1 }}</span>
            <span class="label">{{ s.short }}</span>
          </button>
        }
      </div>
      <div class="caption">
        <strong>{{ current().title }}</strong>
        <span>{{ current().detail }}</span>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      position: absolute;
      inset: 0;
    }
    .timeline {
      position: absolute;
      left: 12px;
      right: 12px;
      top: 10px;
      display: grid;
      grid-template-columns: auto 1fr;
      grid-template-rows: auto auto;
      gap: 6px 10px;
      padding: 8px 10px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--line);
      background: color-mix(in srgb, var(--panel) 85%, transparent);
      backdrop-filter: blur(8px);
      pointer-events: auto;
    }
    .play {
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      border-radius: 8px;
      background: var(--text);
      color: var(--bg);
      grid-row: 1 / 3;
      align-self: center;
    }
    .steps {
      display: flex;
      gap: 4px;
      overflow-x: auto;
    }
    .step {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 24px;
      padding: 0 8px;
      border-radius: 6px;
      background: var(--panel-3);
      color: var(--faint);
      font-size: 11px;
      white-space: nowrap;
      transition: background 120ms ease, color 120ms ease;
      .mono {
        font-size: 10px;
      }
      &.done {
        color: var(--muted);
      }
      &.now {
        background: var(--accent-soft);
        color: var(--accent-2);
      }
    }
    .caption {
      display: flex;
      gap: 8px;
      align-items: baseline;
      font-size: 12px;
      color: var(--muted);
      overflow: hidden;
      strong {
        color: var(--text);
        font-weight: 500;
        white-space: nowrap;
      }
      span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  `,
})
export class GraphTraceComponent {
  readonly subgraph = input.required<Subgraph>();
  readonly trace = input.required<TraceStep[]>();
  readonly selected = output<string | null>();
  readonly icons = ICONS;

  readonly index = signal(0);
  readonly playing = signal(true);
  private timer: ReturnType<typeof setInterval> | null = null;

  readonly steps = computed(() => this.trace().map((s) => ({ ...s, short: SHORT[s.id] ?? s.id })));
  readonly current = computed(() => this.steps()[this.index()] ?? this.steps()[0]);

  /** Union of everything touched up to and including the current step. */
  readonly visible = computed<ReadonlySet<string>>(() => {
    const set = new Set<string>();
    const steps = this.steps();
    for (let i = 0; i <= this.index() && i < steps.length; i++) for (const id of steps[i].nodeIds) set.add(id);
    // the final step lights up the whole subgraph so the replay ends on the full picture
    if (this.index() >= steps.length - 1) for (const n of this.subgraph().nodes) set.add(n.id);
    return set;
  });

  constructor() {
    this.start();
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  toggle(): void {
    if (this.playing()) this.stop();
    else {
      if (this.index() >= this.steps().length - 1) this.index.set(0);
      this.start();
    }
  }

  go(i: number): void {
    this.stop();
    this.index.set(i);
  }

  private start(): void {
    this.playing.set(true);
    this.timer = setInterval(() => {
      if (this.index() >= this.steps().length - 1) {
        this.stop();
        return;
      }
      this.index.update((i) => i + 1);
    }, 1100);
  }

  private stop(): void {
    this.playing.set(false);
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

const SHORT: Record<string, string> = {
  resolve: 'resolve',
  lexical: 'lexical',
  vector: 'vector',
  fuse: 'fuse',
  expand: 'expand',
  rank: 'rank',
  passages: 'cite',
  answer: 'answer',
};

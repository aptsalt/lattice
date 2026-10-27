import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RetrievalStats, TraceStep } from '../../../core/models';

@Component({
  selector: 'app-trace-steps',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="steps">
      @for (s of rows(); track s.id; let i = $index) {
        <li class="step">
          <div class="rail">
            <span class="dot" [class.skip]="s.ms === 0"></span>
            @if (i < rows().length - 1) {
              <span class="line"></span>
            }
          </div>
          <div class="content">
            <div class="head">
              <span class="idx mono">{{ i + 1 }}</span>
              <strong>{{ s.title }}</strong>
              <span class="ms mono">{{ s.ms }} ms</span>
            </div>
            <p class="detail">{{ s.detail }}</p>
            @if (s.nodeIds.length) {
              <p class="nodes mono">{{ s.nodeIds.length }} node{{ s.nodeIds.length === 1 ? '' : 's' }} touched</p>
            }
            <div class="bar" aria-hidden="true"><i [style.width.%]="s.pct"></i></div>
          </div>
        </li>
      }
    </ol>
    <p class="total mono">total {{ stats().latencyMs }} ms · {{ stats().mode }} · {{ stats().source }}</p>
  `,
  styles: `
    :host {
      display: block;
      max-height: 480px;
      overflow: auto;
      padding: 14px 16px 6px;
    }
    .steps {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .step {
      display: grid;
      grid-template-columns: 18px 1fr;
      gap: 10px;
    }
    .rail {
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .dot {
      width: 10px;
      height: 10px;
      margin-top: 5px;
      border-radius: 50%;
      background: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-soft);
      &.skip {
        background: var(--faint);
        box-shadow: none;
      }
    }
    .line {
      flex: 1;
      width: 1px;
      margin: 4px 0;
      background: var(--line-2);
    }
    .content {
      padding-bottom: 16px;
    }
    .head {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
    }
    .idx {
      color: var(--faint);
      font-size: 11px;
    }
    .ms {
      margin-left: auto;
      font-size: 11px;
      color: var(--muted);
    }
    .detail {
      margin: 3px 0 0;
      font-size: 12.5px;
      color: var(--muted);
    }
    .nodes {
      margin: 2px 0 0;
      font-size: 11px;
      color: var(--faint);
    }
    .bar {
      height: 3px;
      margin-top: 8px;
      border-radius: 2px;
      background: var(--panel-3);
      overflow: hidden;
      i {
        display: block;
        height: 100%;
        background: var(--accent);
        border-radius: 2px;
      }
    }
    .total {
      margin: 4px 0 8px 28px;
      font-size: 11px;
      color: var(--faint);
    }
  `,
})
export class TraceStepsComponent {
  readonly trace = input.required<TraceStep[]>();
  readonly stats = input.required<RetrievalStats>();

  readonly rows = computed(() => {
    const max = Math.max(1, ...this.trace().map((s) => s.ms));
    return this.trace().map((s) => ({ ...s, pct: Math.max(3, (s.ms / max) * 100) }));
  });
}

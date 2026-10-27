import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { Fact } from '../../../core/models';

type SortKey = 'subject' | 'relation' | 'object' | 'confidence';

@Component({
  selector: 'app-facts-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bar">
      <label class="toggle">
        <input type="checkbox" [checked]="onlyUsed()" (change)="onlyUsed.set(!onlyUsed())" />
        <span>Only facts used in the answer</span>
      </label>
      <span class="mono count">{{ rows().length }} of {{ facts().length }}</span>
    </div>
    <div class="scroll">
      <table>
        <thead>
          <tr>
            @for (c of cols; track c.key) {
              <th [class.num]="c.key === 'confidence'">
                <button type="button" (click)="sortBy(c.key)" [class.active]="sort() === c.key">
                  {{ c.label }}
                  @if (sort() === c.key) {
                    <span aria-hidden="true">{{ dir() === 'asc' ? '↑' : '↓' }}</span>
                  }
                </button>
              </th>
            }
          </tr>
        </thead>
        <tbody>
          @for (f of rows(); track f.subjectId + f.relation + f.objectId) {
            <tr [class.used]="f.usedInAnswer">
              <td>{{ f.subject }}</td>
              <td class="rel mono">{{ f.relation }}</td>
              <td>{{ f.object }}</td>
              <td class="num mono">
                <span class="meter" [style.--w.%]="f.confidence * 100"></span>
                {{ f.confidence.toFixed(2) }}
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="4" class="empty">No facts match.</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      font-size: 12.5px;
      color: var(--muted);
    }
    .toggle {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      input {
        accent-color: var(--accent);
      }
    }
    .count {
      font-size: 11px;
      color: var(--faint);
    }
    .scroll {
      max-height: 420px;
      overflow: auto;
      border-top: 1px solid var(--line);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th {
      position: sticky;
      top: 0;
      z-index: 1;
      padding: 8px 14px;
      text-align: left;
      background: var(--panel-2);
      font-weight: 500;
      font-size: 11.5px;
      color: var(--muted);
      button {
        color: inherit;
        font: inherit;
        &.active {
          color: var(--text);
        }
      }
    }
    td {
      padding: 8px 14px;
      border-top: 1px solid var(--line);
      vertical-align: top;
    }
    .num {
      text-align: right;
      white-space: nowrap;
    }
    .rel {
      font-size: 11.5px;
      color: var(--accent-2);
    }
    .used td:first-child {
      box-shadow: inset 3px 0 0 var(--ring);
    }
    .used {
      background: color-mix(in srgb, var(--ring) 5%, transparent);
    }
    .meter {
      display: inline-block;
      width: 44px;
      height: 4px;
      margin-right: 8px;
      border-radius: 2px;
      background: var(--panel-3);
      vertical-align: middle;
      position: relative;
      overflow: hidden;
      &::after {
        content: '';
        position: absolute;
        inset: 0 auto 0 0;
        width: var(--w);
        background: var(--accent);
        border-radius: 2px;
      }
    }
    .empty {
      text-align: center;
      color: var(--faint);
      padding: 24px;
    }
  `,
})
export class FactsTableComponent {
  readonly facts = input.required<Fact[]>();
  readonly onlyUsed = signal(false);
  readonly sort = signal<SortKey>('confidence');
  readonly dir = signal<'asc' | 'desc'>('desc');
  readonly cols: { key: SortKey; label: string }[] = [
    { key: 'subject', label: 'subject' },
    { key: 'relation', label: 'relation' },
    { key: 'object', label: 'object' },
    { key: 'confidence', label: 'confidence' },
  ];

  readonly rows = computed(() => {
    const key = this.sort();
    const mul = this.dir() === 'asc' ? 1 : -1;
    const list = this.facts().filter((f) => !this.onlyUsed() || f.usedInAnswer);
    return [...list].sort((a, b) => {
      // used facts always float to the top, then the chosen column
      const u = Number(b.usedInAnswer) - Number(a.usedInAnswer);
      if (u) return u;
      const av = a[key];
      const bv = b[key];
      return (typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))) * mul;
    });
  });

  sortBy(key: SortKey): void {
    if (this.sort() === key) this.dir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      this.sort.set(key);
      this.dir.set(key === 'confidence' ? 'desc' : 'asc');
    }
  }
}

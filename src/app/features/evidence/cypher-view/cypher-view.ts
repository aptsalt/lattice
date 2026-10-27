import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { ChatResponse } from '../../../core/models';

@Component({
  selector: 'app-cypher-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bar">
      <span class="label">Queries the FastAPI service ran against Neo4j for this turn</span>
      <button class="copy mono" type="button" (click)="copy()">{{ copied() ? 'copied' : 'copy all' }}</button>
    </div>
    @for (q of queries(); track q.title) {
      <section class="q">
        <h4 class="mono">{{ q.title }}</h4>
        <pre class="mono"><code [innerHTML]="q.html"></code></pre>
      </section>
    }
  `,
  styles: `
    :host {
      display: block;
      max-height: 480px;
      overflow: auto;
    }
    .bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      font-size: 12.5px;
      color: var(--muted);
      border-bottom: 1px solid var(--line);
    }
    .copy {
      padding: 3px 8px;
      border-radius: 6px;
      background: var(--panel-3);
      font-size: 11px;
      color: var(--muted);
      &:hover {
        color: var(--text);
      }
    }
    .q {
      padding: 10px 14px;
      border-bottom: 1px solid var(--line);
      &:last-child {
        border-bottom: 0;
      }
    }
    h4 {
      margin: 0 0 6px;
      font-size: 11px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--faint);
    }
    pre {
      margin: 0;
      padding: 10px 12px;
      border-radius: var(--radius-sm);
      background: var(--bg);
      border: 1px solid var(--line);
      font-size: 12px;
      line-height: 1.55;
      overflow-x: auto;
      white-space: pre;
    }
    ::ng-deep .kw {
      color: var(--accent-2);
      font-weight: 600;
    }
    ::ng-deep .fn {
      color: #38bdf8;
    }
    ::ng-deep .str {
      color: var(--ok);
    }
    ::ng-deep .cm {
      color: var(--faint);
      font-style: italic;
    }
  `,
})
export class CypherViewComponent {
  readonly response = input.required<ChatResponse>();
  readonly copied = signal(false);

  readonly queries = computed(() => {
    const steps = this.response().trace.filter((s) => s.cypher);
    return steps.map((s) => ({ title: s.title, raw: s.cypher!, html: highlight(s.cypher!) }));
  });

  async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.queries().map((q) => `// ${q.title}\n${q.raw}`).join('\n\n'));
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1400);
    } catch {
      /* ignore */
    }
  }
}

const KW = /\b(MATCH|WHERE|RETURN|WITH|UNWIND|CALL|YIELD|AS|IN|AND|OR|NOT|ORDER BY|LIMIT|DESC|ASC|IS NULL|OPTIONAL|DISTINCT|collect|true)\b/g;

function highlight(cypher: string): string {
  const esc = cypher.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return esc
    .replace(/(\/\/.*)$/gm, '<span class="cm">$1</span>')
    .replace(/('[^']*')/g, '<span class="str">$1</span>')
    .replace(/\b(apoc\.[a-zA-Z.]+|db\.index\.[a-zA-Z.]+|startNode|endNode|type|labels)\b/g, '<span class="fn">$1</span>')
    .replace(KW, '<span class="kw">$1</span>');
}

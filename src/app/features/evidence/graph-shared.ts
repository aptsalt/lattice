import { SimulationLinkDatum, SimulationNodeDatum } from 'd3-force';
import { LABEL_COLORS } from '../../core/graph-data';
import { SubgraphEdge, SubgraphNode } from '../../core/models';

export interface SimNode extends SubgraphNode, SimulationNodeDatum {}
export interface SimLink extends SimulationLinkDatum<SimNode> {
  id: string;
  relation: SubgraphEdge['relation'];
  confidence: number;
  used: boolean;
}

export const color = (n: Pick<SubgraphNode, 'label'>): string => LABEL_COLORS[n.label];

export const radius = (n: SubgraphNode, degree = 0): number => {
  const base = n.used ? 6.5 : n.seed ? 6 : n.label === 'Rule' || n.label === 'Section' ? 3.6 : 4.4;
  return base + Math.min(2, degree * 0.25);
};

export const shortName = (name: string, max = 24): string => (name.length > max ? name.slice(0, max - 1) + '…' : name);

export const relationLabel = (r: string): string => r.replace(/_/g, ' ').toLowerCase();

/** Lightweight HTML tooltip anchored inside the graph host. */
export class GraphTooltip {
  private readonly el: HTMLDivElement;

  constructor(host: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'graph-tip';
    this.el.hidden = true;
    host.appendChild(this.el);
  }

  show(n: SubgraphNode, x: number, y: number, degree: number): void {
    const props = Object.entries(n.props ?? {})
      .slice(0, 5)
      .map(([k, v]) => `<div class="tip-row"><span>${esc(k)}</span><b>${esc(String(v))}</b></div>`)
      .join('');
    const flags = [n.seed ? 'matched by retrieval' : '', n.used ? 'used in answer' : '', n.hop ? `hop ${n.hop}` : 'seed'].filter(Boolean).join(' · ');
    this.el.innerHTML = `
      <div class="tip-head"><i style="background:${color(n)}"></i><span class="tip-label">${esc(n.label)}</span>${n.country && n.country !== 'GLOBAL' ? `<span class="tip-scope">${esc(n.country)}</span>` : ''}</div>
      <div class="tip-name">${esc(n.name)}</div>
      ${n.summary ? `<div class="tip-summary">${esc(n.summary)}</div>` : ''}
      ${props}
      <div class="tip-foot">${esc(flags)} · ${degree} rel${degree === 1 ? '' : 's'}</div>`;
    this.el.hidden = false;
    this.move(x, y);
  }

  move(x: number, y: number): void {
    const host = this.el.parentElement!;
    const w = this.el.offsetWidth;
    const h = this.el.offsetHeight;
    const left = x + 16 + w > host.clientWidth ? x - w - 12 : x + 16;
    const top = y + 12 + h > host.clientHeight ? Math.max(8, y - h - 8) : y + 12;
    this.el.style.transform = `translate(${left}px, ${top}px)`;
  }

  hide(): void {
    this.el.hidden = true;
  }

  destroy(): void {
    this.el.remove();
  }
}

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Degree map for sizing. */
export function degrees(edges: { source: string; target: string }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of edges) {
    m.set(e.source, (m.get(e.source) ?? 0) + 1);
    m.set(e.target, (m.get(e.target) ?? 0) + 1);
  }
  return m;
}

/** Shared tooltip + graph CSS injected once (variants render outside Angular's view encapsulation). */
export const GRAPH_STYLES = `
  .graph-host { position: absolute; inset: 0; overflow: hidden; cursor: grab; }
  .graph-host:active { cursor: grabbing; }
  .graph-host svg { width: 100%; height: 100%; display: block; }
  .graph-host canvas { width: 100%; height: 100%; display: block; }
  .graph-tip {
    position: absolute; left: 0; top: 0; z-index: 3; max-width: 280px; padding: 10px 12px;
    border-radius: 10px; border: 1px solid var(--line-2); background: color-mix(in srgb, var(--panel-2) 92%, transparent);
    backdrop-filter: blur(10px); box-shadow: var(--shadow); font-size: 12px; color: var(--text); pointer-events: none;
  }
  .graph-tip .tip-head { display: flex; align-items: center; gap: 6px; font-family: var(--mono); font-size: 10.5px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
  .graph-tip .tip-head i { width: 8px; height: 8px; border-radius: 50%; }
  .graph-tip .tip-scope { margin-left: auto; padding: 0 5px; border-radius: 4px; background: var(--panel-3); }
  .graph-tip .tip-name { margin: 4px 0 2px; font-weight: 600; font-size: 13px; }
  .graph-tip .tip-summary { margin: 4px 0 6px; color: var(--muted); line-height: 1.45; }
  .graph-tip .tip-row { display: flex; justify-content: space-between; gap: 12px; font-family: var(--mono); font-size: 11px; color: var(--muted); }
  .graph-tip .tip-row b { color: var(--text); font-weight: 500; text-align: right; }
  .graph-tip .tip-foot { margin-top: 6px; font-family: var(--mono); font-size: 10.5px; color: var(--faint); }
  .graph-host .link { stroke: var(--graph-line); stroke-opacity: .7; fill: none; transition: stroke-opacity 160ms ease; }
  .graph-host .link.used { stroke: var(--accent-2); stroke-opacity: .95; filter: drop-shadow(0 0 3px var(--accent)); }
  .graph-host .link.cross { stroke-dasharray: 3 4; stroke-opacity: .5; }
  .graph-host .link.dim { stroke-opacity: .12; }
  .graph-host .link-label { font: 9.5px var(--mono); fill: var(--muted); text-anchor: middle; pointer-events: none; opacity: 0; transition: opacity 120ms ease; }
  .graph-host .link-label.show { opacity: 1; }
  .graph-host .node { cursor: pointer; }
  .graph-host .node circle.body { stroke: none; filter: drop-shadow(0 0 3px currentColor) drop-shadow(0 0 7px currentColor); transition: opacity 160ms ease; }
  .graph-host .node circle.ring { fill: none; stroke: var(--ring); stroke-width: 1.8px; filter: drop-shadow(0 0 4px var(--ring)); }
  .graph-host .node circle.halo { fill: var(--ring); opacity: .1; }
  .graph-host .node circle.seed { fill: none; stroke: var(--accent-2); stroke-width: 1.5px; stroke-dasharray: 2 3; }
  .graph-host .node text { font: 500 10px var(--sans); fill: var(--text); paint-order: stroke; stroke: var(--graph-bg); stroke-width: 3px; stroke-linejoin: round; pointer-events: none; }
  .graph-host .node.minor text { fill: var(--muted); font-size: 9px; font-weight: 400; }
  .graph-host .node.dim { opacity: .18; }
  .graph-host .node.hover circle.body { stroke: var(--text); }
  .graph-host .node.selected circle.body { stroke: var(--accent-2); stroke-width: 2.5px; }
  .graph-host .node.pinned text { text-decoration: underline dotted; }
  .graph-host .hint { position: absolute; right: 12px; top: 10px; font: 10.5px var(--mono); color: var(--faint); pointer-events: none; }
`;

let injected = false;
export function ensureGraphStyles(): void {
  if (injected) return;
  injected = true;
  const style = document.createElement('style');
  style.textContent = GRAPH_STYLES;
  document.head.appendChild(style);
}

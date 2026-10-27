import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { drag } from 'd3-drag';
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, Simulation } from 'd3-force';
import { select, Selection } from 'd3-selection';
import 'd3-transition';
import { zoom, zoomIdentity } from 'd3-zoom';
import { Subgraph } from '../../../core/models';
import { GraphTooltip, SimLink, SimNode, color, degrees, ensureGraphStyles, radius, relationLabel, shortName } from '../graph-shared';

/**
 * Force-directed subgraph (the Streamlit parity view, polished):
 * yellow ring = used in answer, dashed ring = retrieval seed, drag to pin,
 * double-click to unpin, scroll to zoom, hover for properties + edge labels.
 */
@Component({
  selector: 'app-graph-force',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="graph-host" #host><svg></svg><span class="hint">drag · pin · scroll</span></div>`,
})
export class GraphForceComponent {
  readonly subgraph = input.required<Subgraph>();
  readonly focusUsed = input(false);
  /** When set, only these ids are lit (used by the Replay variant). */
  readonly visible = input<ReadonlySet<string> | null>(null);
  readonly selected = output<string | null>();

  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private readonly destroyRef = inject(DestroyRef);
  private sim?: Simulation<SimNode, SimLink>;
  private tip?: GraphTooltip;
  private nodeSel?: Selection<SVGGElement, SimNode, SVGGElement, unknown>;
  private linkSel?: Selection<SVGLineElement, SimLink, SVGGElement, unknown>;
  private labelSel?: Selection<SVGTextElement, SimLink, SVGGElement, unknown>;
  private selectedId: string | null = null;
  private hoverId: string | null = null;
  private ro?: ResizeObserver;

  constructor() {
    ensureGraphStyles();
    afterNextRender(() => this.build());
    effect(() => {
      // re-apply dimming when focus/visible change
      this.focusUsed();
      this.visible();
      this.applyClasses();
    });
    this.destroyRef.onDestroy(() => {
      this.sim?.stop();
      this.tip?.destroy();
      this.ro?.disconnect();
    });
  }

  private build(): void {
    const hostEl = this.host().nativeElement;
    const svg = select(hostEl.querySelector('svg')!);
    svg.selectAll('*').remove();
    const w = hostEl.clientWidth || 800;
    const h = hostEl.clientHeight || 440;
    this.tip = new GraphTooltip(hostEl);

    const g = this.subgraph();
    const deg = degrees(g.edges);
    const nodes: SimNode[] = g.nodes.map((n) => ({ ...n }));
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const links: SimLink[] = g.edges
      .filter((e) => byId.has(e.source) && byId.has(e.target))
      .map((e) => ({ id: e.id, source: e.source, target: e.target, relation: e.relation, confidence: e.confidence, used: e.used }));

    // seeds start near the centre so the answer cluster forms in the middle
    for (const n of nodes) {
      const a = Math.random() * Math.PI * 2;
      const r = n.seed ? 20 : n.used ? 60 : 140 + n.hop * 40;
      n.x = w / 2 + Math.cos(a) * r;
      n.y = h / 2 + Math.sin(a) * r;
    }

    const root = svg.append('g');
    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.35, 3])
      .on('zoom', (ev) => root.attr('transform', ev.transform));
    svg.call(zoomBehavior).on('dblclick.zoom', null);
    svg.on('click', (ev: MouseEvent) => {
      if ((ev.target as Element).tagName === 'svg') this.select(null);
    });

    this.linkSel = root
      .append('g')
      .selectAll<SVGLineElement, SimLink>('line')
      .data(links)
      .join('line')
      .attr('class', (d) => `link${d.used ? ' used' : ''}`)
      .attr('stroke-width', (d) => (d.used ? 1.8 : 1 + d.confidence * 0.4));

    this.labelSel = root
      .append('g')
      .selectAll<SVGTextElement, SimLink>('text')
      .data(links)
      .join('text')
      .attr('class', 'link-label')
      .text((d) => relationLabel(d.relation));

    const self = this;
    this.nodeSel = root
      .append('g')
      .selectAll<SVGGElement, SimNode>('g')
      .data(nodes, (d) => d.id)
      .join('g')
      .attr('class', (d) => `node${d.hop >= 2 && !d.used ? ' minor' : ''}`)
      .call(
        drag<SVGGElement, SimNode>()
          .on('start', (ev, d) => {
            if (!ev.active) self.sim?.alphaTarget(0.25).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (ev, d) => {
            d.fx = ev.x;
            d.fy = ev.y;
            self.tip?.hide();
          })
          .on('end', (ev, d) => {
            if (!ev.active) self.sim?.alphaTarget(0);
            // stays pinned where dropped; double-click releases
            select(ev.sourceEvent.target.closest('g')).classed('pinned', true);
            d.fx = d.x;
            d.fy = d.y;
          }),
      )
      .on('dblclick', (ev, d) => {
        ev.stopPropagation();
        d.fx = null;
        d.fy = null;
        select(ev.currentTarget as SVGGElement).classed('pinned', false);
        this.sim?.alpha(0.3).restart();
      })
      .on('mouseenter', (ev: MouseEvent, d) => {
        this.hoverId = d.id;
        this.tip?.show(d, ...this.rel(ev), deg.get(d.id) ?? 0);
        this.applyClasses();
      })
      .on('mousemove', (ev: MouseEvent) => this.tip?.move(...this.rel(ev)))
      .on('mouseleave', () => {
        this.hoverId = null;
        this.tip?.hide();
        this.applyClasses();
      })
      .on('click', (ev, d) => {
        ev.stopPropagation();
        this.select(this.selectedId === d.id ? null : d.id);
      });

    this.nodeSel.filter((d) => d.used).append('circle').attr('class', 'halo').attr('r', (d) => radius(d, deg.get(d.id)) + 9);
    this.nodeSel
      .append('circle')
      .attr('class', 'body')
      .attr('r', (d) => radius(d, deg.get(d.id)))
      .attr('fill', (d) => color(d))
      .attr('color', (d) => color(d));
    this.nodeSel.filter((d) => d.used).append('circle').attr('class', 'ring').attr('r', (d) => radius(d, deg.get(d.id)) + 4);
    this.nodeSel.filter((d) => d.seed && !d.used).append('circle').attr('class', 'seed').attr('r', (d) => radius(d, deg.get(d.id)) + 4);
    this.nodeSel
      .append('text')
      .attr('dx', (d) => radius(d, deg.get(d.id)) + 6)
      .attr('dy', 4)
      .text((d) => shortName(d.name));

    // labels sit to the right of each node, so collision radius grows with label length
    const labelPad = (d: SimNode): number => Math.min(60, shortName(d.name).length * 2.6);
    this.sim = forceSimulation<SimNode>(nodes)
      .force('link', forceLink<SimNode, SimLink>(links).id((d) => d.id).distance((l) => (l.used ? 90 : 120)).strength(0.5))
      .force('charge', forceManyBody().strength(-330).distanceMax(380))
      .force('collide', forceCollide<SimNode>().radius((d) => radius(d, deg.get(d.id)) + 10 + labelPad(d) * 0.45).strength(0.9))
      .force('center', forceCenter(w / 2, h / 2 - 16))
      .force('x', forceX<SimNode>(w / 2).strength((d) => (d.used ? 0.07 : 0.025)))
      .force('y', forceY<SimNode>(h / 2 - 16).strength((d) => (d.used ? 0.07 : 0.025)))
      .alpha(1)
      .alphaDecay(0.035)
      .on('tick', () => {
        this.tick();
        // early fit once the layout is mostly stable, final fit when it stops
        if (!fitted && (this.sim?.alpha() ?? 1) < 0.2) {
          fitted = true;
          fit();
        }
      })
      .on('end', () => fit());

    // fit the settled layout into the panel (and again on background double-click)
    let fitted = false;
    const fit = (): void => {
      const xs = nodes.map((n) => n.x ?? 0);
      const ys = nodes.map((n) => n.y ?? 0);
      const pad = 48;
      const bw = Math.max(1, Math.max(...xs) - Math.min(...xs) + pad * 2 + 90);
      const bh = Math.max(1, Math.max(...ys) - Math.min(...ys) + pad * 2);
      const cw = hostEl.clientWidth || w;
      const ch = hostEl.clientHeight || h;
      const k = Math.min(1.15, cw / bw, ch / bh);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2 + 30;
      const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      svg.transition().duration(500).call(zoomBehavior.transform, zoomIdentity.translate(cw / 2 - cx * k, ch / 2 - cy * k).scale(k));
    };
    svg.on('dblclick', (ev: MouseEvent) => {
      if ((ev.target as Element).tagName === 'svg') fit();
    });

    this.applyClasses();

    // keep the graph centred when the panel resizes
    this.ro = new ResizeObserver(() => {
      const nw = hostEl.clientWidth;
      const nh = hostEl.clientHeight;
      if (!nw || !nh) return;
      this.sim?.force('center', forceCenter(nw / 2, nh / 2)).alpha(0.2).restart();
      svg.call(zoomBehavior.transform, zoomIdentity);
    });
    this.ro.observe(hostEl);
  }

  private tick(): void {
    this.linkSel
      ?.attr('x1', (d) => (d.source as SimNode).x!)
      .attr('y1', (d) => (d.source as SimNode).y!)
      .attr('x2', (d) => (d.target as SimNode).x!)
      .attr('y2', (d) => (d.target as SimNode).y!);
    this.labelSel
      ?.attr('x', (d) => ((d.source as SimNode).x! + (d.target as SimNode).x!) / 2)
      .attr('y', (d) => ((d.source as SimNode).y! + (d.target as SimNode).y!) / 2 - 4);
    this.nodeSel?.attr('transform', (d) => `translate(${d.x},${d.y})`);
  }

  private rel(ev: MouseEvent): [number, number] {
    const r = this.host().nativeElement.getBoundingClientRect();
    return [ev.clientX - r.left, ev.clientY - r.top];
  }

  private select(id: string | null): void {
    this.selectedId = id;
    this.selected.emit(id);
    this.applyClasses();
  }

  private applyClasses(): void {
    if (!this.nodeSel || !this.linkSel) return;
    const focus = this.focusUsed();
    const vis = this.visible();
    const hover = this.hoverId;
    const sel = this.selectedId;
    const neighbours = new Set<string>();
    const anchor = hover ?? sel;
    if (anchor) {
      this.linkSel.each((l) => {
        const s = (l.source as SimNode).id;
        const t = (l.target as SimNode).id;
        if (s === anchor) neighbours.add(t);
        if (t === anchor) neighbours.add(s);
      });
      neighbours.add(anchor);
    }
    const lit = (id: string, used: boolean): boolean => {
      if (vis && !vis.has(id)) return false;
      if (anchor) return neighbours.has(id);
      if (focus) return used;
      return true;
    };
    this.nodeSel
      .classed('dim', (d) => !lit(d.id, d.used))
      .classed('hover', (d) => d.id === hover)
      .classed('selected', (d) => d.id === sel);
    this.linkSel.classed('dim', (l) => {
      const s = (l.source as SimNode).id;
      const t = (l.target as SimNode).id;
      if (vis) return !(vis.has(s) && vis.has(t));
      if (anchor) return !(s === anchor || t === anchor);
      if (focus) return !l.used;
      return false;
    });
    this.labelSel?.classed('show', (l) => {
      const s = (l.source as SimNode).id;
      const t = (l.target as SimNode).id;
      return !!anchor && (s === anchor || t === anchor);
    });
  }
}

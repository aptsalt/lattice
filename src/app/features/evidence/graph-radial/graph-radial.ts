import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, effect, inject, input, output, viewChild } from '@angular/core';
import { hierarchy, tree, HierarchyPointNode } from 'd3-hierarchy';
import { select, Selection } from 'd3-selection';
import { zoom } from 'd3-zoom';
import { Relation, Subgraph, SubgraphNode } from '../../../core/models';
import { GraphTooltip, color, degrees, ensureGraphStyles, radius, relationLabel, shortName } from '../graph-shared';

interface TreeDatum {
  node: SubgraphNode;
  children: TreeDatum[];
  via?: Relation;
}

/** Which relation direction counts as parent → child when building the taxonomy tree. */
const DOWN: Relation[] = ['HAS_POLICY', 'COVERS', 'HAS_RULE', 'GOVERNED_BY', 'APPLIES_TO', 'APPROVED_BY', 'OVERRIDES'];
const UP: Relation[] = ['PART_OF', 'INHERITS_FROM'];
const LABEL_RANK: Record<string, number> = { Region: 0, Country: 1, Policy: 2, LeaveType: 3, Rule: 4, Regulation: 5, Approver: 5, EmployeeType: 5, Section: 6 };

/**
 * Radial taxonomy: the geography/policy hierarchy drawn as a tree from the
 * World (or the broadest node present) outward, so the inheritance chain
 * World → North America → Country → Policy → Leave type → Rule reads at once.
 * Edges that are not part of the spanning tree are drawn dashed.
 */
@Component({
  selector: 'app-graph-radial',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="graph-host" #host><svg></svg><span class="hint">radial tree · dashed = cross-link</span></div>`,
})
export class GraphRadialComponent {
  readonly subgraph = input.required<Subgraph>();
  readonly focusUsed = input(false);
  readonly selected = output<string | null>();

  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private readonly destroyRef = inject(DestroyRef);
  private tip?: GraphTooltip;
  private nodeSel?: Selection<SVGGElement, HierarchyPointNode<TreeDatum>, SVGGElement, unknown>;
  private linkSel?: Selection<SVGPathElement, HierarchyPointNode<TreeDatum>, SVGGElement, unknown>;
  private crossSel?: Selection<SVGPathElement, { s: HierarchyPointNode<TreeDatum>; t: HierarchyPointNode<TreeDatum>; used: boolean }, SVGGElement, unknown>;
  private hoverId: string | null = null;
  private selectedId: string | null = null;

  constructor() {
    ensureGraphStyles();
    afterNextRender(() => this.build());
    effect(() => {
      this.focusUsed();
      this.applyClasses();
    });
    this.destroyRef.onDestroy(() => this.tip?.destroy());
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
    const byId = new Map(g.nodes.map((n) => [n.id, n]));

    // choose the root: World if present, else the broadest label with the highest degree
    const root =
      byId.get('world') ??
      [...g.nodes].sort((a, b) => LABEL_RANK[a.label] - LABEL_RANK[b.label] || (deg.get(b.id) ?? 0) - (deg.get(a.id) ?? 0))[0];
    const data = buildTree(root, g, byId);
    const hroot = hierarchy<TreeDatum>(data, (d) => d.children);
    // leave room for the rotated leaf labels outside the outer ring
    const R = Math.max(90, Math.min(w, h) / 2 - 92);
    const layout = tree<TreeDatum>()
      .size([2 * Math.PI, R])
      .separation((a, b) => (a.parent === b.parent ? 1 : 1.6) / Math.max(1, a.depth));
    const laid = layout(hroot);
    const pos = new Map<string, HierarchyPointNode<TreeDatum>>();
    laid.each((d) => pos.set(d.data.node.id, d));

    const container = svg.append('g');
    const inner = container.append('g').attr('transform', `translate(${w / 2},${h / 2})`);
    svg.call(
      zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.4, 3])
        .on('zoom', (ev) => container.attr('transform', ev.transform)),
    ).on('dblclick.zoom', null);
    svg.on('click', (ev: MouseEvent) => {
      if ((ev.target as Element).tagName === 'svg') this.select(null);
    });

    const toXY = (d: HierarchyPointNode<TreeDatum>): [number, number] => [Math.cos(d.x - Math.PI / 2) * d.y, Math.sin(d.x - Math.PI / 2) * d.y];
    const radialPath = (a: HierarchyPointNode<TreeDatum>, b: HierarchyPointNode<TreeDatum>): string => {
      const [x0, y0] = toXY(a);
      const [x1, y1] = toXY(b);
      const mr = (a.y + b.y) / 2;
      const [cx0, cy0] = [Math.cos(a.x - Math.PI / 2) * mr, Math.sin(a.x - Math.PI / 2) * mr];
      const [cx1, cy1] = [Math.cos(b.x - Math.PI / 2) * mr, Math.sin(b.x - Math.PI / 2) * mr];
      return `M${x0},${y0}C${cx0},${cy0} ${cx1},${cy1} ${x1},${y1}`;
    };

    // tree links
    this.linkSel = inner
      .append('g')
      .selectAll<SVGPathElement, HierarchyPointNode<TreeDatum>>('path')
      .data(laid.descendants().slice(1))
      .join('path')
      .attr('class', (d) => `link${d.data.node.used && d.parent!.data.node.used ? ' used' : ''}`)
      .attr('stroke-width', (d) => (d.data.node.used ? 1.8 : 1))
      .attr('d', (d) => radialPath(d.parent!, d));

    // cross-links (edges not in the spanning tree)
    const treePairs = new Set(laid.descendants().slice(1).map((d) => key(d.parent!.data.node.id, d.data.node.id)));
    const cross = g.edges
      .filter((e) => pos.has(e.source) && pos.has(e.target) && !treePairs.has(key(e.source, e.target)))
      .map((e) => ({ s: pos.get(e.source)!, t: pos.get(e.target)!, used: e.used }));
    this.crossSel = inner
      .append('g')
      .selectAll<SVGPathElement, (typeof cross)[number]>('path')
      .data(cross)
      .join('path')
      .attr('class', (d) => `link cross${d.used ? ' used' : ''}`)
      .attr('d', (d) => {
        const [x0, y0] = toXY(d.s);
        const [x1, y1] = toXY(d.t);
        return `M${x0},${y0}Q0,0 ${x1},${y1}`;
      });

    // ring guides per depth
    const depths = new Set(laid.descendants().map((d) => d.y));
    inner
      .append('g')
      .selectAll('circle')
      .data([...depths].filter((r) => r > 0))
      .join('circle')
      .attr('r', (r) => r)
      .attr('fill', 'none')
      .attr('stroke', 'var(--line)')
      .attr('stroke-dasharray', '2 6');

    this.nodeSel = inner
      .append('g')
      .selectAll<SVGGElement, HierarchyPointNode<TreeDatum>>('g')
      .data(laid.descendants())
      .join('g')
      .attr('class', (d) => `node${d.depth >= 4 && !d.data.node.used ? ' minor' : ''}`)
      .attr('transform', (d) => {
        const [x, y] = toXY(d);
        return `translate(${x},${y})`;
      })
      .on('mouseenter', (ev: MouseEvent, d) => {
        this.hoverId = d.data.node.id;
        this.tip?.show(d.data.node, ...this.rel(ev), deg.get(d.data.node.id) ?? 0);
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
        this.select(this.selectedId === d.data.node.id ? null : d.data.node.id);
      });

    this.nodeSel.filter((d) => d.data.node.used).append('circle').attr('class', 'halo').attr('r', (d) => radius(d.data.node) + 8);
    this.nodeSel
      .append('circle')
      .attr('class', 'body')
      .attr('r', (d) => radius(d.data.node))
      .attr('fill', (d) => color(d.data.node));
    this.nodeSel.filter((d) => d.data.node.used).append('circle').attr('class', 'ring').attr('r', (d) => radius(d.data.node) + 4);
    this.nodeSel.filter((d) => d.data.node.seed && !d.data.node.used).append('circle').attr('class', 'seed').attr('r', (d) => radius(d.data.node) + 4);
    this.nodeSel
      .append('text')
      .attr('dy', 4)
      .attr('x', (d) => (d.depth === 0 ? 0 : d.x < Math.PI ? radius(d.data.node) + 6 : -(radius(d.data.node) + 6)))
      .attr('text-anchor', (d) => (d.depth === 0 ? 'middle' : d.x < Math.PI ? 'start' : 'end'))
      .attr('transform', (d) => (d.depth === 0 ? 'translate(0,-16)' : `rotate(${((d.x - Math.PI / 2) * 180) / Math.PI + (d.x < Math.PI ? 0 : 180)})`))
      .text((d) => shortName(d.data.node.name, 26));

    // relation labels on the tree links on hover
    inner
      .append('g')
      .selectAll<SVGTextElement, HierarchyPointNode<TreeDatum>>('text')
      .data(laid.descendants().slice(1))
      .join('text')
      .attr('class', 'link-label')
      .attr('transform', (d) => {
        const [x0, y0] = toXY(d.parent!);
        const [x1, y1] = toXY(d);
        return `translate(${(x0 + x1) / 2},${(y0 + y1) / 2 - 4})`;
      })
      .text((d) => (d.data.via ? relationLabel(d.data.via) : ''));

    this.applyClasses();
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
    const anchor = this.hoverId ?? this.selectedId;
    const related = new Set<string>();
    if (anchor) {
      related.add(anchor);
      for (const e of this.subgraph().edges) {
        if (e.source === anchor) related.add(e.target);
        if (e.target === anchor) related.add(e.source);
      }
    }
    const lit = (n: SubgraphNode): boolean => (anchor ? related.has(n.id) : focus ? n.used : true);
    this.nodeSel
      .classed('dim', (d) => !lit(d.data.node))
      .classed('hover', (d) => d.data.node.id === this.hoverId)
      .classed('selected', (d) => d.data.node.id === this.selectedId);
    this.linkSel.classed('dim', (d) => !(lit(d.data.node) && lit(d.parent!.data.node)));
    this.crossSel?.classed('dim', (d) => !(lit(d.s.data.node) && lit(d.t.data.node)));
    select(this.host().nativeElement)
      .selectAll<SVGTextElement, HierarchyPointNode<TreeDatum>>('.link-label')
      .classed('show', (d) => !!anchor && (d.data.node.id === anchor || d.parent?.data.node.id === anchor));
  }
}

const key = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

function buildTree(root: SubgraphNode, g: Subgraph, byId: Map<string, SubgraphNode>): TreeDatum {
  const placed = new Set<string>([root.id]);
  const rootDatum: TreeDatum = { node: root, children: [] };
  const queue: TreeDatum[] = [rootDatum];
  while (queue.length) {
    const cur = queue.shift()!;
    const kids: { node: SubgraphNode; via: Relation }[] = [];
    for (const e of g.edges) {
      if (e.source === cur.node.id && DOWN.includes(e.relation) && !placed.has(e.target)) kids.push({ node: byId.get(e.target)!, via: e.relation });
      if (e.target === cur.node.id && UP.includes(e.relation) && !placed.has(e.source)) kids.push({ node: byId.get(e.source)!, via: e.relation });
    }
    // deterministic ordering: used first, then by label rank, then name
    kids.sort((a, b) => Number(b.node.used) - Number(a.node.used) || LABEL_RANK[a.node.label] - LABEL_RANK[b.node.label] || a.node.name.localeCompare(b.node.name));
    for (const k of kids) {
      if (placed.has(k.node.id)) continue;
      placed.add(k.node.id);
      const d: TreeDatum = { node: k.node, children: [], via: k.via };
      cur.children.push(d);
      queue.push(d);
    }
  }
  // anything unreachable through the taxonomy directions hangs off whatever it touches, else the root
  for (const n of g.nodes) {
    if (placed.has(n.id)) continue;
    const e = g.edges.find((x) => (x.source === n.id && placed.has(x.target)) || (x.target === n.id && placed.has(x.source)));
    const parentId = e ? (e.source === n.id ? e.target : e.source) : root.id;
    const parent = find(rootDatum, parentId) ?? rootDatum;
    parent.children.push({ node: n, children: [], via: e?.relation });
    placed.add(n.id);
  }
  return rootDatum;
}

function find(d: TreeDatum, id: string): TreeDatum | null {
  if (d.node.id === id) return d;
  for (const c of d.children) {
    const f = find(c, id);
    if (f) return f;
  }
  return null;
}

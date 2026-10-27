import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, inject, input, output, viewChild } from '@angular/core';
import { Subgraph, SubgraphNode } from '../../../core/models';
import { GraphTooltip, color, degrees, ensureGraphStyles, radius, shortName } from '../graph-shared';

interface OrbitNode {
  n: SubgraphNode;
  x: number;
  y: number;
  z: number;
  // projected
  px: number;
  py: number;
  depth: number;
  scale: number;
}

/**
 * Orbit: a zero-dependency 3D projection on canvas, after the Claude dashboard
 * ecosystem view. Seeds sit at the origin, each hop is a shell further out,
 * the whole cloud rotates slowly; used nodes glow. Drag to rotate, scroll to
 * zoom, hover for details.
 */
@Component({
  selector: 'app-graph-orbit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="graph-host" #host><canvas></canvas><span class="hint">drag to rotate · scroll to zoom</span></div>`,
})
export class GraphOrbitComponent {
  readonly subgraph = input.required<Subgraph>();
  readonly focusUsed = input(false);
  readonly selected = output<string | null>();

  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private readonly destroyRef = inject(DestroyRef);
  private raf = 0;
  private tip?: GraphTooltip;
  private nodes: OrbitNode[] = [];
  private edges: { a: OrbitNode; b: OrbitNode; used: boolean }[] = [];
  private rotY = 0;
  private rotX = -0.25;
  private zoom = 1;
  private auto = true;
  private dragging = false;
  private last = { x: 0, y: 0 };
  private hover: OrbitNode | null = null;
  private selectedId: string | null = null;
  private ro?: ResizeObserver;

  constructor() {
    ensureGraphStyles();
    afterNextRender(() => this.build());
    this.destroyRef.onDestroy(() => {
      cancelAnimationFrame(this.raf);
      this.tip?.destroy();
      this.ro?.disconnect();
    });
  }

  private build(): void {
    const hostEl = this.host().nativeElement;
    const canvas = hostEl.querySelector('canvas')!;
    const ctx = canvas.getContext('2d')!;
    this.tip = new GraphTooltip(hostEl);
    const g = this.subgraph();
    const deg = degrees(g.edges);

    // layout: shells by hop, golden-spiral on each sphere so points spread evenly
    const byHop = new Map<number, SubgraphNode[]>();
    for (const n of g.nodes) (byHop.get(n.hop) ?? byHop.set(n.hop, []).get(n.hop)!).push(n);
    const byId = new Map<string, OrbitNode>();
    for (const [hop, list] of byHop) {
      // the seed core grows with the number of seeds so ten seeds never share one point
      const shell = hop === 0 ? 24 + list.length * 5 : 110 + hop * 65;
      list.forEach((n, i) => {
        const k = list.length;
        const y = k === 1 ? 0 : 1 - (i / (k - 1)) * 2;
        const r = Math.sqrt(1 - y * y);
        const theta = i * 2.399963; // golden angle
        const on: OrbitNode = { n, x: Math.cos(theta) * r * shell, y: y * shell * 0.75, z: Math.sin(theta) * r * shell, px: 0, py: 0, depth: 0, scale: 1 };
        this.nodes.push(on);
        byId.set(n.id, on);
      });
    }
    this.edges = g.edges.filter((e) => byId.has(e.source) && byId.has(e.target)).map((e) => ({ a: byId.get(e.source)!, b: byId.get(e.target)!, used: e.used }));

    const resize = (): void => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = hostEl.clientWidth * dpr;
      canvas.height = hostEl.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    this.ro = new ResizeObserver(resize);
    this.ro.observe(hostEl);

    // interaction
    hostEl.addEventListener('mousedown', (ev) => {
      this.dragging = true;
      this.auto = false;
      this.last = { x: ev.clientX, y: ev.clientY };
    });
    const up = (): void => {
      this.dragging = false;
    };
    window.addEventListener('mouseup', up);
    this.destroyRef.onDestroy(() => window.removeEventListener('mouseup', up));
    hostEl.addEventListener('mousemove', (ev) => {
      if (this.dragging) {
        this.rotY += (ev.clientX - this.last.x) * 0.008;
        this.rotX = Math.max(-1.2, Math.min(1.2, this.rotX + (ev.clientY - this.last.y) * 0.006));
        this.last = { x: ev.clientX, y: ev.clientY };
        this.tip?.hide();
        this.hover = null;
        return;
      }
      const r = hostEl.getBoundingClientRect();
      const mx = ev.clientX - r.left;
      const my = ev.clientY - r.top;
      let best: OrbitNode | null = null;
      let bd = 14;
      for (const n of this.nodes) {
        const d = Math.hypot(n.px - mx, n.py - my);
        if (d < bd) {
          bd = d;
          best = n;
        }
      }
      if (best !== this.hover) {
        this.hover = best;
        if (best) this.tip?.show(best.n, mx, my, deg.get(best.n.id) ?? 0);
        else this.tip?.hide();
      } else if (best) this.tip?.move(mx, my);
    });
    hostEl.addEventListener('mouseleave', () => {
      this.hover = null;
      this.tip?.hide();
    });
    hostEl.addEventListener('click', () => {
      const id = this.hover?.n.id ?? null;
      this.selectedId = this.selectedId === id ? null : id;
      this.selected.emit(this.selectedId);
    });
    hostEl.addEventListener(
      'wheel',
      (ev) => {
        ev.preventDefault();
        this.zoom = Math.max(0.5, Math.min(2.4, this.zoom * (ev.deltaY > 0 ? 0.92 : 1.08)));
      },
      { passive: false },
    );
    hostEl.addEventListener('dblclick', () => (this.auto = !this.auto));

    const frame = (): void => {
      this.draw(ctx, hostEl.clientWidth, hostEl.clientHeight);
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  private project(w: number, h: number): void {
    const cy = Math.cos(this.rotY);
    const sy = Math.sin(this.rotY);
    const cx = Math.cos(this.rotX);
    const sx = Math.sin(this.rotX);
    const focal = 520;
    for (const n of this.nodes) {
      // rotate around Y then X
      const x1 = n.x * cy - n.z * sy;
      const z1 = n.x * sy + n.z * cy;
      const y2 = n.y * cx - z1 * sx;
      const z2 = n.y * sx + z1 * cx;
      const s = (focal / (focal + z2)) * this.zoom;
      n.scale = s;
      n.depth = z2;
      n.px = w / 2 + x1 * s;
      n.py = h / 2 + y2 * s;
    }
  }

  private draw(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (this.auto && !this.dragging) this.rotY += 0.0035;
    this.project(w, h);
    ctx.clearRect(0, 0, w, h);

    const css = getComputedStyle(this.host().nativeElement);
    const textColor = css.getPropertyValue('--text').trim();
    const mutedColor = css.getPropertyValue('--muted').trim();
    const ring = css.getPropertyValue('--ring').trim();
    const accent = css.getPropertyValue('--accent').trim();
    const lineColor = css.getPropertyValue('--line-2').trim();
    const focus = this.focusUsed();
    const anchor = this.hover?.n.id ?? this.selectedId;
    const near = new Set<string>();
    if (anchor) {
      near.add(anchor);
      for (const e of this.edges) {
        if (e.a.n.id === anchor) near.add(e.b.n.id);
        if (e.b.n.id === anchor) near.add(e.a.n.id);
      }
    }
    const lit = (n: SubgraphNode): boolean => (anchor ? near.has(n.id) : focus ? n.used : true);

    // concentric shell guides
    ctx.save();
    ctx.strokeStyle = lineColor;
    ctx.setLineDash([2, 6]);
    for (const r of [70, 140, 210]) {
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2, r * this.zoom, r * this.zoom * Math.abs(Math.sin(this.rotX)) + 6, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // edges (back to front by average depth)
    const edges = [...this.edges].sort((p, q) => q.a.depth + q.b.depth - (p.a.depth + p.b.depth));
    for (const e of edges) {
      const on = lit(e.a.n) && lit(e.b.n);
      const depthAlpha = 0.25 + 0.75 * (1 - Math.min(1, Math.max(0, (e.a.depth + e.b.depth) / 2 + 240) / 480));
      ctx.globalAlpha = (on ? 1 : 0.12) * depthAlpha;
      ctx.strokeStyle = e.used ? accent : lineColor;
      ctx.lineWidth = e.used ? 1.6 : 1;
      ctx.beginPath();
      ctx.moveTo(e.a.px, e.a.py);
      ctx.lineTo(e.b.px, e.b.py);
      ctx.stroke();
    }

    // nodes back to front
    const nodes = [...this.nodes].sort((p, q) => q.depth - p.depth);
    for (const o of nodes) {
      const n = o.n;
      const r = radius(n) * o.scale;
      const on = lit(n);
      const alpha = on ? 0.55 + 0.45 * Math.min(1, o.scale) : 0.12;
      ctx.globalAlpha = alpha;
      if (n.used && on) {
        const glow = ctx.createRadialGradient(o.px, o.py, r, o.px, o.py, r * 3.2);
        glow.addColorStop(0, ring + '55');
        glow.addColorStop(1, ring + '00');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(o.px, o.py, r * 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = color(n);
      ctx.beginPath();
      ctx.arc(o.px, o.py, r, 0, Math.PI * 2);
      ctx.fill();
      if (n.used) {
        ctx.strokeStyle = ring;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(o.px, o.py, r + 3.5, 0, Math.PI * 2);
        ctx.stroke();
      } else if (n.seed) {
        ctx.strokeStyle = accent;
        ctx.setLineDash([2, 3]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(o.px, o.py, r + 3.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (o === this.hover || n.id === this.selectedId) {
        ctx.strokeStyle = textColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(o.px, o.py, r + 1.5, 0, Math.PI * 2);
        ctx.stroke();
      }
      const showLabel = n.used || n.seed || o === this.hover || (n.hop <= 1 && o.scale > 1.02) || o.scale > 1.18;
      if (showLabel && on) {
        ctx.font = `${n.used ? 500 : 400} ${(n.used ? 11 : 10) * Math.max(0.8, Math.min(1.2, o.scale))}px Inter, sans-serif`;
        ctx.fillStyle = n.used || n.seed ? textColor : mutedColor;
        ctx.textBaseline = 'middle';
        ctx.fillText(shortName(n.name, 22), o.px + r + 6, o.py);
      }
    }
    ctx.globalAlpha = 1;
  }
}

import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, effect, inject, input, output, viewChild } from '@angular/core';
import ForceGraph3D, { ForceGraph3DInstance } from '3d-force-graph';
import { Group, Mesh, MeshBasicMaterial, MeshLambertMaterial, SphereGeometry, TorusGeometry } from 'three';
import SpriteText from 'three-spritetext';
import { Subgraph, SubgraphNode } from '../../../core/models';
import { GraphTooltip, color, degrees, ensureGraphStyles, radius, shortName } from '../graph-shared';

interface N3 extends SubgraphNode {
  x?: number;
  y?: number;
  z?: number;
}
interface L3 {
  source: string | N3;
  target: string | N3;
  relation: string;
  used: boolean;
}

interface NodeParts {
  body: MeshLambertMaterial;
  ring?: MeshBasicMaterial;
  label?: SpriteText;
}

/**
 * 3D: a WebGL force graph (three.js via 3d-force-graph). Used nodes carry a
 * torus ring and a sprite label; used edges run directional particles so
 * the grounding path is visible from any angle. Click a node to fly to it.
 */
@Component({
  selector: 'app-graph-three',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="graph-host" #host></div><span class="hint3d mono">drag to orbit · scroll to zoom · click a node to fly to it</span>`,
  styles: `
    :host {
      display: block;
      position: absolute;
      inset: 0;
    }
    .hint3d {
      position: absolute;
      right: 12px;
      top: 10px;
      font-size: 10.5px;
      color: var(--faint);
      pointer-events: none;
    }
  `,
})
export class GraphThreeComponent {
  readonly subgraph = input.required<Subgraph>();
  readonly focusUsed = input(false);
  readonly selected = output<string | null>();

  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private readonly destroyRef = inject(DestroyRef);
  private graph?: ForceGraph3DInstance<N3, L3>;
  private tip?: GraphTooltip;
  private parts = new Map<string, NodeParts>();
  private hoverId: string | null = null;
  private selectedId: string | null = null;
  private mouse = { x: 0, y: 0 };
  private ro?: ResizeObserver;

  constructor() {
    ensureGraphStyles();
    afterNextRender(() => this.build());
    effect(() => {
      this.focusUsed();
      this.applyFocus();
    });
    this.destroyRef.onDestroy(() => {
      this.graph?._destructor();
      this.tip?.destroy();
      this.ro?.disconnect();
    });
  }

  private build(): void {
    const hostEl = this.host().nativeElement;
    this.tip = new GraphTooltip(hostEl);
    const g = this.subgraph();
    const deg = degrees(g.edges);
    const dark = document.documentElement.dataset['theme'] !== 'light';
    const css = getComputedStyle(hostEl);
    const accent = css.getPropertyValue('--accent').trim() || '#8d7dff';
    const ring = css.getPropertyValue('--ring').trim() || '#ffd166';
    const text = css.getPropertyValue('--text').trim() || '#e9ebf3';
    const line = dark ? '#3a3f55' : '#b9bed0';

    const nodes: N3[] = g.nodes.map((n) => ({ ...n }));
    const ids = new Set(nodes.map((n) => n.id));
    const links: L3[] = g.edges.filter((e) => ids.has(e.source) && ids.has(e.target)).map((e) => ({ source: e.source, target: e.target, relation: e.relation, used: e.used }));

    hostEl.addEventListener('mousemove', (ev) => {
      const r = hostEl.getBoundingClientRect();
      this.mouse = { x: ev.clientX - r.left, y: ev.clientY - r.top };
      if (this.hoverId) this.tip?.move(this.mouse.x, this.mouse.y);
    });

    // the constructor is untyped in the package d.ts; the instance type carries the generics
    const graph = (new ForceGraph3D(hostEl, { controlType: 'orbit' }) as unknown as ForceGraph3DInstance<N3, L3>)
      .width(hostEl.clientWidth || 800)
      .height(hostEl.clientHeight || 440)
      .backgroundColor('rgba(0,0,0,0)')
      .showNavInfo(false)
      .nodeLabel(() => '')
      .nodeThreeObject((n) => this.makeNode(n, deg.get(n.id) ?? 0, ring, text))
      .nodeThreeObjectExtend(false)
      .linkColor((l) => (l.used ? accent : line))
      .linkOpacity(0.55)
      .linkWidth((l) => (l.used ? 1.4 : 0.5))
      .linkDirectionalParticles((l) => (l.used ? 2 : 0))
      .linkDirectionalParticleWidth(1.8)
      .linkDirectionalParticleColor(() => ring)
      .onNodeHover((n) => {
        this.hoverId = n?.id ?? null;
        if (n) this.tip?.show(n, this.mouse.x, this.mouse.y, deg.get(n.id) ?? 0);
        else this.tip?.hide();
        hostEl.style.cursor = n ? 'pointer' : 'grab';
      })
      .onNodeClick((n) => {
        this.selectedId = this.selectedId === n.id ? null : n.id;
        this.selected.emit(this.selectedId);
        if (n.x === undefined || n.y === undefined || n.z === undefined) return;
        const dist = 90;
        const ratio = 1 + dist / Math.hypot(n.x, n.y, n.z || 1);
        graph.cameraPosition({ x: n.x * ratio, y: n.y * ratio, z: n.z * ratio }, { x: n.x, y: n.y, z: n.z }, 900);
      })
      .onBackgroundClick(() => {
        this.selectedId = null;
        this.selected.emit(null);
      })
      .graphData({ nodes, links });

    // tighter layout than the default so 30 nodes fill the frame
    (graph.d3Force('charge') as { strength?: (s: number) => unknown } | undefined)?.strength?.(-140);
    graph.cameraPosition({ x: 0, y: 40, z: 300 });
    graph.onEngineStop(() => graph.zoomToFit(700, 36));

    const controls = graph.controls() as unknown as { autoRotate: boolean; autoRotateSpeed: number };
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;
    hostEl.addEventListener('pointerdown', () => (controls.autoRotate = false), { once: true });

    this.graph = graph;
    this.applyFocus();

    this.ro = new ResizeObserver(() => {
      if (hostEl.clientWidth && hostEl.clientHeight) graph.width(hostEl.clientWidth).height(hostEl.clientHeight);
    });
    this.ro.observe(hostEl);
  }

  private makeNode(n: N3, degree: number, ring: string, text: string): Group {
    const r = radius(n, degree) * 0.55;
    const group = new Group();
    const body = new MeshLambertMaterial({ color: color(n), transparent: true, opacity: 1 });
    group.add(new Mesh(new SphereGeometry(r, 20, 20), body));
    const parts: NodeParts = { body };
    if (n.used) {
      const ringMat = new MeshBasicMaterial({ color: ring, transparent: true, opacity: 0.95 });
      const torus = new Mesh(new TorusGeometry(r + 1.8, 0.45, 8, 40), ringMat);
      group.add(torus);
      parts.ring = ringMat;
    } else if (n.seed) {
      const ringMat = new MeshBasicMaterial({ color: '#b4a8ff', transparent: true, opacity: 0.7 });
      group.add(new Mesh(new TorusGeometry(r + 1.6, 0.3, 6, 32), ringMat));
      parts.ring = ringMat;
    }
    if (n.used || n.seed || n.hop <= 1) {
      const label = new SpriteText(shortName(n.name, 22), n.used ? 3.2 : 2.6, text);
      label.fontFace = 'Inter, sans-serif';
      label.fontWeight = n.used ? '600' : '400';
      label.backgroundColor = false;
      label.position.set(0, r + 3.5, 0);
      label.material.transparent = true;
      group.add(label);
      parts.label = label;
    }
    this.parts.set(n.id, parts);
    return group;
  }

  private applyFocus(): void {
    if (!this.graph) return;
    const focus = this.focusUsed();
    const nodes = this.subgraph().nodes;
    for (const n of nodes) {
      const p = this.parts.get(n.id);
      if (!p) continue;
      const lit = !focus || n.used;
      p.body.opacity = lit ? 1 : 0.12;
      if (p.ring) p.ring.opacity = lit ? 0.95 : 0.08;
      if (p.label) p.label.material.opacity = lit ? 1 : 0.1;
    }
    this.graph.linkOpacity(focus ? 0.25 : 0.55).linkVisibility((l) => !focus || l.used);
  }
}

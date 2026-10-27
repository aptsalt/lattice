import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { OverlayModule } from '@angular/cdk/overlay';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { MENU_BELOW } from '../../core/overlay-positions';
import { ICONS } from '../../core/icons';
import { ChatResponse, NodeLabel } from '../../core/models';
import { LABEL_COLORS } from '../../core/graph-data';
import { GraphForceComponent } from './graph-force/graph-force';
import { GraphRadialComponent } from './graph-radial/graph-radial';
import { GraphOrbitComponent } from './graph-orbit/graph-orbit';
import { GraphThreeComponent } from './graph-three/graph-three';
import { GraphTraceComponent } from './graph-trace/graph-trace';
import { FactsTableComponent } from './facts-table/facts-table';
import { SourcesListComponent } from './sources-list/sources-list';
import { CypherViewComponent } from './cypher-view/cypher-view';
import { TraceStepsComponent } from './trace-steps/trace-steps';

export type EvidenceTab = 'graph' | 'facts' | 'sources' | 'cypher' | 'trace';
export type GraphVariant = 'force' | 'radial' | 'orbit' | 'three' | 'trace';

const VARIANTS: { id: GraphVariant; label: string; hint: string }[] = [
  { id: 'force', label: 'Force', hint: 'd3-force · ring = used in answer' },
  { id: 'radial', label: 'Radial', hint: 'taxonomy tree · World → country → rule' },
  { id: 'orbit', label: 'Orbit', hint: '3D canvas · depth and glow · no dependencies' },
  { id: 'three', label: '3D', hint: 'WebGL force graph · three.js · particles on the grounding path' },
  { id: 'trace', label: 'Replay', hint: 'retrieval steps animated' },
];

@Component({
  selector: 'app-evidence',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LucideAngularModule,
    OverlayModule,
    RouterLink,
    GraphForceComponent,
    GraphRadialComponent,
    GraphOrbitComponent,
    GraphThreeComponent,
    GraphTraceComponent,
    FactsTableComponent,
    SourcesListComponent,
    CypherViewComponent,
    TraceStepsComponent,
  ],
  templateUrl: './evidence.html',
  styleUrl: './evidence.scss',
})
export class EvidenceComponent {
  readonly response = input.required<ChatResponse>();
  readonly tab = input<EvidenceTab>('graph');
  readonly highlightPassage = input<string | null>(null);
  readonly tabChange = output<EvidenceTab>();

  readonly icons = ICONS;
  readonly variants = VARIANTS;
  readonly variant = signal<GraphVariant>(readVariant());
  readonly focusUsed = signal(false);
  readonly helpOpen = signal(false);
  readonly helpPositions = MENU_BELOW;
  readonly selectedNode = signal<string | null>(null);

  readonly tabs: { id: EvidenceTab; label: string }[] = [
    { id: 'graph', label: 'Subgraph' },
    { id: 'facts', label: 'Facts' },
    { id: 'sources', label: 'Sources' },
    { id: 'cypher', label: 'Cypher' },
    { id: 'trace', label: 'Trace' },
  ];

  readonly legend = computed(() => {
    const counts = new Map<NodeLabel, number>();
    for (const n of this.response().subgraph.nodes) counts.set(n.label, (counts.get(n.label) ?? 0) + 1);
    return [...counts.entries()].map(([label, count]) => ({ label, count, color: LABEL_COLORS[label] }));
  });

  readonly usedCount = computed(() => this.response().subgraph.nodes.filter((n) => n.used).length);

  /** Contextual help for the open tab (and graph view). */
  readonly help = computed<{ title: string; body: string }>(() => {
    switch (this.tab()) {
      case 'facts':
        return { title: 'Facts', body: 'Every subject → relation → object triple in the retrieved subgraph, with the confidence stored on the relationship at ingestion. Rows with the yellow bar are the grounding facts the answer quotes; tick the box to show only those. Click a header to sort.' };
      case 'sources':
        return { title: 'Sources', body: 'The policy passages the grounding facts were extracted from, numbered to match the [n] citations in the answer. The breadcrumb shows where the section sits in its document; the tag shows which country policy it belongs to.' };
      case 'cypher':
        return { title: 'Cypher', body: "Cypher is Neo4j's query language (SQL for graphs). These are the exact queries the service ran for this turn: the full-text seed lookup (lexical), the vector-index seed lookup (vector), the apoc.path.subgraphAll expansion from the fused seeds with country scoping, and the CITED_IN passage fetch. Paste them into Neo4j Browser to reproduce the evidence." };
      case 'trace':
        return { title: 'Trace', body: 'One row per pipeline stage: resolve → lexical → vector → fuse → expand → rank → cite → answer. Each shows what it did, how long it took and how many graph nodes it touched. The Replay graph view animates this same data.' };
      default: {
        const v = VARIANTS.find((x) => x.id === this.variant())!;
        return { title: `Subgraph · ${v.label}`, body: `The slice of the knowledge graph the answer was built from. Yellow ring = relied on by the answer; dashed ring = matched by retrieval (seed); plain = pulled in by the traversal but unused. Focus dims the unused part. This view: ${v.hint}. Switch views with the segmented control; your choice is remembered.` };
      }
    }
  });

  setTab(t: EvidenceTab): void {
    this.tabChange.emit(t);
  }

  setVariant(v: GraphVariant): void {
    this.variant.set(v);
    try {
      localStorage.setItem('lattice.graph-variant', v);
    } catch {
      /* ignore */
    }
  }
}

function readVariant(): GraphVariant {
  try {
    const v = localStorage.getItem('lattice.graph-variant');
    if (v === 'force' || v === 'radial' || v === 'orbit' || v === 'three' || v === 'trace') return v;
  } catch {
    /* ignore */
  }
  return 'force';
}

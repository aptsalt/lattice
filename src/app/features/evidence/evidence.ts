import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ICONS } from '../../core/icons';
import { ChatResponse, NodeLabel } from '../../core/models';
import { LABEL_COLORS } from '../../core/graph-data';
import { GraphForceComponent } from './graph-force/graph-force';
import { GraphRadialComponent } from './graph-radial/graph-radial';
import { GraphOrbitComponent } from './graph-orbit/graph-orbit';
import { GraphTraceComponent } from './graph-trace/graph-trace';
import { FactsTableComponent } from './facts-table/facts-table';
import { SourcesListComponent } from './sources-list/sources-list';
import { CypherViewComponent } from './cypher-view/cypher-view';
import { TraceStepsComponent } from './trace-steps/trace-steps';

export type EvidenceTab = 'graph' | 'facts' | 'sources' | 'cypher' | 'trace';
export type GraphVariant = 'force' | 'radial' | 'orbit' | 'trace';

const VARIANTS: { id: GraphVariant; label: string; hint: string }[] = [
  { id: 'force', label: 'Force', hint: 'd3-force · ring = used in answer' },
  { id: 'radial', label: 'Radial', hint: 'taxonomy tree · World → country → rule' },
  { id: 'orbit', label: 'Orbit', hint: '3D canvas · depth and glow' },
  { id: 'trace', label: 'Replay', hint: 'retrieval steps animated' },
];

@Component({
  selector: 'app-evidence',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LucideAngularModule,
    GraphForceComponent,
    GraphRadialComponent,
    GraphOrbitComponent,
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
    if (v === 'force' || v === 'radial' || v === 'orbit' || v === 'trace') return v;
  } catch {
    /* ignore */
  }
  return 'force';
}

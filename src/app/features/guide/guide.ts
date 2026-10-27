import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** In-app explainer: every control, badge, tab and view, in the order a user meets them. */
@Component({
  selector: 'app-guide',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './guide.html',
  styleUrl: './guide.scss',
})
export class GuideComponent {
  readonly cypher = [
    ['MATCH (seed) WHERE seed.id IN [...]', 'Find the seed nodes that lexical and vector retrieval agreed on.'],
    ["CALL db.index.fulltext.queryNodes('entity_names', $q)", 'Neo4j full-text index lookup: BM25-style match on entity names and aliases. This is the lexical stage.'],
    ["CALL db.index.vector.queryNodes('entity_embeddings', 12, $embedding)", 'Neo4j vector index lookup: the 12 entities whose embeddings are closest to the question embedding. This is the vector stage.'],
    ['CALL apoc.path.subgraphAll(seed, { maxLevel, relationshipFilter, labelFilter })', 'APOC procedure that walks every path up to maxLevel hops from each seed, only along the listed relationship types, skipping Section nodes. This is the expand stage.'],
    ['YIELD nodes, relationships', 'Procedures return their results through YIELD; the following clauses can then use them.'],
    ["WHERE m.country IS NULL OR m.country = 'GLOBAL' OR m.country IN [...]", 'Scopes the subgraph to the countries named in the question so a Mexico question never pulls in Canadian rules.'],
    ['MATCH (r:Rule)-[:CITED_IN]->(s:Section) WHERE r.id IN $ruleIds', 'Fetches the policy passages the grounding rules were extracted from. This is the cite stage; it feeds the Sources tab.'],
    ['RETURN ... collect(DISTINCT m {...}) AS nodes, [r IN relationships | {...}] AS edges', 'Shapes the result into the nodes and edges the Subgraph tab draws.'],
  ];
}

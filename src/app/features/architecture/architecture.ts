import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-architecture',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './architecture.html',
  styleUrl: './architecture.scss',
})
export class ArchitectureComponent {
  readonly stages = [
    { n: 1, title: 'Resolve', what: 'Rewrite follow-ups ("and in Canada?") with the previous turn\'s entities when conversation context is on.', tech: 'FastAPI · small LLM call or rule-based coreference' },
    { n: 2, title: 'Lexical', what: 'Full-text index over entity names and aliases returns candidate seeds with BM25 scores.', tech: 'Neo4j full-text index · db.index.fulltext.queryNodes' },
    { n: 3, title: 'Vector', what: 'Question embedding against entity and passage embeddings for paraphrase-tolerant recall.', tech: 'Neo4j vector index · text-embedding model' },
    { n: 4, title: 'Fuse', what: 'Reciprocal-rank fusion merges both lists so neither exact wording nor semantics dominates.', tech: 'RRF, k = 60 · hybrid mode' },
    { n: 5, title: 'Expand', what: 'Traverse 2–3 hops from the seeds along typed relations, scoped to the countries in the question.', tech: 'Cypher · apoc.path.subgraphAll · label filters' },
    { n: 6, title: 'Rank', what: 'Score triples by confidence × proximity to seeds; pick the rules the answer may rely on.', tech: 'Python · deterministic, logged' },
    { n: 7, title: 'Cite', what: 'Pull the policy sections each selected rule was extracted from (CITED_IN).', tech: 'Cypher · Section nodes with breadcrumbs' },
    { n: 8, title: 'Answer', what: 'LLM writes prose only from the facts and passages supplied; every claim must carry a section citation.', tech: 'Gemini / Claude · grounded prompt · citation validator' },
  ];

  readonly schema = [
    ['(:Region)-[:PART_OF]->(:Region)', 'North America → World'],
    ['(:Country)-[:PART_OF]->(:Region)', 'USA, Mexico, Canada → North America'],
    ['(:Country)-[:HAS_POLICY]->(:Policy)', 'one country policy each'],
    ['(:Policy)-[:INHERITS_FROM]->(:Policy)', 'country policy → Global Leave Policy'],
    ['(:Policy)-[:COVERS]->(:LeaveType)', 'annual, sick, parental, bereavement, holidays, jury'],
    ['(:LeaveType)-[:HAS_RULE]->(:Rule)', 'entitlement, carryover, notice, approval…'],
    ['(:Rule)-[:OVERRIDES]->(:Rule)', 'country clause replaces a global clause'],
    ['(:Rule)-[:GOVERNED_BY]->(:Regulation)', 'FMLA, LFT, IMSS, Canada Labour Code, ESA, EI'],
    ['(:Rule)-[:APPLIES_TO]->(:EmployeeType)', 'full-time, part-time, contractor'],
    ['(:Rule)-[:APPROVED_BY]->(:Approver)', 'line manager, HRBP'],
    ['(:Rule)-[:CITED_IN]->(:Section)', 'the passage the fact was extracted from'],
  ];
}

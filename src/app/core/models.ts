/**
 * API contract shared with the FastAPI backend.
 *
 * The in-browser engine (`rag-engine.ts`) produces exactly this shape so a
 * real `POST /chat` can be swapped in behind the same types.
 */

export type DataSource = 'live' | 'offline';
export type RetrievalMode = 'lexical' | 'vector' | 'hybrid' | 'graph';
export type Confidence = 'high' | 'medium' | 'low';

export interface ChatSettings {
  source: DataSource;
  mode: RetrievalMode;
  useContext: boolean;
  generateAnswer: boolean;
}

export const DEFAULT_SETTINGS: ChatSettings = {
  source: 'live',
  mode: 'hybrid',
  useContext: true,
  generateAnswer: true,
};

/** Node labels in the Neo4j graph. */
export type NodeLabel =
  | 'Region'
  | 'Country'
  | 'Policy'
  | 'LeaveType'
  | 'Rule'
  | 'Regulation'
  | 'EmployeeType'
  | 'Approver'
  | 'Section';

export type Relation =
  | 'PART_OF'
  | 'HAS_POLICY'
  | 'INHERITS_FROM'
  | 'COVERS'
  | 'HAS_RULE'
  | 'GOVERNED_BY'
  | 'APPLIES_TO'
  | 'APPROVED_BY'
  | 'OVERRIDES'
  | 'CITED_IN';

export interface GraphNode {
  id: string;
  label: NodeLabel;
  name: string;
  /** Lexical aliases used by retrieval (lower-case). */
  aliases?: string[];
  /** Free-form properties shown in the tooltip. */
  props?: Record<string, string | number>;
  /** Country scope for context resolution (ISO-ish). */
  country?: 'USA' | 'MEX' | 'CAN' | 'GLOBAL';
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relation: Relation;
  confidence: number;
  /** Section id this fact was extracted from. */
  sectionId?: string;
}

export interface Passage {
  id: string;
  /** e.g. "§3.2" */
  ref: string;
  title: string;
  /** Breadcrumb from the policy document, e.g. "Global Leave Policy > 3 Annual Leave > 3.2 Carryover". */
  breadcrumb: string;
  text: string;
  country: GraphNode['country'];
}

// ─── Response ──────────────────────────────────────────────────────────────

export interface Fact {
  subject: string;
  subjectId: string;
  relation: Relation;
  object: string;
  objectId: string;
  confidence: number;
  usedInAnswer: boolean;
  sectionId?: string;
}

export interface SubgraphNode extends GraphNode {
  /** Matched by retrieval (seed entity). */
  seed: boolean;
  /** Relied on by the answer (ringed in the Streamlit version). */
  used: boolean;
  /** Hop distance from the nearest seed. */
  hop: number;
}

export interface SubgraphEdge extends GraphEdge {
  used: boolean;
}

export interface Subgraph {
  nodes: SubgraphNode[];
  edges: SubgraphEdge[];
}

export interface Citation {
  n: number;
  passageId: string;
}

export interface TraceStep {
  id: 'resolve' | 'lexical' | 'vector' | 'fuse' | 'expand' | 'rank' | 'passages' | 'answer';
  title: string;
  detail: string;
  ms: number;
  /** Node ids touched by this step (for the Trace graph replay). */
  nodeIds: string[];
  cypher?: string;
}

export interface RetrievalStats {
  facts: number;
  passages: number;
  matchedEntities: number;
  mode: RetrievalMode;
  source: DataSource;
  latencyMs: number;
}

export interface ChatRequest {
  question: string;
  conversationId: string;
  settings: ChatSettings;
  /** Previous turns, newest last (only sent when useContext). */
  history: { role: 'user' | 'assistant'; text: string }[];
}

export interface ChatResponse {
  id: string;
  /** Question after context resolution (may equal the input). */
  resolvedQuestion: string;
  answerMarkdown: string;
  confidence: Confidence;
  stats: RetrievalStats;
  facts: Fact[];
  passages: Passage[];
  citations: Citation[];
  subgraph: Subgraph;
  trace: TraceStep[];
  cypher: string;
}

// ─── Conversation state ────────────────────────────────────────────────────

export interface UserMessage {
  id: string;
  role: 'user';
  text: string;
  at: number;
}

export interface AssistantMessage {
  id: string;
  role: 'assistant';
  at: number;
  /** Streams in while `streaming` is true. */
  text: string;
  streaming: boolean;
  response?: ChatResponse;
  error?: string;
  settings: ChatSettings;
}

export type Message = UserMessage | AssistantMessage;

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
}

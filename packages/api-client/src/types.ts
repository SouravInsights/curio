/**
 * The shapes the API returns. Kept in step with the route schemas by hand for
 * now; the raw OpenAPI document at `/documentation/json` is the source a
 * generated client would read when that becomes worth the machinery.
 */

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: { field: string; message: string }[];
    why?: string;
    fix?: string;
  };
}

/** Every non-2xx response, in one type. `status` and the body both survive. */
export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody | null;

  constructor(status: number, body: ApiErrorBody | null) {
    super(body?.error?.message ?? `HTTP ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export interface Me {
  id: string;
  email: string;
  name: string;
}

export interface LibraryItem {
  id: number;
  externalId: string;
  title: string;
  url: string | null;
  site: string;
  author: string;
  kind: string;
  category: string | null;
  readState: string;
  favorite: boolean;
  readProgress: number;
  lastReadAt: string | null;
  summary: string | null;
  topics: string[] | null;
  wordCount: number | null;
  addedAt: string;
}

export interface Annotation {
  /** The mark's durable identity — client-minted, the name every surface uses. */
  clientId: string;
  id: number;
  documentId: number;
  kind: "highlight" | "note";
  quote: string;
  prefix: string;
  suffix: string;
  occurrence: number;
  hue: number;
  body: string;
  startLine: number | null;
  endLine: number | null;
}

export interface DocumentDetail {
  id: number;
  externalId: string;
  url: string | null;
  title: string;
  author: string;
  site: string;
  kind: string;
  category: string | null;
  summary: string | null;
  topics: string[] | null;
  wordCount: number | null;
  readState: string;
  favorite: boolean;
  addedAt: string;
  markdown: string | null;
  annotations: Annotation[];
}

export interface SearchPassage {
  content: string;
  startLine: number;
  endLine: number;
  unitType: string;
  heading: string | null;
}

export interface SearchHit {
  documentId: number;
  externalId: string;
  url: string | null;
  title: string;
  kind: string;
  category: string | null;
  score: number;
  passages: SearchPassage[];
}

export interface AnnotationSummary {
  clientId: string;
  documentId: number;
  title: string;
  kind: string;
  quote: string;
  body: string;
  hue: number;
  startLine: number | null;
  endLine: number | null;
}

/** One door on the browse page: a category or a topic, with how much is behind it. */
export interface TopicCount {
  name: string;
  count: number;
}

/** A mark waiting to be recalled, and how often it has been seen. */
export interface ReviewCard {
  clientId: string;
  documentId: number;
  title: string;
  quote: string;
  body: string;
  startLine: number | null;
  endLine: number | null;
  reviewCount: number;
  reviewInterval: number;
}

export interface ReviewStats {
  due: number;
  total: number;
}

export type ReviewGrade = "again" | "hard" | "good" | "easy";

/** An edge the agent drew between two documents, and the other end's metadata. */
export interface ConnectionEdge {
  id: number;
  fromDocumentId: number;
  toDocumentId: number;
  kind: string;
  note: string;
}

export interface ConnectedDocument {
  id: number;
  title: string;
  url: string | null;
}

// ── sync ──────────────────────────────────────────────────────────────────────

/** One row of the pull feed. A removed mark arrives as `deleted: true`, not absent. */
export interface AnnotationChange {
  clientId: string;
  documentId: number;
  kind: "highlight" | "note";
  quote: string;
  prefix: string;
  suffix: string;
  occurrence: number;
  hue: number;
  body: string;
  startLine: number | null;
  endLine: number | null;
  stale: boolean;
  deleted: boolean;
  updatedAt: number;
}

/** One row of the document pull feed — the library list's local row. */
export interface DocumentChange {
  id: number;
  externalId: string;
  title: string;
  url: string | null;
  site: string;
  author: string;
  kind: string;
  category: string | null;
  readState: string;
  favorite: boolean;
  readProgress: number;
  lastReadAt: number | null;
  summary: string | null;
  topics: string[] | null;
  wordCount: number | null;
  addedAt: number;
  hidden: boolean;
  updatedAt: number;
}

/** A local mutation on its way to the server. Idempotent. */
export type SyncMutation =
  | {
      seq: number;
      entity: "annotation";
      op: "upsert" | "delete";
      id: string;
      payload?: Record<string, unknown>;
    }
  | {
      seq: number;
      entity: "document";
      op: "patch";
      id: string;
      payload: Record<string, unknown>;
    };

export interface Connections {
  edges: ConnectionEdge[];
  documents: ConnectedDocument[];
}

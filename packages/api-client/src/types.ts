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
  summary: string | null;
  topics: string[] | null;
  wordCount: number | null;
  addedAt: string;
}

export interface Annotation {
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
  id: number;
  documentId: number;
  title: string;
  kind: string;
  quote: string;
  body: string;
  startLine: number | null;
  endLine: number | null;
}

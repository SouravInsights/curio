import { search } from "@curio/core/kb/search";
import type { Scope } from "./scope";

export interface SearchActionOptions {
  mode?: "hybrid" | "semantic" | "exact";
  kind?: string;
  category?: string;
  limit?: number;
  documentId?: number;
}

/** Search this library. The one retrieval path. */
export function searchLibrary(scope: Scope, query: string, opts: SearchActionOptions = {}) {
  return search(query, { ...opts, libraryId: scope.libraryId });
}

export type { SearchHit } from "@curio/core/kb/search";

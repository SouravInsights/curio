import { z } from "zod";
import { tool } from "@curio/core/observability";
import type { Scope } from "@curio/core/services/scope";
import { getDocument, listLibrary, listTopics, readPassage, setReadState } from "@curio/core/services/library";
import {
  connectDocuments,
  saveAnnotation,
  searchAnnotations,
} from "@curio/core/services/annotations";
import { searchLibrary } from "@curio/core/services/search";
import { addLink, saveNote } from "@curio/core/imports/ingest";
import { getProfile, saveProfile } from "@curio/core/services/profile";
import {
  REVIEW_GRADES,
  gradeReview,
  reviewQueue,
  reviewStats,
} from "@curio/core/services/reviews";
import { KINDS } from "@curio/core/kb/kinds";
import { findSkill, readingSkills } from "./skills";

/**
 * The reading tool set. Where a coding harness has read_file/edit_file, Curio
 * has read_passage/save_annotation: the unit is a span of something you read,
 * and every read tool can return a citation `{ documentId, startLine, endLine }`
 * the reader can open.
 *
 * Tools return data, never prose. The model writes the answer; the UI renders
 * citations from tool output only, so a link or span it did not receive cannot
 * appear.
 */

export const MAX_STEPS = 8;
export const SEARCH_LIMIT = 6;

/** Search: hybrid by default; `exact` for a literal phrase, `semantic` for meaning. */
export const searchTool = (scope: Scope) =>
  tool({
    description:
      "Search everything in the library by meaning and by literal text. Returns " +
      "documents with the passages that matched, each with a line span you can " +
      "cite. Call it before answering; call again per facet for a set.",
    inputSchema: z.object({
      query: z.string().describe("What to look for, in plain words"),
      mode: z
        .enum(["hybrid", "semantic", "exact"])
        .optional()
        .describe(
          "hybrid (default) fuses meaning and keywords; exact is a literal phrase " +
            "search for a proper noun, a function name, a line you half-remember; " +
            "semantic is meaning only.",
        ),
      kind: z
        .enum(KINDS)
        .optional()
        .describe("Restrict to one kind of reading — articles, books, newsletters."),
      limit: z.number().int().min(1).max(12).optional(),
    }),
    execute: async ({ query, mode, kind, limit }) => {
      const hits = await searchLibrary(scope, query, { mode, kind, limit: limit ?? SEARCH_LIMIT });
      if (hits.length === 0) return { matches: [], note: "Nothing in the library matches." };
      return {
        matches: hits.map((hit) => ({
          documentId: hit.documentId,
          title: hit.title,
          url: hit.url,
          kind: hit.kind,
          passages: hit.passages.map((p) => ({
            startLine: p.startLine,
            endLine: p.endLine,
            text: p.content,
          })),
        })),
      };
    },
  });

/** Open an exact span — the reading harness's read_file. */
export const readPassageTool = (scope: Scope) =>
  tool({
    description:
      "Read a document's text by line span. Use the line numbers a search returned " +
      "to quote precisely, or to read around them.",
    inputSchema: z.object({
      documentId: z.number().int(),
      startLine: z.number().int().optional(),
      endLine: z.number().int().optional(),
    }),
    execute: async ({ documentId, startLine, endLine }) => {
      const spanResult = await readPassage(scope, documentId, startLine, endLine);
      if (!spanResult) return { error: "No such document (or it has no stored text)." };
      return spanResult;
    },
  });

/** Recent reading — the library as a list. */
export const listLibraryTool = (scope: Scope) =>
  tool({
    description: "List recently added reading, optionally by kind or reading state.",
    inputSchema: z.object({
      kind: z.enum(KINDS).optional(),
      readState: z.enum(["unread", "reading", "read", "archived"]).optional(),
      limit: z.number().int().min(1).max(50).optional(),
    }),
    execute: async (input) => ({ documents: await listLibrary(scope, input) }),
  });

/** Your own marks — highlights and notes. */
export const searchAnnotationsTool = (scope: Scope) =>
  tool({
    description:
      "The reader's own highlights and notes. Pass `documentId` for everything " +
      "they marked in one piece; pass `query` to match quote or body; omit both " +
      "for the most recent marks. Use it for 'what did I highlight about X' and " +
      "to ground an answer in what the reader flagged.",
    inputSchema: z.object({
      query: z.string().optional(),
      documentId: z.number().int().optional(),
      limit: z.number().int().min(1).max(100).optional(),
    }),
    execute: async ({ query, documentId, limit }) => ({
      annotations: await searchAnnotations(scope, { query, documentId, limit }),
    }),
  });

export const getDocumentTool = (scope: Scope) =>
  tool({
    description: "A document's metadata, summary and topics.",
    inputSchema: z.object({ documentId: z.number().int() }),
    execute: async ({ documentId }) => {
      const doc = await getDocument(scope, documentId);
      return doc ?? { error: "No such document." };
    },
  });

/** The shape of the library: topics with counts. */
export const listTopicsTool = (scope: Scope) =>
  tool({
    description:
      "The shape of the library: every topic with its count. Use it " +
      "to see what the reader reads about, or to browse by subject.",
    inputSchema: z.object({}),
    execute: async () => await listTopics(scope),
  });

/** Save a link and read it — the reader's "save for later". */
export const saveDocumentTool = (scope: Scope) =>
  tool({
    description:
      "Add a URL to the library and read it: fetch, extract, classify, summarise, " +
      "embed. Use it when the reader asks to save something for later.",
    inputSchema: z.object({
      url: z.string().describe("The page to save"),
      kind: z.enum(KINDS).optional(),
    }),
    execute: async ({ url, kind }) => await addLink(scope.libraryId, url, { kind }),
  });

/** Write a note back into the library, as a first-class document. */
export const saveNoteTool = (scope: Scope) =>
  tool({
    description:
      "Save a piece of writing as a note in the library. It becomes a document " +
      "the reader can open, search and cite. Use it for a review, a digest, or " +
      "anything worth keeping rather than leaving in the chat.",
    inputSchema: z.object({
      title: z.string().describe("The note's title"),
      markdown: z.string().describe("The note's full text, as markdown"),
    }),
    execute: async ({ title, markdown }) => await saveNote(scope.libraryId, { title, markdown }),
  });

/** Write a note or highlight back to the library. */
export const saveAnnotationTool = (scope: Scope) =>
  tool({
    description:
      "Save a highlight or note onto a document. Use it when the reader asks you " +
      "to remember something, or when you connect a passage to their thinking.",
    inputSchema: z.object({
      documentId: z.number().int(),
      quote: z.string().optional(),
      body: z.string().optional(),
      startLine: z.number().int().optional(),
      endLine: z.number().int().optional(),
      kind: z.enum(["highlight", "note"]).optional(),
    }),
    execute: async (input) => ({ saved: await saveAnnotation(scope, input) }),
  });

/** Load a reading skill — the playbook for a kind of request. */
export const useSkillTool = () =>
  tool({
    description:
      "Load a reading skill: a named playbook for a kind of request. Call it " +
      "before answering when the request matches one, then follow the playbook. " +
      `Available: ${readingSkills()
        .map((skill) => skill.name)
        .join(", ")}.`,
    inputSchema: z.object({
      name: z.string().describe("The reading skill to load"),
    }),
    execute: async ({ name }) => {
      const skill = findSkill(name);
      if (!skill) {
        return {
          error: `No reading skill named ${name}.`,
          available: readingSkills().map((s) => s.name),
        };
      }
      return { skill: skill.name, instructions: skill.body };
    },
  });

/** Set a document's reading state — what triage applies once the reader agrees. */
export const setReadStateTool = (scope: Scope) =>
  tool({
    description:
      "Set a document's reading state: unread, reading, read, or archived. " +
      "Use it to apply a triage order, or to mark something finished.",
    inputSchema: z.object({
      documentId: z.number().int(),
      state: z.enum(["unread", "reading", "read", "archived"]),
    }),
    execute: async ({ documentId, state }) => {
      await setReadState(scope, documentId, state);
      return { documentId, readState: state };
    },
  });

/** The reader's profile — read it before rewriting it. */
export const getPersonaTool = (scope: Scope) =>
  tool({
    description:
      "The reader's profile: a short portrait of their interests, reading " +
      "behaviour and taste. It is already in your instructions; read it here only " +
      "to show it or to revise it.",
    inputSchema: z.object({}),
    execute: async () => ({ profile: await getProfile(scope) }),
  });

/** Write the reader's profile — what `build-persona` produces. */
export const savePersonaTool = (scope: Scope) =>
  tool({
    description:
      "Save the reader's profile. Write the whole markdown portrait; it replaces " +
      "the previous one. Use it at the end of the build-persona skill, or when the " +
      "reader corrects something about themselves.",
    inputSchema: z.object({
      content: z.string().describe("The full profile, as markdown"),
    }),
    execute: async ({ content }) => await saveProfile(scope, content),
  });

/** Draw an edge between two things you read. */
export const connectTool = (scope: Scope) =>
  tool({
    description:
      "Record a connection between two documents — agrees, contradicts, extends, " +
      "references. Call it after you have read both spans and found the link.",
    inputSchema: z.object({
      fromDocumentId: z.number().int(),
      toDocumentId: z.number().int(),
      kind: z
        .enum(["agrees", "contradicts", "extends", "references", "related"])
        .optional(),
      note: z.string().optional(),
    }),
    execute: async (input) => ({ connection: await connectDocuments(scope, input) }),
  });

/** The marks due for recall — what to bring back to the reader today. */
export const reviewQueueTool = (scope: Scope) =>
  tool({
    description:
      "The reader's own marks that are due for recall. Present them one at a " +
      "time: show the quote, ask the reader to recall what it meant or where it " +
      "was from, then reveal the note and grade with grade_review. Never reveal " +
      "before they try — recall is the point.",
    inputSchema: z.object({
      limit: z.number().int().min(1).max(50).optional(),
    }),
    execute: async ({ limit }) => ({
      cards: await reviewQueue(scope, limit ?? 20),
      stats: await reviewStats(scope),
    }),
  });

/** Grade a recall card, which schedules when it comes back. */
export const gradeReviewTool = (scope: Scope) =>
  tool({
    description:
      "Grade a recall card: again (missed it), hard, good, or easy. Schedules " +
      "when the mark returns. Call it after the reader answers.",
    inputSchema: z.object({
      clientId: z.string(),
      grade: z.enum(REVIEW_GRADES),
    }),
    execute: async ({ clientId, grade }) => await gradeReview(scope, clientId, grade),
  });

/** The full set, scoped to one library. Fresh per call so a budget is per question. */
export function curioTools(scope: Scope) {
  return {
    search_library: searchTool(scope),
    read_passage: readPassageTool(scope),
    list_library: listLibraryTool(scope),
    search_annotations: searchAnnotationsTool(scope),
    get_document: getDocumentTool(scope),
    list_topics: listTopicsTool(scope),
    save_document: saveDocumentTool(scope),
    save_note: saveNoteTool(scope),
    get_persona: getPersonaTool(scope),
    save_persona: savePersonaTool(scope),
    review_queue: reviewQueueTool(scope),
    grade_review: gradeReviewTool(scope),
    save_annotation: saveAnnotationTool(scope),
    connect: connectTool(scope),
    set_read_state: setReadStateTool(scope),
    use_skill: useSkillTool(),
  };
}

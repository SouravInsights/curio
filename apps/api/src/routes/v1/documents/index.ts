import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "@sinclair/typebox";
import { createError } from "evlog";
import { useLogger } from "evlog/fastify";
import {
  getDocumentForReader,
  listLibrary,
  saveAnnotation,
  setFavorite,
  setReadState,
} from "@curio/core/agent/actions";
import { addLink } from "@curio/core/imports/ingest";
import { authOf } from "../../../plugins/auth";
import { commonErrors } from "../../../schemas/response";

const IdParams = Type.Object({ id: Type.Integer({ minimum: 1 }) });

/** Documents: the list, one document with its marks, and writing a mark. */
const documents: FastifyPluginAsyncTypebox = async (fastify) => {
  // The on-site intake: paste a URL, and the pipeline reads it right away.
  fastify.post(
    "/documents",
    {
      preHandler: fastify.requireAuth,
      schema: {
        tags: ["documents"],
        summary: "Add a link and read it",
        description:
          "Fetches the page, extracts its markdown (defuddle, with a headless fallback), " +
          "then classifies, summarises and embeds it. A missing model key costs the summary, " +
          "not the article — the markdown is stored and readable either way.",
        security: [{ bearerAuth: [] }],
        body: Type.Object({
          url: Type.String({ minLength: 4 }),
          kind: Type.Optional(Type.String()),
        }),
        response: { ...commonErrors, 201: Type.Any() },
      },
    },
    async (request, reply) => {
      const { scope, user } = authOf(request);
      const { url, kind } = request.body;
      useLogger().set({ user: { id: user.id }, import: { url, kind: kind ?? "article" } });
      const result = await addLink(scope.libraryId, url, { kind: kind as never });
      useLogger().set({ import_result: result });
      reply.code(201);
      return { data: result };
    },
  );

  fastify.get(
    "/documents",
    {
      preHandler: fastify.requireAuth,
      schema: {
        tags: ["documents"],
        summary: "List documents",
        security: [{ bearerAuth: [] }],
        querystring: Type.Object({
          kind: Type.Optional(Type.String()),
          state: Type.Optional(Type.String()),
          limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 30 })),
        }),
        response: { ...commonErrors, 200: Type.Any() },
      },
    },
    async (request) => {
      const { scope } = authOf(request);
      const { kind, state, limit } = request.query;
      const rows = await listLibrary(scope, { kind, readState: state, limit });
      useLogger().set({ library: { id: scope.libraryId, documents: rows.length } });
      return { data: rows };
    },
  );

  fastify.get(
    "/documents/:id",
    {
      preHandler: fastify.requireAuth,
      schema: {
        tags: ["documents"],
        summary: "One document, its stored markdown and its marks",
        security: [{ bearerAuth: [] }],
        params: IdParams,
        response: { ...commonErrors, 200: Type.Any() },
      },
    },
    async (request) => {
      const { scope, user } = authOf(request);
      const { id } = request.params;
      const document = await getDocumentForReader(scope, id);
      if (!document) {
        useLogger().set({ document: { id, found: false } });
        throw createError({
          status: 404,
          message: "not found",
          why: "No document with that id in this library",
          fix: "List the library and use one of its ids.",
        });
      }
      useLogger().set({
        user: { id: user.id },
        document: { id, words: document.wordCount, marks: document.annotations.length },
      });
      return { data: document };
    },
  );

  fastify.patch(
    "/documents/:id",
    {
      preHandler: fastify.requireAuth,
      schema: {
        tags: ["documents"],
        summary: "Change a document's reading state or its star",
        security: [{ bearerAuth: [] }],
        params: IdParams,
        body: Type.Object({
          readState: Type.Optional(
            Type.Union([
              Type.Literal("unread"),
              Type.Literal("reading"),
              Type.Literal("read"),
              Type.Literal("archived"),
            ]),
          ),
          favorite: Type.Optional(Type.Boolean()),
        }),
        response: { ...commonErrors, 200: Type.Any() },
      },
    },
    async (request) => {
      const { scope } = authOf(request);
      const { id } = request.params;
      const { readState, favorite } = request.body;
      if (readState) await setReadState(scope, id, readState);
      if (favorite !== undefined) await setFavorite(scope, id, favorite);
      useLogger().set({ document: { id, readState: readState ?? null, favorite: favorite ?? null } });
      return { data: { ok: true } };
    },
  );

  fastify.post(
    "/documents/:id/annotations",
    {
      preHandler: fastify.requireAuth,
      schema: {
        tags: ["documents"],
        summary: "Save a highlight or note",
        security: [{ bearerAuth: [] }],
        params: IdParams,
        body: Type.Object({
          quote: Type.Optional(Type.String({ maxLength: 2000 })),
          prefix: Type.Optional(Type.String({ maxLength: 200 })),
          suffix: Type.Optional(Type.String({ maxLength: 200 })),
          occurrence: Type.Optional(Type.Integer({ minimum: 0 })),
          hue: Type.Optional(Type.Integer({ minimum: 0, maximum: 7 })),
          startLine: Type.Optional(Type.Integer({ minimum: 0 })),
          endLine: Type.Optional(Type.Integer({ minimum: 0 })),
          body: Type.Optional(Type.String({ maxLength: 5000 })),
          kind: Type.Optional(Type.Union([Type.Literal("highlight"), Type.Literal("note")])),
        }),
        response: { ...commonErrors, 201: Type.Any() },
      },
    },
    async (request, reply) => {
      const { scope, user } = authOf(request);
      const { id } = request.params;
      const body = request.body;
      if (!body.quote && !body.body) {
        throw createError({
          status: 400,
          message: "quote or body is required",
          why: "An annotation needs a quote or a body",
          fix: "Send at least one of { quote, body }.",
        });
      }
      const saved = await saveAnnotation(scope, { ...body, documentId: id });
      useLogger().set({
        user: { id: user.id },
        annotation: { id: saved.id, documentId: id, kind: body.kind ?? "highlight" },
      });
      reply.code(201);
      return { data: saved };
    },
  );
};

export default documents;

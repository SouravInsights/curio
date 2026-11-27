import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "@sinclair/typebox";
import { useLogger } from "evlog/fastify";
import {
  deleteAnnotation,
  pullAnnotations,
  upsertAnnotation,
  type AnnotationInput,
} from "@curio/core/services/annotations";
import { applyDocumentPatch, pullDocuments } from "@curio/core/services/library";
import { authOf } from "../../../plugins/auth";
import { commonErrors } from "../../../schemas/response";

/**
 * The sync surface. The browser is the source of truth for user state; these two
 * endpoints are how the server is brought into agreement with it.
 *
 * `push` is idempotent — the client mints the id, so replaying a batch after a
 * dropped response is safe. `pull` is a cursor feed, so a client that was away
 * catches up with what changed rather than re-downloading the library.
 *
 * Two entities move through here: **annotations**, which the client creates, and
 * **documents**, whose reading state the client owns but whose content the server
 * pipeline produces. Each has its own cursor.
 */

const AnnotationPayload = Type.Object({
  documentId: Type.Integer({ minimum: 1 }),
  kind: Type.Optional(Type.Union([Type.Literal("highlight"), Type.Literal("note")])),
  quote: Type.Optional(Type.String({ maxLength: 2000 })),
  prefix: Type.Optional(Type.String({ maxLength: 200 })),
  suffix: Type.Optional(Type.String({ maxLength: 200 })),
  occurrence: Type.Optional(Type.Integer({ minimum: 0 })),
  hue: Type.Optional(Type.Integer({ minimum: 0, maximum: 7 })),
  body: Type.Optional(Type.String({ maxLength: 5000 })),
  startLine: Type.Optional(Type.Union([Type.Integer({ minimum: 0 }), Type.Null()])),
  endLine: Type.Optional(Type.Union([Type.Integer({ minimum: 0 }), Type.Null()])),
});

const DocumentPatch = Type.Object({
  readState: Type.Optional(
    Type.Union([
      Type.Literal("unread"),
      Type.Literal("reading"),
      Type.Literal("read"),
      Type.Literal("archived"),
    ]),
  ),
  favorite: Type.Optional(Type.Boolean()),
});

const Mutation = Type.Union([
  Type.Object({
    seq: Type.Integer({ minimum: 0 }),
    entity: Type.Literal("annotation"),
    op: Type.Union([Type.Literal("upsert"), Type.Literal("delete")]),
    id: Type.String({ minLength: 8 }),
    payload: Type.Optional(AnnotationPayload),
  }),
  Type.Object({
    seq: Type.Integer({ minimum: 0 }),
    entity: Type.Literal("document"),
    op: Type.Literal("patch"),
    /** The document id, as a string — the wire is uniform across entities. */
    id: Type.String({ pattern: "^[0-9]+$" }),
    payload: DocumentPatch,
  }),
]);

const sync: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.post(
    "/sync/push",
    {
      preHandler: fastify.requireAuth,
      schema: {
        tags: ["sync"],
        summary: "Apply a batch of local mutations",
        description:
          "Every mutation is idempotent, so a batch that is retried after a " +
          "dropped response is safe. The response names the mutations that " +
          "landed (drop them from the outbox) and the ones that did not (keep " +
          "them, retry).",
        security: [{ bearerAuth: [] }],
        body: Type.Object({ mutations: Type.Array(Mutation, { maxItems: 200 }) }),
        response: {
          ...commonErrors,
          200: Type.Object({
            data: Type.Object({
              applied: Type.Array(Type.Integer()),
              failed: Type.Array(
                Type.Object({
                  seq: Type.Integer(),
                  code: Type.String(),
                  message: Type.String(),
                }),
              ),
            }),
          }),
        },
      },
    },
    async (request) => {
      const { scope } = authOf(request);
      const applied: number[] = [];
      const failed: { seq: number; code: string; message: string }[] = [];

      for (const mutation of request.body.mutations) {
        try {
          if (mutation.entity === "document") {
            await applyDocumentPatch(scope, Number(mutation.id), mutation.payload);
            applied.push(mutation.seq);
            continue;
          }

          if (mutation.op === "delete") {
            await deleteAnnotation(scope, mutation.id);
            applied.push(mutation.seq);
            continue;
          }

          const row = await upsertAnnotation(scope, {
            clientId: mutation.id,
            ...(mutation.payload as AnnotationInput | undefined),
          } as AnnotationInput);
          if (!row) {
            failed.push({
              seq: mutation.seq,
              code: "conflict",
              message: "That id belongs to another library.",
            });
            continue;
          }
          applied.push(mutation.seq);
        } catch (error) {
          failed.push({
            seq: mutation.seq,
            code: "apply_failed",
            message: error instanceof Error ? error.message : "Unknown failure",
          });
        }
      }

      useLogger().set({
        sync: { applied: applied.length, failed: failed.length },
      });
      return { data: { applied, failed } };
    },
  );

  fastify.get(
    "/sync/pull",
    {
      preHandler: fastify.requireAuth,
      schema: {
        tags: ["sync"],
        summary: "Changes since a cursor",
        description:
          "The cursor is opaque. Send null for a full pull; send the last cursor " +
          "you were given to catch up. Rows come back ordered by write time, and a " +
          "deleted mark comes back as a tombstone — never a missing row.",
        security: [{ bearerAuth: [] }],
        querystring: Type.Object({
          entity: Type.Union([Type.Literal("annotation"), Type.Literal("document")]),
          cursor: Type.Optional(Type.String()),
          limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 1000, default: 500 })),
        }),
        response: { ...commonErrors, 200: Type.Any() },
      },
    },
    async (request) => {
      const { scope } = authOf(request);
      const { entity, cursor, limit } = request.query;

      if (entity === "document") {
        const result = await pullDocuments(scope, cursor ?? null, limit);
        useLogger().set({ sync: { entity, pulled: result.changes.length, hasMore: result.hasMore } });
        return { data: { cursor: result.cursor, hasMore: result.hasMore, documents: result.changes } };
      }

      const result = await pullAnnotations(scope, cursor ?? null, limit);
      useLogger().set({ sync: { entity, pulled: result.changes.length, hasMore: result.hasMore } });
      return { data: { cursor: result.cursor, hasMore: result.hasMore, annotations: result.changes } };
    },
  );
};

export default sync;

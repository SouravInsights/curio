import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "@sinclair/typebox";
import { useLogger } from "evlog/fastify";
import {
  deleteAnnotation,
  recolorAnnotation,
  searchAnnotations,
} from "@curio/core/services/annotations";
import { authOf } from "../../../plugins/auth";
import { commonErrors } from "../../../schemas/response";

const IdParams = Type.Object({ id: Type.Integer({ minimum: 1 }) });

/** The reader's marks: search them, recolour one, erase one. */
const annotations: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    "/annotations",
    {
      preHandler: fastify.requireAuth,
      schema: {
        tags: ["annotations"],
        summary: "Search your highlights and notes",
        security: [{ bearerAuth: [] }],
        querystring: Type.Object({ q: Type.Optional(Type.String()) }),
        response: { ...commonErrors, 200: Type.Any() },
      },
    },
    async (request) => {
      const { scope } = authOf(request);
      const { q } = request.query;
      const rows = await searchAnnotations(scope, q ?? "", 50);
      useLogger().set({ library: { id: scope.libraryId, annotations: rows.length } });
      return { data: rows };
    },
  );

  fastify.patch(
    "/annotations/:id",
    {
      preHandler: fastify.requireAuth,
      schema: {
        tags: ["annotations"],
        summary: "Recolour a mark",
        security: [{ bearerAuth: [] }],
        params: IdParams,
        body: Type.Object({ hue: Type.Integer({ minimum: 0, maximum: 7 }) }),
        response: { ...commonErrors, 200: Type.Any() },
      },
    },
    async (request) => {
      const { scope } = authOf(request);
      const { id } = request.params;
      await recolorAnnotation(scope, id, request.body.hue);
      useLogger().set({ annotation: { id, hue: request.body.hue } });
      return { data: { ok: true } };
    },
  );

  fastify.delete(
    "/annotations/:id",
    {
      preHandler: fastify.requireAuth,
      schema: {
        tags: ["annotations"],
        summary: "Erase a mark",
        security: [{ bearerAuth: [] }],
        params: IdParams,
        response: { ...commonErrors, 200: Type.Any() },
      },
    },
    async (request) => {
      const { scope } = authOf(request);
      const { id } = request.params;
      await deleteAnnotation(scope, id);
      useLogger().set({ annotation: { id, deleted: true } });
      return { data: { ok: true } };
    },
  );
};

export default annotations;

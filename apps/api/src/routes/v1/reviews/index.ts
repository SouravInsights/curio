import type { FastifyPluginAsyncTypebox } from "@fastify/type-provider-typebox";
import { Type } from "@sinclair/typebox";
import { createError } from "evlog";
import { useLogger } from "evlog/fastify";
import { REVIEW_GRADES, gradeReview, reviewQueue, reviewStats } from "@curio/core/services/reviews";
import { authOf } from "../../../plugins/auth";
import { commonErrors } from "../../../schemas/response";

/** Recall: the marks due, and grading one to schedule its return. */
const reviews: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get(
    "/reviews",
    {
      preHandler: fastify.requireAuth,
      schema: {
        tags: ["reviews"],
        summary: "Marks due for recall",
        description:
          "The reader's own highlights that are due for spaced review, plus the counts. " +
          "A mark never reviewed is due.",
        security: [{ bearerAuth: [] }],
        response: { ...commonErrors, 200: Type.Any() },
      },
    },
    async (request) => {
      const { scope } = authOf(request);
      const [cards, stats] = await Promise.all([reviewQueue(scope, 20), reviewStats(scope)]);
      useLogger().set({ review: { due: stats.due, returned: cards.length } });
      return { data: { cards, stats } };
    },
  );

  fastify.post(
    "/reviews/:id",
    {
      preHandler: fastify.requireAuth,
      schema: {
        tags: ["reviews"],
        summary: "Grade a recall card",
        description: "Grade a mark again / hard / good / easy and schedule when it returns.",
        security: [{ bearerAuth: [] }],
        params: Type.Object({ id: Type.String({ minLength: 8 }) }),
        body: Type.Object({
          grade: Type.Union(REVIEW_GRADES.map((grade) => Type.Literal(grade))),
        }),
        response: { ...commonErrors, 200: Type.Any() },
      },
    },
    async (request) => {
      const { scope } = authOf(request);
      const { id } = request.params;
      const result = await gradeReview(scope, id, request.body.grade);
      if (!result) {
        throw createError({
          status: 404,
          message: "not found",
          why: "No mark with that id in this library",
          fix: "Fetch the review queue and grade one of its client ids.",
        });
      }
      useLogger().set({ review: { clientId: id, grade: request.body.grade } });
      return { data: result };
    },
  );
};

export default reviews;

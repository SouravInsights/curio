import fp from "fastify-plugin";
import { closeDb, db } from "@curio/core/db/index";

/**
 * The database. It uses the one shared pool from `@curio/core` rather than
 * opening a second one, so every query in the API runs on the same connections.
 * The pool is closed on shutdown.
 */
export default fp(
  async (fastify) => {
    fastify.decorate("db", db);
    fastify.addHook("onClose", async () => {
      await closeDb();
    });
  },
  { name: "db", dependencies: ["config"] },
);

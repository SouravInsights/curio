// First, so the environment is loaded before any module reads it.
import "./bootstrap";
import closeWithGrace from "close-with-grace";
import { buildApp } from "./app";

/**
 * The API process. It runs on a Fly Sprite so the agent can use a connector —
 * gateway calls only succeed from inside one. Everything else (Neon, the model
 * endpoint) is reached over the network, so the process itself is portable.
 */
const app = await buildApp();

// Stop accepting work, let in-flight requests finish, then exit. `delay` is the
// hard ceiling before the process is killed anyway.
closeWithGrace({ delay: 10_000, logger: false }, async ({ err }) => {
  if (err) app.log.error({ err }, "server closing after an error");
  await app.close();
});

try {
  await app.listen({ host: app.config.API_HOST, port: app.config.PORT });
} catch (error) {
  app.log.error({ err: error }, "server failed to start");
  process.exit(1);
}

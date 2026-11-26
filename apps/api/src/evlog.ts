import { initLogger, toLoggerConfig, toMiddlewareOptions } from 'evlog'
import { evlog } from 'evlog/fastify'
import type { EvlogFastifyOptions } from 'evlog/fastify'
import config from '../evlog.config'

initLogger(toLoggerConfig(config))

/** Register once, before your routes: `await app.register(evlog, evlogOptions)`. */
export { evlog }
export const evlogOptions: EvlogFastifyOptions = toMiddlewareOptions(config)

import { defineEvlog } from 'evlog'
import { createFsDrain } from 'evlog/fs'
import {
  createGeoEnricher,
  createRequestSizeEnricher,
  createTraceContextEnricher,
  createUserAgentEnricher,
} from 'evlog/enrichers'

const enrichers = [
  createUserAgentEnricher(),
  createGeoEnricher(),
  createRequestSizeEnricher(),
  createTraceContextEnricher(),
]

/**
 * Settings for api, read by the app and by the evlog CLI.
 * https://evlog.dev/cli/config
 */
export default defineEvlog({
  service: 'api',
  // Local NDJSON under .evlog/logs, in development only.
  drain: process.env.NODE_ENV === 'production' ? undefined : createFsDrain(),
  enrich: async (ctx) => {
    for (const enrich of enrichers) await enrich(ctx)
  },
})

"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * The query client.
 *
 * Server data lives here, not in a component: the same document asked for twice
 * is fetched once, a revisit is served from cache, and a mutation can declare
 * how it changes what is already on screen instead of triggering a reload.
 *
 * `staleTime` is short and `refetchOnWindowFocus` is off: this is a reading app,
 * not a dashboard. Re-fetching a document because you alt-tabbed back is noise.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

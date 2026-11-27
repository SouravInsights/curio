"use client";

import { useState } from "react";
import { QueryClient, useIsRestoring } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { MAX_AGE, persister } from "@/lib/persist";

/**
 * The query client.
 *
 * Server data lives here, not in a component: the same document asked for twice
 * is fetched once, a revisit is served from cache, and a mutation can declare
 * how it changes what is already on screen instead of triggering a reload.
 *
 * The cache is persisted to IndexedDB. That is the whole trick behind a fast
 * reload: the first paint reads the last session's library and document from
 * disk, then the network revalidates in the background. No skeleton, no spinner,
 * nothing to wait for.
 *
 * `staleTime` is short and `refetchOnWindowFocus` is off: this is a reading app,
 * not a dashboard. Re-fetching a document because you alt-tabbed back is noise.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            // Keep a query in memory as long as the disk copy is allowed to
            // live, or the cache is garbage-collected before it can be read.
            gcTime: MAX_AGE,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{
        persister,
        maxAge: MAX_AGE,
        buster: "v1",
        // Only real answers are worth replaying. A cached 401 or a thrown
        // request would paint an error on the next cold start.
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => query.state.status === "success",
        },
      }}
    >
      <Gate>{children}</Gate>
    </PersistQueryClientProvider>
  );
}

/**
 * Hold the app for the disk read. The library tracks this with `useIsRestoring`;
 * rendering before it lands is what makes a reload flash a skeleton for data
 * that is already on the device. The wait is a plain surface in the app's own
 * background, so it reads as a beat of the page, not a spinner.
 */
function Gate({ children }: { children: React.ReactNode }) {
  const isRestoring = useIsRestoring();
  if (isRestoring) return <div className="min-h-dvh bg-background" aria-hidden />;
  return <>{children}</>;
}

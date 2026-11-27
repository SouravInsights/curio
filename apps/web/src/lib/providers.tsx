"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LocalProvider } from "@/lib/local/provider";
import { ServiceWorker } from "@/components/ServiceWorker";
import { InstallPrompt } from "@/components/InstallPrompt";
import { useMe } from "@/lib/queries";
import { syncTheme } from "@/lib/theme";

/**
 * The query client — for **server-only** reads: search, the agent, topics,
 * connections. Nothing the reader owns lives here; the library list, read state
 * and marks are in IndexedDB (see `@/lib/local`).
 *
 * Nothing is persisted. The disk cache that used to sit behind this provider is
 * gone: a local row is a better cold start than a serialized cache blob, and two
 * stores for the same data was the confusion this replaced.
 *
 * `staleTime` is short and `refetchOnWindowFocus` is off: this is a reading app,
 * not a dashboard. Re-fetching because you alt-tabbed back is noise.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  // Re-apply the stored theme once mounted, so the class and storage can never
  // disagree after hydration.
  useEffect(() => {
    syncTheme();
  }, []);

  return (
    <QueryClientProvider client={client}>
      <LocalProvider>
        <Gate>{children}</Gate>
      </LocalProvider>
      <ServiceWorker />
      <InstallPrompt />
    </QueryClientProvider>
  );
}

/**
 * Hold the app until identity resolves, so a signed-in reload never flashes the
 * sign-in screen. The wait is a plain surface in the app's own background, so it
 * reads as a beat of the page, not a spinner.
 */
function Gate({ children }: { children: React.ReactNode }) {
  const account = useMe();
  if (account.isLoading) return <div className="min-h-dvh bg-background" aria-hidden />;
  return <>{children}</>;
}

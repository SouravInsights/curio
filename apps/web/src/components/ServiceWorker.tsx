"use client";

import { useEffect, useState } from "react";

/**
 * Registers the service worker (`public/sw.js`) and handles app updates.
 *
 * An installed window has no reload button — it is launched or resumed, never
 * "reloaded" — so a phone can sit on a build that is days old with no way out.
 * The worker therefore ships without `skipWaiting()`: a new version waits rather
 * than taking over mid-session. This notices it, offers a Reload, and only then
 * lets it activate. That is the waiting / `SKIP_WAITING` handshake Workbox
 * standardised, and it is why apps show a quiet "new version" bar instead of
 * restarting under you.
 *
 * Production only. In dev a worker would cache dev chunks and make HMR look
 * broken, so any worker left by an earlier production run is unregistered.
 */
export function ServiceWorker() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => registrations.forEach((r) => void r.unregister()))
        .catch(() => {});
      return;
    }

    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    let current: ServiceWorkerRegistration | null = null;

    const announceWaiting = (reg: ServiceWorkerRegistration) => {
      // Only an UPDATE has a controller. A first-ever install also reaches
      // `installed`, but there is nothing to announce.
      if (reg.waiting && navigator.serviceWorker.controller) setRegistration(reg);
    };

    const register = async () => {
      const reg = await navigator.serviceWorker.register("/sw.js");
      current = reg;
      // A worker can already be waiting from an earlier session.
      announceWaiting(reg);
      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed") announceWaiting(reg);
        });
      });
    };

    // A phone resumes an installed app rather than navigating, and the browser
    // only checks the worker on navigation — so check on resume.
    const onVisible = () => {
      if (document.visibilityState === "visible") void current?.update();
    };
    document.addEventListener("visibilitychange", onVisible);

    if (document.readyState === "complete") void register();
    else window.addEventListener("load", () => void register(), { once: true });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!registration) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-4 z-50 mx-auto flex w-fit items-center gap-3 rounded-[var(--radius-card)] border border-border bg-popover px-3 py-2 shadow-popover"
    >
      <span className="type-caption text-foreground">A new version is ready.</span>
      <button
        type="button"
        onClick={() => {
          if (registration.waiting) registration.waiting.postMessage({ type: "SKIP_WAITING" });
          else window.location.reload();
        }}
        className="rounded-[var(--radius-control)] bg-primary px-2.5 py-1 type-caption font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        Reload
      </button>
    </div>
  );
}

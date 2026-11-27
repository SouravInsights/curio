"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Registers the service worker (`public/sw.js`) and handles app updates.
 *
 * An installed window has no reload button — it is launched or resumed, never
 * "reloaded" — so a phone can sit on a build that is days old with no way out.
 * This is what notices and offers a Reload.
 *
 * Two things can go stale, and they need different checks:
 *
 * 1. **The worker.** `registration.update()` finds a changed `sw.js`, and the
 *    waiting / `SKIP_WAITING` handshake activates it. The worker deliberately
 *    ships without `skipWaiting()`, so a new version waits rather than taking
 *    over mid-session.
 * 2. **The app build.** Most deploys change the app, not the worker — new
 *    chunks, same `sw.js` — so `update()` finds nothing and no `updatefound`
 *    fires. That is the case this closes: the build writes its own id into the
 *    client bundle *and* into `/version.json`, and the two are compared on
 *    resume. A mismatch is a new deploy.
 *
 * Production only. In dev a worker would cache dev chunks and make HMR look
 * broken, so any worker left by an earlier production run is unregistered.
 */
export function ServiceWorker() {
  const [ready, setReady] = useState(false);
  const registration = useRef<ServiceWorkerRegistration | null>(null);

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

    const announceIfWaiting = (reg: ServiceWorkerRegistration) => {
      // Only an UPDATE has a controller. A first-ever install also reaches
      // `installed`, but there is nothing to announce.
      if (reg.waiting && navigator.serviceWorker.controller) setReady(true);
    };

    const register = async () => {
      const reg = await navigator.serviceWorker.register("/sw.js");
      registration.current = reg;
      // A worker can already be waiting from an earlier session.
      announceIfWaiting(reg);
      reg.addEventListener("updatefound", () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed") announceIfWaiting(reg);
        });
      });
    };

    // A phone resumes an installed app rather than navigating, and the browser
    // only checks the worker on navigation — so check on resume. `update()`
    // catches a changed worker; the version fetch catches a changed build.
    const ownBuild = process.env.NEXT_PUBLIC_BUILD_ID;
    const checkForUpdate = async () => {
      if (document.visibilityState !== "visible") return;
      void registration.current?.update();
      if (!ownBuild) return;
      try {
        const res = await fetch("/version.json", { cache: "no-store" });
        if (!res.ok) return;
        const { buildId } = (await res.json()) as { buildId?: string };
        if (buildId && buildId !== ownBuild) setReady(true);
      } catch {
        // Offline, or the file is missing. Try again on the next resume.
      }
    };
    document.addEventListener("visibilitychange", checkForUpdate);

    if (document.readyState === "complete") void register();
    else window.addEventListener("load", () => void register(), { once: true });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", checkForUpdate);
    };
  }, []);

  if (!ready) return null;

  // Top, not bottom: the install prompt lives at the bottom, and the two can
  // legitimately coexist (a returning reader who has not installed yet).
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[60] mx-auto flex w-fit items-center gap-3 rounded-[var(--radius-card)] bg-popover px-3 py-2 shadow-popover"
    >
      <span className="type-caption text-foreground">A new version is ready.</span>
      <button
        type="button"
        onClick={() => {
          const waiting = registration.current?.waiting;
          // With a waiting worker, activate it and let `controllerchange` reload.
          // Without one — a build-only change — a plain reload is enough; the
          // worker serves the new HTML network-first.
          if (waiting) waiting.postMessage({ type: "SKIP_WAITING" });
          else window.location.reload();
        }}
        className="rounded-[var(--radius-control)] bg-primary px-2.5 py-1 type-caption font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        Reload
      </button>
    </div>
  );
}

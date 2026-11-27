"use client";

import { useEffect } from "react";

/**
 * Registers the service worker that caches the app shell (`public/sw.js`).
 *
 * Production only. In dev it would serve cached chunks over HMR and hide code
 * changes, so instead any worker left behind by an earlier production run on
 * this origin is unregistered. Registration waits for `load`, so the worker
 * never competes with the first paint for bandwidth.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => registrations.forEach((r) => void r.unregister()))
        .catch(() => {});
      return;
    }

    const register = () => {
      void navigator.serviceWorker.register("/sw.js").catch(() => {});
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}

"use client";

import { DownloadSimple, Export, X } from "@phosphor-icons/react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@curio/ui/components/ui/button";
import { Curio } from "@curio/ui/components/curio/mascot";

/**
 * The install affordance.
 *
 * There is no single install path, so this is not one banner. Chrome and
 * Android fire `beforeinstallprompt`, and that event is the only way to open the
 * native install sheet — so it is captured and stashed rather than left to the
 * browser's own mini-infobar.
 *
 * iOS is the other half. Safari does not implement `beforeinstallprompt`, and
 * neither do Chrome, Firefox or Edge on iOS, because every browser there is
 * WebKit underneath. Waiting on the event meant iOS saw nothing at all. The API
 * does not exist, so the honest affordance is the instruction Apple actually
 * supports: Share → Add to Home Screen. And because that is a Safari feature,
 * Chrome on iOS is told to open in Safari rather than left waiting for a button
 * that will never appear.
 *
 * A dismissal is remembered forever. A prompt that returns after being declined
 * is the fastest way to make an app feel like adware.
 */

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Mode = "native" | "ios-safari" | "ios-other";

const DISMISSED_KEY = "curio:install-dismissed";
const DISMISSED_EVENT = "curio:install-dismissed";

/** iPadOS reports itself as a Macintosh; touch points are what give it away. */
function isIos() {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

/** Only Safari can add a web app to the Home Screen on iOS. */
function isIosSafari() {
  if (!isIos()) return false;
  return !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/.test(navigator.userAgent);
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

// Dismissal is read during render, so it lives outside React: reading
// localStorage in an effect and pushing it into state is a cascading render, and
// `useSyncExternalStore` is the API for exactly this.
function subscribeToDismissal(onChange: () => void) {
  window.addEventListener(DISMISSED_EVENT, onChange);
  return () => window.removeEventListener(DISMISSED_EVENT, onChange);
}

function readDismissed() {
  return window.localStorage.getItem(DISMISSED_KEY) === "1";
}

const subscribeToMount = () => () => {};

export function InstallPrompt() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  // False during SSR and the first client render, so the markup matches; true
  // once mounted, which is when `navigator` and `localStorage` can be read.
  const mounted = useSyncExternalStore(
    subscribeToMount,
    () => true,
    () => false,
  );
  const dismissed = useSyncExternalStore(subscribeToDismissal, readDismissed, () => false);

  useEffect(() => {
    const onPrompt = (raw: Event) => {
      raw.preventDefault();
      setEvent(raw as InstallEvent);
    };
    const onInstalled = () => setEvent(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!event) return;
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === "dismissed") dismiss();
    else setEvent(null);
  }

  function dismiss() {
    window.localStorage.setItem(DISMISSED_KEY, "1");
    window.dispatchEvent(new Event(DISMISSED_EVENT));
    setEvent(null);
  }

  const mode: Mode | null =
    !mounted || dismissed || isStandalone()
      ? null
      : event
        ? "native"
        : isIosSafari()
          ? "ios-safari"
          : isIos()
            ? "ios-other"
            : null;

  if (!mode) return null;

  return (
    <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-50 md:inset-x-auto md:right-5 md:bottom-5 md:w-[364px]">
      <div className="flex items-start gap-3 rounded-[var(--radius-card)] bg-popover p-3 shadow-popover">
        <Curio size={34} still />

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="type-strong">
            {mode === "ios-other" ? "Open in Safari to install" : "Install Curio"}
          </span>
          {mode === "native" ? (
            <span className="type-caption text-muted-foreground">
              Your reading, offline, one tap away.
            </span>
          ) : mode === "ios-safari" ? (
            <span className="type-caption text-muted-foreground">
              Tap <Export className="inline-block size-3 -translate-y-px" weight="bold" /> Share,
              then <span className="font-medium text-foreground">Add to Home Screen</span>.
            </span>
          ) : (
            <span className="type-caption text-muted-foreground">
              Chrome on iOS cannot install web apps. Open Curio in Safari, then Share → Add to Home
              Screen.
            </span>
          )}
        </div>

        {mode === "native" ? (
          <Button size="sm" onClick={install}>
            <DownloadSimple className="size-3.5" weight="bold" />
            Install
          </Button>
        ) : null}

        <Button variant="ghost" size="icon-sm" onClick={dismiss} aria-label="Dismiss install prompt">
          <X className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

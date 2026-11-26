"use client";

import { useEffect, useState } from "react";
import { ArrowSquareOut, Moon, SignOut, Sun, TextAa } from "@phosphor-icons/react";
import { Button } from "@curio/ui/components/ui/button";
import { Curio } from "@curio/ui/components/curio/mascot";
import { SegmentedControl } from "@curio/ui/components/ui/segmented-control";
import { isDark, setDark } from "@/lib/theme";
import { useSignOut } from "@/lib/queries";
import type { Appearance } from "./ReaderAppearance";
import type { Me } from "@/lib/api";

const SCALES = [90, 100, 110, 120, 130];

/**
 * Settings is where the app's own choices live: how text is set, which theme,
 * and who you are. The reading choices are the same ones the reader's toolbar
 * exposes — this is the same state, reachable from somewhere other than an open
 * article, and with room to explain what each one does.
 */
export function SettingsPane({
  user,
  appearance,
  onAppearance,
}: {
  user: Me;
  appearance: Appearance;
  onAppearance: (value: Appearance) => void;
}) {
  const signOut = useSignOut();
  const [dark, setDarkState] = useState(true);
  const [signedOut, setSignedOut] = useState(false);

  useEffect(() => {
    setDarkState(isDark());
  }, []);

  function chooseTheme(next: boolean) {
    setDark(next);
    setDarkState(next);
  }

  async function leave() {
    setSignedOut(true);
    await signOut.mutateAsync();
  }

  return (
    <div className="scroll-contain h-full overflow-y-auto bg-background">
      <div className="mx-auto flex max-w-[640px] flex-col gap-10 px-6 py-12">
        <header className="flex flex-col gap-1">
          <h1 className="type-display">Settings</h1>
          <p className="type-caption">
            How Curio reads, how it looks, and the account your library belongs to.
          </p>
        </header>

        <Section
          icon={<TextAa className="h-4 w-4" />}
          title="Reading"
          note="Applies to every article. The same controls sit in the reader's toolbar."
        >
          <Row label="Typeface">
            <SegmentedControl
              label="Typeface"
              value={appearance.font}
              onChange={(font) => onAppearance({ ...appearance, font })}
              options={[
                { value: "sans", label: "Sans" },
                { value: "serif", label: "Serif" },
              ]}
            />
          </Row>
          <Row label="Text size">
            <SegmentedControl
              label="Text size"
              value={appearance.scale}
              onChange={(scale) => onAppearance({ ...appearance, scale })}
              options={SCALES.map((scale) => ({ value: scale, label: `${scale}%` }))}
            />
          </Row>
          <Row label="Column width">
            <SegmentedControl
              label="Column width"
              value={appearance.width}
              onChange={(width) => onAppearance({ ...appearance, width })}
              options={[
                { value: "narrow", label: "Narrow" },
                { value: "wide", label: "Wide" },
              ]}
            />
          </Row>
        </Section>

        <Section icon={dark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />} title="Theme">
          <Row label="Appearance">
            <SegmentedControl
              label="Theme"
              value={dark ? "dark" : "light"}
              onChange={(value) => chooseTheme(value === "dark")}
              options={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
            />
          </Row>
        </Section>

        <Section title="Account">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-muted text-green-600 dark:text-green-500">
                <Curio size={22} still />
              </span>
              <div className="min-w-0">
                <p className="type-body truncate text-foreground">{user.name || "Reader"}</p>
                <p className="type-caption truncate text-faint-foreground">{user.email}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" disabled={signedOut} onClick={() => void leave()}>
              <SignOut className="h-4 w-4" />
              {signedOut ? "Signing out…" : "Sign out"}
            </Button>
          </div>
        </Section>

        <Section title="Your library, elsewhere">
          <p className="type-caption">
            The same library is available to the agents you already run, over MCP and a CLI. The
            HTTP API the app uses is documented on its own page.
          </p>
          <a
            href="/docs"
            className="type-body inline-flex items-center gap-1.5 text-foreground underline underline-offset-4"
          >
            The API and the harness
            <ArrowSquareOut className="h-3.5 w-3.5" />
          </a>
        </Section>

        <p className="type-caption text-faint-foreground">Curio 0.1.0</p>
      </div>
    </div>
  );
}

function Section({
  icon,
  title,
  note,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 border-t border-border pt-6">
      <div className="flex flex-col gap-1">
        <h2 className="type-heading flex items-center gap-2">
          {icon ? <span className="text-muted-foreground">{icon}</span> : null}
          {title}
        </h2>
        {note ? <p className="type-caption">{note}</p> : null}
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-4">
      <span className="type-body text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

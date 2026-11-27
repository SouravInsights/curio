"use client";

import { useEffect, useState } from "react";
import { ArrowSquareOut, SignOut } from "@phosphor-icons/react";
import { Button } from "@curio/ui/components/ui/button";
import { Curio } from "@curio/ui/components/curio/mascot";
import { SegmentedControl } from "@curio/ui/components/ui/segmented-control";
import { isDark, setDark } from "@/lib/theme";
import { useSignOut } from "@/lib/queries";
import { TextSizeStepper } from "./TextSizeStepper";
import type { Appearance } from "./ReaderAppearance";
import type { Me } from "@/lib/api";

/**
 * Settings: the app's own choices.
 *
 * A page, not a form. A section header, then rows — a label (and a line of why)
 * on the left, its control on the right. Rows are separated by a hairline and
 * sections by space; a border around every section is a box, and boxes inside
 * boxes read as noise.
 *
 * The reading controls are the same state the reader's toolbar exposes. This is
 * the discoverable home; the panel is the in-context one, and both use the same
 * two controls so they cannot disagree.
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
      <div className="mx-auto flex max-w-[600px] flex-col gap-9 px-6 py-12">
        <header>
          <h1 className="type-display">Settings</h1>
          <p className="type-caption mt-1.5">
            How Curio reads, how it looks, and the account your library belongs to.
          </p>
        </header>

        <Section title="Reading">
          <Row label="Typeface" description="Serif is the default; sans runs a little smaller.">
            <SegmentedControl
              label="Typeface"
              value={appearance.font}
              onChange={(font) => onAppearance({ ...appearance, font })}
              options={[
                { value: "serif", label: "Serif" },
                { value: "sans", label: "Sans" },
              ]}
            />
          </Row>
          <Row label="Text size">
            <TextSizeStepper
              value={appearance.scale}
              onChange={(scale) => onAppearance({ ...appearance, scale })}
            />
          </Row>
          <Row label="Column width" description="Narrow keeps the line shorter.">
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

        <Section title="Appearance">
          <Row label="Theme" description="Chosen once, kept across visits.">
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
          <div className="flex items-center gap-3 py-3.5">
            <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-muted text-green-600 dark:text-green-500">
              <Curio size={20} still />
            </span>
            <div className="min-w-0 flex-1">
              <p className="type-body truncate text-foreground">{user.name || "Reader"}</p>
              <p className="type-caption truncate text-faint-foreground">{user.email}</p>
            </div>
            <Button variant="outline" size="sm" disabled={signedOut} onClick={() => void leave()}>
              <SignOut className="h-3.5 w-3.5" />
              {signedOut ? "Signing out…" : "Sign out"}
            </Button>
          </div>
        </Section>

        <Section title="Elsewhere">
          <div className="py-3.5">
            <p className="type-caption">
              The same library is available to the agents you already run, over MCP and a CLI.
            </p>
            <a
              href="/docs"
              className="mt-1.5 inline-flex items-center gap-1.5 type-body text-foreground underline decoration-border underline-offset-2 transition-colors hover:decoration-foreground"
            >
              The API and the harness
              <ArrowSquareOut className="h-3.5 w-3.5" />
            </a>
          </div>
        </Section>

        <p className="type-caption text-faint-foreground">Curio 0.1.0</p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="type-label">{title}</h2>
      <div className="mt-1.5 divide-y divide-border">{children}</div>
    </section>
  );
}

function Row({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className="min-w-0">
        <p className="type-body text-foreground">{label}</p>
        {description ? (
          <p className="type-caption mt-0.5 text-faint-foreground">{description}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center">{children}</div>
    </div>
  );
}

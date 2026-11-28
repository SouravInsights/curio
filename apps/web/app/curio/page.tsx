import type { Metadata } from "next";
import { CurioHome } from "@/components/curio/CurioHome";

/**
 * Curio's own page — the agent with the whole screen, library-wide. The rail's
 * co-reader is the same agent beside one document; this is the same agent over
 * everything the reader has saved.
 */
export const metadata: Metadata = {
  // `absolute` so the layout's `%s · Curio` template does not double the name.
  title: { absolute: "Ask Curio" },
  description: "Ask Curio anything you have read. Answers cite the lines they came from.",
};

export default function CurioPage() {
  return <CurioHome />;
}

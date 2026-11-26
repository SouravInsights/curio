#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { askOnce } from "@/agent/agent.ts";
import { searchLibrary } from "@/agent/actions.ts";
import { buildTopicVocabulary } from "@/kb/topics.ts";
import { pipelineModel } from "@/kb/model.ts";
import { db, closeDb } from "@/db/index.ts";
import { documents } from "@/db/schema.ts";
import { eq, sql } from "drizzle-orm";
import { serveStdio } from "@/harness/mcp.ts";
import { resolveScope } from "@/harness/scope.ts";
import { importDocuments, pendingDocuments } from "@/imports/ingest.ts";
import {
  parseBookmarks,
  parseKindleClippings,
  parseMarkdown,
  parseReadwiseCsv,
} from "@/imports/parsers.ts";
import type { ImportedDocument } from "@/imports/types.ts";

/**
 * The harness CLI. Every command runs the same code the app and MCP do.
 *
 *   curio mcp                     speak MCP over stdio
 *   curio build [--limit 20]      read → understand → embed the pending queue
 *   curio search "query" [--exact]
 *   curio ask "question"          one answer through the real agent
 *   curio import <file>           bookmarks / readwise csv / kindle / markdown
 *   curio report                  the state of the library
 */

interface Args {
  command: string;
  positional: string[];
  flags: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): Args {
  const [command = "help", ...rest] = argv;
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]!;
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = rest[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { command, positional, flags };
}

async function importFile(path: string): Promise<ImportedDocument[]> {
  const content = await readFile(path, "utf8");
  const ext = extname(path).toLowerCase();
  const label = path.split("/").pop() ?? path;

  if (ext === ".html" || ext === ".htm") return parseBookmarks(content);
  if (ext === ".csv") return parseReadwiseCsv(content);
  if (ext === ".txt" && /==========/.test(content)) return parseKindleClippings(content);
  return parseMarkdown(content, label);
}

async function build(limit: number, render: boolean): Promise<void> {
  const scope = await resolveScope();
  const pending = await pendingDocuments(limit);
  if (pending.length === 0) {
    console.log("Nothing to build.");
    return;
  }

  // The vocabulary leash: existing topics, so a run settles on shared words.
  const rows = await db
    .select({ topics: documents.topics })
    .from(documents)
    .where(eq(documents.libraryId, scope.libraryId));
  const { vocabulary, winningSpellings } = await buildTopicVocabulary(
    rows.map((r) => r.topics),
    pipelineModel(),
  );

  console.log(`build · ${pending.length} to process`);
  const { buildDocument } = await import("@/kb/store.ts");
  for (const row of pending) {
    const outcome = await buildDocument(row, {
      render,
      knownTopics: vocabulary,
      winningSpellings,
    });
    mark(outcome.read, row.title || row.externalId, outcome.passages, outcome.readDetail);
  }
  await closeDb();
}

function mark(read: string, label: string, passages: number, detail?: string): void {
  const glyph = read === "failed" ? "✗" : read === "thin" ? "⚠" : "✓";
  console.log(`${glyph} ${label} · ${passages} passage(s)${detail ? ` · ${detail}` : ""}`);
}

async function main(): Promise<void> {
  const { command, positional, flags } = parseArgs(process.argv.slice(2));

  switch (command) {
    case "mcp": {
      await serveStdio(await resolveScope());
      return;
    }
    case "build": {
      await build(Number(flags.limit ?? 20), Boolean(flags.render));
      return;
    }
    case "search": {
      const scope = await resolveScope();
      const hits = await searchLibrary(scope, positional.join(" "), {
        mode: flags.exact ? "exact" : "hybrid",
        limit: Number(flags.limit ?? 8),
      });
      for (const hit of hits) {
        console.log(`\n${hit.title} [${hit.documentId}] ${hit.url ?? ""}`);
        for (const p of hit.passages) console.log(`  ${p.startLine}-${p.endLine}: ${p.content.slice(0, 200)}`);
      }
      await closeDb();
      return;
    }
    case "ask": {
      const scope = await resolveScope();
      console.log(await askOnce(positional.join(" "), scope));
      await closeDb();
      return;
    }
    case "import": {
      const scope = await resolveScope();
      const path = positional[0];
      if (!path) throw new Error("usage: curio import <file>");
      const docs = await importFile(path);
      const result = await importDocuments(scope.libraryId, null, docs, {
        build: !flags["no-build"],
      });
      console.log(
        `imported ${result.added} new · ${result.skipped} existed · ${result.built} built`,
      );
      await closeDb();
      return;
    }
    case "report": {
      const scope = await resolveScope();
      const [row] = await db
        .select({
          total: sql<number>`count(*)::int`,
          unread: sql<number>`count(*) filter (where ${documents.readState} = 'unread')::int`,
          pending: sql<number>`count(*) filter (where ${documents.readStatus} = 'pending')::int`,
          books: sql<number>`count(*) filter (where ${documents.kind} = 'book')::int`,
        })
        .from(documents)
        .where(eq(documents.libraryId, scope.libraryId));
      console.log(JSON.stringify(row, null, 2));
      await closeDb();
      return;
    }
    default:
      console.log(
        [
          "curio <command>",
          "  mcp                 speak MCP over stdio",
          "  build [--limit N]   read → understand → embed the pending queue",
          "  search <query>      hybrid search [--exact] [--kind] [--limit]",
          "  ask <question>      one answer through the real agent",
          "  import <file>       bookmarks / readwise csv / kindle / markdown",
          "  report              the state of the library",
        ].join("\n"),
      );
  }
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await closeDb().catch(() => undefined);
  process.exit(1);
});

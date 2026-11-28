import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Reading skills — the playbooks a coding harness does not have.
 *
 * A skill is a named way to read, authored as `skills/<name>/SKILL.md` with YAML
 * frontmatter (`name`, `description`) and a markdown body. That is the portable
 * agent-skills convention: the same directory installs into pi, Claude Code,
 * Codex or Cursor, and the in-app agent loads the same files.
 *
 * The index (name + description) rides in the system prompt; the body loads only
 * when the model calls `use_skill`. So a dozen skills cost a dozen lines until
 * one is used.
 *
 * The content is data on disk, not code: a reader can add a skill without
 * touching the engine. The directory is `skills/` at the repo root, or
 * `CURIO_SKILLS_DIR` when the library lives elsewhere.
 */

export interface ReadingSkill {
  /** The frontmatter `name`, or the directory name when absent. */
  name: string;
  /** One line: when to reach for it. */
  description: string;
  /** The playbook. */
  body: string;
}

const DEFAULT_SKILLS_DIR = fileURLToPath(new URL("../../../../skills/", import.meta.url));

export function skillsDir(): string {
  return process.env.CURIO_SKILLS_DIR ?? DEFAULT_SKILLS_DIR;
}

/** Split `---\nname: x\ndescription: y\n---\nbody`. Flat keys only; that is all we use. */
function parseFrontmatter(raw: string): {
  data: Record<string, string>;
  body: string;
} {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { data: {}, body: raw.trim() };
  const data: Record<string, string> = {};
  for (const line of match[1]!.split(/\r?\n/)) {
    const entry = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!entry) continue;
    let value = entry[2]!.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    data[entry[1]!] = value;
  }
  return { data, body: raw.slice(match[0].length).trim() };
}

function loadSkills(): ReadingSkill[] {
  const dir = skillsDir();
  if (!existsSync(dir)) return [];
  const skills: ReadingSkill[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = join(dir, entry.name, "SKILL.md");
    if (!existsSync(file)) continue;
    const { data, body } = parseFrontmatter(readFileSync(file, "utf8"));
    skills.push({
      name: data.name || entry.name,
      description: data.description ?? "",
      body,
    });
  }
  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

let cache: ReadingSkill[] | null = null;

/** Every skill, sorted by name. Loaded once; the process restarts on a change. */
export function readingSkills(): ReadingSkill[] {
  cache ??= loadSkills();
  return cache;
}

/** The skill with this name, or undefined. */
export function findSkill(name: string): ReadingSkill | undefined {
  return readingSkills().find((skill) => skill.name === name);
}

/**
 * The index the system prompt carries: name and when to use it, no body.
 */
export function skillIndex(): string {
  const skills = readingSkills();
  if (skills.length === 0) return "(none installed)";
  return skills.map((skill) => `- ${skill.name}: ${skill.description}`).join("\n");
}

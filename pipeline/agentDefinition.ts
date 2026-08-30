/**
 * The same idea as `parse.ts`, applied to the agents themselves.
 *
 * `parse.ts` checks the artifacts the chain produces. Nothing checked the definitions that
 * produce them: drop `name` from `.claude/agents/ba.md`, or lose a mandatory section, and the
 * agent simply starts behaving differently. The cause is then hunted for in the prompt rather
 * than in the frontmatter.
 *
 * The problems are returned rather than thrown, prefixed `ERROR` or `WARN`, so a caller can
 * decide which of the two fails a build.
 */

const FRONTMATTER_FENCE = '---';
// `tools` is here for the same reason `model` is. All three definitions set it, and ta.md is the
// one that matters: it is the only agent granted `Bash` and `Edit`. A dropped `tools:` line does
// not fail — the agent silently receives the default tool set, writes what it can and reports the
// rest as impossible, and the cause is then hunted for in the prompt.
const REQUIRED_KEYS = ['name', 'description', 'model', 'tools'];
const REQUIRED_SECTIONS = ['## Your task', '## Forbidden'];
const MINIMUM_BODY_WORDS = 50;

/**
 * Who wrote a definition, which decides how much of this project's shape it may be held to.
 *
 * `authored` — written here, and held to everything below.
 * `vendored` — installed by a tool (`npx playwright init-agents`), and held only to the rules that
 *   apply to any Claude agent definition at all. Reshaping somebody else's agent to carry our
 *   section headings would be editing a file the next `init-agents` overwrites, and a check whose
 *   fix is "edit a file you do not own" gets switched off rather than obeyed.
 */
export type AgentOrigin = 'authored' | 'vendored';

/**
 * Every definition expected under `.claude/agents/`, and who wrote it.
 *
 * ⛔ This table is not the list of files to check — the **directory** is. Its only job is to say
 * which of two standards each file is held to, and a file that appears in the directory without
 * appearing here fails the check by name. That inversion is the point: before it, the suite
 * validated four agents it knew about and silently ignored every agent added afterwards, which is
 * how three vendored definitions arrived unchecked on 30 August 2026 and how a fifth written here
 * would have arrived unchecked tomorrow.
 *
 * 🔑 The failure it replaces is one this repository keeps finding: a rule stored as a list of
 * answers instead of as the question that produces them. The question is "what is in the
 * directory"; this table only answers "and by whose standard".
 */
export const AGENT_ORIGINS: Readonly<Record<string, AgentOrigin>> = {
  'ba.md': 'authored',
  'qa.md': 'authored',
  'ta.md': 'authored',
  'critic.md': 'authored',
  'playwright-test-planner.md': 'vendored',
  'playwright-test-generator.md': 'vendored',
  'playwright-test-healer.md': 'vendored',
};

/** Reads the value of a top-level `key: value` line, or an empty string when there is none. */
function frontmatterValue(lines: string[], key: string): string {
  for (const line of lines) {
    const match = new RegExp(`^${key}:\\s*(.+)$`).exec(line);
    if (match) return match[1].trim();
  }
  return '';
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter((word) => word.length > 0).length;
}

export function validateAgentDefinition(
  markdown: string,
  fileName: string,
  origin: AgentOrigin = 'authored'
): string[] {
  // First, and returning immediately, on purpose. A single trailing \r makes every check below
  // fail in a way that reads as a lie: the frontmatter check reports a missing "---" for a file
  // that plainly starts with "---", because what it actually read was "---\r". Everything after
  // this point may assume LF.
  if (markdown.includes('\r')) {
    return [`ERROR ${fileName}: the file contains a carriage return; line endings must be LF`];
  }

  const problems: string[] = [];
  const lines = markdown.split('\n');

  if (lines[0] !== FRONTMATTER_FENCE) {
    return [`ERROR ${fileName}: the file must start with a ${FRONTMATTER_FENCE} frontmatter fence`];
  }

  const closing = lines.indexOf(FRONTMATTER_FENCE, 1);
  if (closing === -1) {
    return [`ERROR ${fileName}: the frontmatter is never closed by a ${FRONTMATTER_FENCE} line`];
  }

  const frontmatter = lines.slice(1, closing);
  const body = lines.slice(closing + 1).join('\n');

  for (const key of REQUIRED_KEYS) {
    if (!frontmatterValue(frontmatter, key)) {
      problems.push(`ERROR ${fileName}: the frontmatter has no ${key}`);
    }
  }

  const name = frontmatterValue(frontmatter, 'name');
  const expected = fileName.replace(/\.[^.]+$/, '');
  if (name && name !== expected) {
    problems.push(`ERROR ${fileName}: name is "${name}", but the file name says "${expected}"`);
  }

  // Skipped for a vendored definition, and only this. Everything above and below applies to any
  // agent definition whatever its author: a name that disagrees with its file name is broken for
  // Claude, not for us, and so is frontmatter that never closes.
  if (origin === 'authored') {
    for (const section of REQUIRED_SECTIONS) {
      if (!body.includes(section)) {
        problems.push(`ERROR ${fileName}: the body has no ${section} section`);
      }
    }
  }

  const words = wordCount(body);
  if (words <= MINIMUM_BODY_WORDS) {
    problems.push(
      `WARN ${fileName}: the body is ${words} words, which is too short to be instructions`
    );
  }

  return problems;
}

/** One file of `.claude/agents/`, read by the caller so this module touches no filesystem. */
export type AgentFile = {
  /** The base name, e.g. `critic.md` — what `AGENT_ORIGINS` is keyed by. */
  readonly name: string;
  readonly markdown: string;
};

/**
 * Validates the agents directory as a whole: everything present, and nothing missing.
 *
 * Three failures, and the first is the one that did not exist before:
 *
 * 1. **A file nobody declared.** It is not skipped and not guessed at — it fails, and the message
 *    says what to add. A new agent is therefore checked from the moment it lands, and declaring it
 *    `vendored` to quiet the check is a visible line in a diff rather than an absence nobody sees.
 * 2. **A declared file that is gone.** `AGENT_ORIGINS` naming a definition the repository no
 *    longer has means an agent was deleted and something still expects it.
 * 3. **A definition out of shape**, by the standard its origin sets.
 */
export function agentDirectoryProblems(files: readonly AgentFile[]): string[] {
  const problems: string[] = [];
  const present = new Set(files.map((file) => file.name));

  for (const name of Object.keys(AGENT_ORIGINS)) {
    if (!present.has(name)) {
      problems.push(
        `ERROR ${name}: declared in AGENT_ORIGINS but not present in .claude/agents/. ` +
          `Restore the file, or remove the declaration.`
      );
    }
  }

  for (const file of files) {
    const origin = AGENT_ORIGINS[file.name];

    if (!origin) {
      problems.push(
        `ERROR ${file.name}: present in .claude/agents/ but not declared in AGENT_ORIGINS. ` +
          `Add it as "authored" if this project wrote it, or "vendored" if a tool installed it. ` +
          `An undeclared definition is not skipped, because that is how three of them once ` +
          `arrived unchecked.`
      );
      continue;
    }

    problems.push(...validateAgentDefinition(file.markdown, file.name, origin));
  }

  return problems;
}

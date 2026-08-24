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
const REQUIRED_KEYS = ['name', 'description'];
const REQUIRED_SECTIONS = ['## Your task', '## Forbidden'];
const MINIMUM_BODY_WORDS = 50;

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

export function validateAgentDefinition(markdown: string, fileName: string): string[] {
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

  for (const section of REQUIRED_SECTIONS) {
    if (!body.includes(section)) {
      problems.push(`ERROR ${fileName}: the body has no ${section} section`);
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

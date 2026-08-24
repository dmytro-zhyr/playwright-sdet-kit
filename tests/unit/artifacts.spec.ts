import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateRules } from '@/pipeline/parse';
import { validateAgentDefinition } from '@/pipeline/agentDefinition';

// The repository root, reached from tests/unit/, so the paths below do not depend on the
// directory the runner happened to be started from.
const ROOT = join(__dirname, '..', '..');

function read(...segments: string[]): string {
  return readFileSync(join(ROOT, ...segments), 'utf-8');
}

// Turns red if the real artifact stops satisfying the format the parser enforces — a duplicate or
// skipped identifier, a rule with no Source or Statement, a Kind that is neither explicit nor
// assumed, or a missing mandatory section. The validator has its own unit tests; this one is the
// only place where the artifact the QA agent will actually read is checked.
test('pipeline/01-rules.md passes validation', () => {
  const markdown = read('pipeline', '01-rules.md');

  expect(validateRules(markdown), 'problems found in the rules file').toEqual([]);
});

// Turns red if the BA agent's own definition drifts out of shape — frontmatter that does not
// open or close, a missing name or description, a name that no longer matches the file, a lost
// `## Your task` or `## Forbidden` section, or a carriage return sneaking back in. Without this
// the agent would simply start behaving differently and the cause would be hunted for in its
// output rather than in its frontmatter.
test('.claude/agents/ba.md passes validation', () => {
  const markdown = read('.claude', 'agents', 'ba.md');

  expect(validateAgentDefinition(markdown, 'ba.md'), 'problems found in the BA agent').toEqual([]);
});

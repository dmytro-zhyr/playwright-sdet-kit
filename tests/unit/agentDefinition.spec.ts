import { test, expect } from '@playwright/test';
import { validateAgentDefinition } from '@/pipeline/agentDefinition';

const BODY = `## Your task

Read the specification and write down every rule it states, one numbered entry per rule, with the
section it came from and the exact sentence that supports it. When the specification is silent but
a rule is still needed to write a test, record it separately as an assumption rather than folding
it into the list of things the specification actually says.

## Forbidden

Do not invent endpoints, do not write tests, and do not commit anything.
`;

const DEFINITION = `---
name: ba
description: Turns the specification into numbered rules.
tools: Read, Write, Grep, Glob
model: opus
---

${BODY}`;

/** Returns the definition with one line dropped, so each test can break exactly one thing. */
function without(markdown: string, line: string): string {
  return markdown
    .split('\n')
    .filter((candidate) => candidate !== line)
    .join('\n');
}

// Turns red if a definition that satisfies every check is still reported as a problem — the
// validator would then be noise in CI and would be ignored, which is worse than not having it.
test('a well-formed definition produces no problems', () => {
  expect(validateAgentDefinition(DEFINITION, 'ba.md')).toEqual([]);
});

// Turns red if a file with no frontmatter at all is accepted — the agent would be loaded with no
// name and no description, and the loader, not the validator, would be the one to complain.
test('the frontmatter has to open', () => {
  const problems = validateAgentDefinition(BODY, 'ba.md');

  expect(problems.join(' ')).toContain('ERROR');
  expect(problems.join(' ')).toContain('---');
});

// Turns red if an unterminated frontmatter is accepted — the whole body would be swallowed into
// the YAML block and the agent would receive no instructions.
test('the frontmatter has to close', () => {
  const unterminated = `---
name: ba
description: Turns the specification into numbered rules.

${BODY}`;

  const problems = validateAgentDefinition(unterminated, 'ba.md');

  expect(problems.join(' ')).toContain('ERROR');
  expect(problems.join(' ')).toContain('close');
});

// Turns red if a definition without `name` is accepted — the agent could not be addressed by
// name and every reference to it elsewhere would silently resolve to nothing.
test('the frontmatter has to carry a name', () => {
  const problems = validateAgentDefinition(without(DEFINITION, 'name: ba'), 'ba.md');

  expect(problems.join(' ')).toContain('name');
  expect(problems.join(' ')).toContain('ERROR');
});

// Turns red if a definition without `description` is accepted — nothing would tell a caller when
// this agent is the right one to invoke.
test('the frontmatter has to carry a description', () => {
  const problems = validateAgentDefinition(
    without(DEFINITION, 'description: Turns the specification into numbered rules.'),
    'ba.md'
  );

  expect(problems.join(' ')).toContain('description');
  expect(problems.join(' ')).toContain('ERROR');
});

// Turns red if a definition without `model` is accepted — the agent would run on whatever model
// the session happens to default to, and two runs of the same chain would not be comparable.
test('the frontmatter has to carry a model', () => {
  const problems = validateAgentDefinition(without(DEFINITION, 'model: opus'), 'ba.md');

  expect(problems.join(' ')).toContain('model');
  expect(problems.join(' ')).toContain('ERROR');
});

// Turns red if a definition without `tools` is accepted — the agent would be handed whatever tool
// set the session defaults to. `ta.md` is the one that would suffer: it is the only agent granted
// `Bash` and `Edit`, and without them it would report half its cases as impossible to automate
// rather than say it had been given no way to write a file.
test('the frontmatter has to carry a tools line', () => {
  const problems = validateAgentDefinition(
    without(DEFINITION, 'tools: Read, Write, Grep, Glob'),
    'ba.md'
  );

  expect(problems.join(' ')).toContain('tools');
  expect(problems.join(' ')).toContain('ERROR');
});

// Turns red if the check starts insisting on one particular tool set — it exists to make the
// grant explicit, not to decide which tools an agent is allowed to hold.
test('any declared tool set satisfies the check', () => {
  const wider = DEFINITION.replace(
    'tools: Read, Write, Grep, Glob',
    'tools: Read, Write, Edit, Grep, Glob, Bash'
  );

  expect(validateAgentDefinition(wider, 'ba.md')).toEqual([]);
});

// Turns red if the check starts insisting on one particular model — it exists to make the choice
// explicit and stable, not to hard-code which model the chain is allowed to run on.
test('any pinned model satisfies the check', () => {
  const pinned = DEFINITION.replace('model: opus', 'model: sonnet');

  expect(validateAgentDefinition(pinned, 'ba.md')).toEqual([]);
});

// Turns red if the name is allowed to drift from the file name — a rename of the file would
// leave the definition answering to an identifier nobody uses.
test('the name has to match the file name', () => {
  const problems = validateAgentDefinition(DEFINITION, 'qa.md');

  expect(problems.join(' ')).toContain('ERROR');
  expect(problems.join(' ')).toContain('qa');
});

// Turns red if a definition with no `## Your task` section is accepted — the agent would have a
// description but no instructions, and would improvise.
test('the body has to contain a task section', () => {
  const problems = validateAgentDefinition(without(DEFINITION, '## Your task'), 'ba.md');

  expect(problems.join(' ')).toContain('Your task');
  expect(problems.join(' ')).toContain('ERROR');
});

// Turns red if a definition with no `## Forbidden` section is accepted — the chain relies on
// each agent knowing what it must not do, committing above all.
test('the body has to contain a forbidden section', () => {
  const problems = validateAgentDefinition(without(DEFINITION, '## Forbidden'), 'ba.md');

  expect(problems.join(' ')).toContain('Forbidden');
  expect(problems.join(' ')).toContain('ERROR');
});

// Turns red if a stub body passes unremarked — a definition that short is a placeholder, and the
// warning is what says so out loud without failing the build.
test('a body shorter than fifty words is a warning, not an error', () => {
  const stub = `---
name: ba
description: Turns the specification into numbered rules.
tools: Read, Write, Grep, Glob
model: opus
---

## Your task

Write the rules down.

## Forbidden

Do not commit.
`;

  const problems = validateAgentDefinition(stub, 'ba.md');

  expect(problems.join(' ')).toContain('WARN');
  expect(problems.join(' ')).not.toContain('ERROR');
});

// Turns red if a carriage return stops being reported first: the frontmatter check then reads
// "---\r", insists the file does not start with "---", and sends the reader hunting for a dash
// that is plainly there.
test('a carriage return is reported first and on its own', () => {
  const problems = validateAgentDefinition(DEFINITION.replace(/\n/g, '\r\n'), 'ba.md');

  expect(problems).toHaveLength(1);
  expect(problems[0]).toContain('ERROR');
  expect(problems[0]).toContain('carriage return');
});

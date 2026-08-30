import { mergeExpects, mergeTests } from '@playwright/test';
import { test as apiTest } from '@/api/apiFixtures';
import { test as deploymentTest } from '@/api/deploymentFixtures';
import { test as dataTest } from '@/data/dataFixtures';
import { test as poTest } from '@/po/poFixtures';
import { expect as schemaExpect } from '@/schemas/toMatchSchema';

// `po` joins as one more argument, which is the whole point of composing fixtures this way:
// the UI layer arrived in stage 3 without a line changing in api/ or data/. A test that never
// names a page object still starts no browser — Playwright builds only the fixtures a test asks
// for, so the contract suite is unaffected by this addition.
export const test = mergeTests(apiTest, deploymentTest, dataTest, poTest);
export const expect = mergeExpects(schemaExpect);

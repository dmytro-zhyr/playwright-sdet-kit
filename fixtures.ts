import { mergeExpects, mergeTests } from '@playwright/test';
import { test as apiTest } from '@/api/apiFixtures';
import { test as dataTest } from '@/data/dataFixtures';
import { expect as schemaExpect } from '@/schemas/toMatchSchema';

export const test = mergeTests(apiTest, dataTest);
export const expect = mergeExpects(schemaExpect);

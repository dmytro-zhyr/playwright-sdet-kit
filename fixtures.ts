import { mergeTests } from '@playwright/test';
import { test as apiTest } from '@/api/apiFixtures';
import { test as dataTest } from '@/data/dataFixtures';

export const test = mergeTests(apiTest, dataTest);
export { expect } from '@playwright/test';

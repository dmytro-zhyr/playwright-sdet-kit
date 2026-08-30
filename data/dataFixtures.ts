import { test as base } from '@playwright/test';
import { userFactory } from '@data/userFactory';
import { articleFactory } from '@data/articleFactory';
import { commentFactory } from '@data/commentFactory';

export type DataFixtures = {
  factories: {
    user: typeof userFactory;
    article: typeof articleFactory;
    comment: typeof commentFactory;
  };
};

// Factories are pure: no network, no dependency on other fixtures. That is why they live here and
// not next to the API client — it keeps the two fixture modules independent, which is what makes
// mergeTests trivial rather than order-dependent.
export const test = base.extend<DataFixtures>({
  factories: async ({}, use) => {
    await use({ user: userFactory, article: articleFactory, comment: commentFactory });
  },
});

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'warn',
      // `async ({}, use) => {}` is how Playwright declares a fixture that depends on no other
      // fixture — it reads the destructuring pattern to work out the dependency graph. The rule
      // stays on everywhere else, so `const {} = value` is still an error.
      'no-empty-pattern': ['error', { allowObjectPatternsAsParameters: true }],
    },
  },
  { ignores: ['node_modules/', 'test-results/', 'playwright-report/'] }
);

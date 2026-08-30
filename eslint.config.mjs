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
      // A Playwright test names the fixtures it needs by destructuring them, and naming one is
      // what causes it to run. So a fixture wanted only for its side effect — `signedIn` seeds a
      // session into the browser and is often never read afterwards — is *used* in every sense
      // that matters, and unreadable to this rule. `signedIn` is listed by name rather than by a
      // loose pattern: a blanket exemption here would also stop catching a fixture requested by
      // mistake, which is the thing the rule is worth keeping for.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^signedIn$' }],
    },
  },
  {
    // Plain-JavaScript files run by node directly — report/generate.mjs, and this config. They get
    // no type information, so `no-undef` is live for them where it is off for TypeScript, and
    // node's own globals have to be declared or every `process` and `console` reads as a typo.
    files: ['**/*.mjs'],
    languageOptions: {
      globals: { process: 'readonly', console: 'readonly', URL: 'readonly' },
    },
  },
  {
    ignores: [
      'node_modules/',
      'test-results/',
      'playwright-report/',
      'allure-results/',
      'allure-report/',
    ],
  }
);

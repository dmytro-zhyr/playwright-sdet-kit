import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import playwright from 'eslint-plugin-playwright';

export default tseslint.config(
  js.configs.recommended,
  // `recommendedTypeChecked`, not `recommended`: the difference is that the second set of rules
  // is allowed to ask the type checker questions, and the question worth asking in a Playwright
  // repository is *was this promise awaited*. `no-floating-promises` cannot be written without
  // types — nothing in the syntax of `expect(locator).toBeVisible()` says whether it returns one —
  // and a missing `await` there does not fail. It produces a test that finishes before the
  // assertion resolves and reports success. Playwright's own best-practices page names this rule
  // for that reason.
  //
  // That is the same failure this repository already found by hand: a check that cannot go red.
  // `{"comments": []}` satisfied its schema for a week (spec/FINDINGS.md, "How D-12 was missed").
  // The lesson there was that review does not catch a quiet check reliably; a type-aware linter
  // catches this class of it every run, for free.
  ...tseslint.configs.recommendedTypeChecked,
  prettier,
  {
    // Type-aware rules need a program to ask, and `projectService` builds it from tsconfig.json.
    // Scoped to TypeScript on purpose: tsconfig `include` is `**/*.ts`, so a .mjs file handed to
    // the project service is a parse error, not a lint result.
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },
  {
    // Rules about how a *Playwright test* is written, which the TypeScript rules cannot express.
    // The two worth naming: `expect-expect` fails a test that asserts nothing, and
    // `no-conditional-in-test` fails a test that branches — one that asserts different things
    // depending on the data it happens to meet. Both are the same defect as D-12 seen from a
    // different side: a check that is not looking. `no-focused-test` is the third, and it is the
    // cheap one — `.only` caught before a push rather than by `forbidOnly` on CI.
    //
    // Scoped to `tests/`: `api/`, `po/` and `deployments/` are not tests, and rules about
    // `test()` bodies have nothing to say about them.
    //
    // 📌 Adopting this cost one fix. Every Playwright-specific anti-pattern it knows about —
    // `waitForTimeout`, `networkidle`, `elementHandle`, `force: true`, assertions that are not
    // web-first — reported nothing, which is worth having stated by a tool rather than claimed
    // in a README. From here it is a ratchet.
    files: ['tests/**/*.ts'],
    ...playwright.configs['flat/recommended'],
  },
  {
    rules: {
      // ⚠️ Order matters here. The Playwright preset above switches `no-empty-pattern` fully
      // *off* inside tests; this block runs after it and turns it back on with the narrower
      // exemption, so `const {} = value` in a test is still an error.
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
    //
    // `disableTypeChecked` switches the type-aware rules back off here. Without it they stay
    // enabled with no program behind them, which is not a weaker check — it is a parse error on
    // every .mjs file in the repository.
    files: ['**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      ...tseslint.configs.disableTypeChecked.languageOptions,
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
      'coverage/',
    ],
  }
);

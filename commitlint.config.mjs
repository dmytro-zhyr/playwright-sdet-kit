/**
 * Conventional Commits 1.0.0, as the specification defines it — not as a gist summarises it.
 *
 * 🔑 The rules live here rather than in a document because a convention nobody checks is a
 * convention nobody keeps. `tests/contract/articles.spec.ts` carried a differently wrapped
 * `expect` from August until a formatting gate was added in September, and every commit in
 * between was reviewed by somebody. This is the same argument applied to the log.
 *
 * ⚠️ The qoomon gist this was adopted from proposes a tenth type, `ops`. The specification does
 * not define any type beyond `feat` and `fix`, and `config-conventional` implements the Angular
 * set, which has no `ops`. `ci` covers what `ops` was for here. Where the gist and the runnable
 * config disagree, the config wins, because it is the one that says no.
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    /**
     * ⛔ Not the default 100. Subjects here are read in `git log --oneline` and in the GitHub
     * commit list, and both truncate around 72. A rule set at the width of the tool that displays
     * it is the rule that keeps the log readable.
     *
     * 📌 This is the one place the convention costs something real. This repository's subjects are
     * findings in prose — "the lockfile froze undici, and upgrading jsforce could not thaw it" —
     * and a type prefix eats 12 characters of that. The resolution is in CLAUDE.md: the subject
     * names the change, the body keeps the finding.
     */
    'header-max-length': [2, 'always', 72],

    /**
     * The scope vocabulary is written down in CLAUDE.md and deliberately **not** enforced as a
     * `scope-enum` here. An enum rejects a scope that is legitimate and merely new, and the list
     * has existed for one day. Same reasoning as the absent `.snyk` policy file: policy written
     * before there is a problem is policy for a problem that does not exist.
     */
  },
};

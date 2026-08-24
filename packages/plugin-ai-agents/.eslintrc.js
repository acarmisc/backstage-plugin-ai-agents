module.exports = require('@backstage/cli/config/eslint-factory').createPackageConfig(
  __dirname,
  {
    // Packages use node:test, not Jest, so there is no jest package to
    // auto-detect a version from for eslint-plugin-jest's rules.
    settings: { jest: { version: 29 } },
    // Compiled test output (tsc -p tsconfig.test.json), not source; build.js
    // is an esbuild driver script, not published/bundled app code.
    ignorePatterns: ['**/dist-test/**', 'build.js'],
    rules: {
      // This package's tsconfig still targets the classic JSX runtime
      // (`jsx: "react"`), which requires `React` in scope wherever JSX is
      // used. The new-JSX-transform migration this rule assumes hasn't
      // happened here yet, so it's a false positive until that migration
      // is done as its own change.
      'no-restricted-syntax': 'off',
    },
    overrides: [
      {
        // Tests run under `node --test`, not a bundled browser context, so
        // the frontend role's ban on importing Node builtins doesn't apply.
        files: ['**/*.test.*'],
        rules: {
          'no-restricted-imports': 'off',
        },
      },
    ],
  },
);

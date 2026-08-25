module.exports = require('@backstage/cli/config/eslint-factory').createPackageConfig(
  __dirname,
  {
    // This package uses node:test, not Jest, so there is no jest package to
    // auto-detect a version from for eslint-plugin-jest's rules.
    settings: { jest: { version: 29 } },
    // Compiled test output (tsc -p tsconfig.test.json), not source.
    ignorePatterns: ['**/dist-test/**'],
  },
);

#!/usr/bin/env node
// Verifies what `npm publish` would ship, without publishing: every entry
// point the manifest declares is in the tarball, nothing that must stay
// private (sources, tests, env files, npm credentials) is, and the manifest
// carries the metadata a public package needs.
//
// Usage: node scripts/check-packages.mjs [packages/<dir> ...]
// With no arguments every workspace is checked. Run after `npm run build`.

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join, normalize } from 'node:path';

const MAX_UNPACKED_BYTES = 5 * 1024 * 1024;
const FORBIDDEN = [
  [/(^|\/)src\//, 'source files'],
  [/(^|\/)dist-test\//, 'compiled tests'],
  [/\.test\.(d\.)?[cm]?[jt]sx?$/, 'test files'],
  [/(^|\/)(__fixtures__\/|setupTests\.)/, 'test fixtures'],
  [/(^|\/)\.env(\..*)?$/, 'env files'],
  [/(^|\/)\.npmrc$/, 'npm credentials'],
  [/(^|\/)node_modules\//, 'node_modules'],
  [/\.(tgz|log)$/, 'build leftovers'],
];

// Arguments only select among the known workspaces; paths always come from
// this listing, never from the command line.
const workspaces = readdirSync('packages').map(d => join('packages', d));
const requested = process.argv
  .slice(2)
  .map(a => normalize(a).replace(/\/$/, ''));
const unknown = requested.filter(a => !workspaces.includes(a));
if (unknown.length) {
  console.error(`::error::Not a workspace: ${unknown.join(', ')}`);
  process.exit(1);
}
const dirs = requested.length
  ? workspaces.filter(w => requested.includes(w))
  : workspaces;

let failed = false;
const fail = (pkg, msg) => {
  failed = true;
  console.error(`::error::${pkg}: ${msg}`);
};

for (const dir of dirs) {
  const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  const name = manifest.name;

  for (const field of ['name', 'version', 'license', 'repository']) {
    if (!manifest[field]) fail(name, `package.json has no "${field}"`);
  }
  if (manifest.private) fail(name, 'package.json is marked private');
  if (manifest.publishConfig?.access !== 'public') {
    fail(name, 'publishConfig.access must be "public"');
  }

  // --ignore-scripts: prepack would rebuild and print to stdout, breaking
  // the JSON; the caller has already built.
  const [pack] = JSON.parse(
    execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    }),
  );
  const files = new Set(pack.files.map(f => f.path));

  const entries = [manifest.main, manifest.module, manifest.types].filter(
    Boolean,
  );
  for (const entry of entries) {
    if (!files.has(entry.replace(/^\.\//, ''))) {
      fail(name, `entry point ${entry} is missing from the tarball (built?)`);
    }
  }
  for (const file of files) {
    for (const [re, what] of FORBIDDEN) {
      if (re.test(file)) fail(name, `tarball contains ${what}: ${file}`);
    }
  }
  if (pack.unpackedSize > MAX_UNPACKED_BYTES) {
    fail(
      name,
      `unpacked size ${pack.unpackedSize} exceeds ${MAX_UNPACKED_BYTES} bytes`,
    );
  }

  console.log(
    `${name}@${manifest.version}: ${files.size} files, ${pack.unpackedSize} bytes unpacked`,
  );
}

process.exit(failed ? 1 : 0);

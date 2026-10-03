const esbuild = require('esbuild');

async function build() {
  await esbuild.build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node18',
    outfile: 'dist/index.cjs.js',
    sourcemap: true,
    packages: 'external',
    loader: { '.ts': 'tsx' },
  });
  console.log('Build complete');
}

build().catch(() => process.exit(1));

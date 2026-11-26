// Empacota o servidor em um único arquivo ESM (dist/server/main.js).
import { build } from 'esbuild';
await build({
  entryPoints: ['server/src/main.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outfile: 'dist/server/main.js',
  packages: 'external',
  sourcemap: true,
  banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
});
console.log('servidor empacotado em dist/server/main.js');

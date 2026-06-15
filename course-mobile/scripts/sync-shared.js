// Copies the shared protocol contracts into the mobile project tree so Metro
// (which only reliably maps files under the project root) can bundle them.
// packages/shared remains the SINGLE SOURCE OF TRUTH — this file is generated.
// Runs automatically via the "prestart" npm hook; also run manually any time
// packages/shared changes: `node scripts/sync-shared.js`.
const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname, '..', '..', 'packages', 'shared', 'src', 'index.ts');
const destDir = path.resolve(__dirname, '..', 'src', '_shared');
const dest = path.join(destDir, 'index.ts');

const header =
  '// AUTO-GENERATED from packages/shared/src/index.ts — DO NOT EDIT.\n' +
  '// Source of truth: packages/shared. Regenerate: node scripts/sync-shared.js\n\n';

fs.mkdirSync(destDir, { recursive: true });
fs.writeFileSync(dest, header + fs.readFileSync(src, 'utf8'));
console.log('[sync-shared] wrote', path.relative(path.resolve(__dirname, '..'), dest));

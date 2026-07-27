// npm `prepare` hook.
//
// npm runs `prepare` on a plain `npm install` in this package - which includes
// a consumer install. The plugin launcher (hooks/scripts/launch-mcp.sh) does
// exactly that on first run:
//
//     npm install --omit=dev --no-audit --no-fund --silent
//
// With dev dependencies omitted there is no `typescript` and no `@types/node`,
// so building here fails with `TS2688: Cannot find type definition file for
// 'node'`. npm then exits non-zero, the launcher treats that as a failed
// install, and the MCP server never starts - even though `dist/` ships in the
// package and was ready to run.
//
// So: build only when a local toolchain is actually present. Developers who ran
// a full `npm install` get the automatic build they expect; consumers installing
// production deps skip it and use the committed `dist/`.
//
// The check is deliberately a local filesystem test rather than resolving
// `typescript` as a module, because module resolution walks up parent
// directories and could find an unrelated typescript above the install path.

import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const hasToolchain =
  existsSync(join(root, 'node_modules', 'typescript')) &&
  existsSync(join(root, 'node_modules', '@types', 'node'));

if (!hasToolchain) {
  // Not an error: a production install has nothing to build with, and dist/ is
  // already present. Exit 0 so the install succeeds.
  console.error('[prepare] dev toolchain absent, skipping build (using committed dist/)');
  process.exit(0);
}

const res = spawnSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit', shell: false });

// Propagate a real build failure - a developer needs to see it.
process.exit(res.status === null ? 1 : res.status);

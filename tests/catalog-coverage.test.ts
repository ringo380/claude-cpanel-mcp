import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODULE_MAP } from '../src/modules-catalog.js';

/**
 * Cross-checks every UAPI endpoint the tools actually call against the function
 * catalog in src/modules-catalog.ts.
 *
 * This guards a failure mode that unit tests structurally cannot see: a tool can
 * carry a valid schema, register cleanly, appear in tools/list, and pass every
 * existing test while calling a UAPI function that does not exist. It only fails
 * against a live cPanel.
 *
 * That is not hypothetical - six file-mutation tools shipped for several releases
 * calling Fileman::delete_files / move_files / copy_files / chmod / compress_files
 * / extract, none of which exist in UAPI. Fixed in 0.4.0 by re-pointing them at
 * API 2 Fileman::fileop. Run against v0.3.1, this test flags exactly those.
 *
 * Entirely static: no network, no credentials, no cPHulk exposure.
 */

const toolsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'tools');

/**
 * API 2 endpoints the tools are allowed to call. API 2 is a separate interface
 * from UAPI, so these deliberately do NOT belong in the UAPI catalog - listing
 * them there would tell users they can reach them via uapi_call, which they
 * cannot. Keeping the allowlist tiny and explicit also pins the invariant that
 * file mutations go through fileop and nothing else quietly joins them.
 */
const ALLOWED_API2 = new Set(['Fileman::fileop']);

/**
 * Sanity floor for the number of distinct endpoints found. A regex that silently
 * matched nothing would make every assertion below vacuously pass - the exact
 * false-green this test exists to prevent. Set below the current count so
 * ordinary additions do not trip it, high enough that a broken parser does.
 */
const MIN_EXPECTED_PAIRS = 45;

interface CallSite {
  module: string;
  fn: string;
  kind: 'call' | 'callApi2';
  where: string;
}

function collectCallSites(): CallSite[] {
  const sites: CallSite[] = [];
  const files = readdirSync(toolsDir).filter((n) => n.endsWith('.ts'));

  for (const file of files) {
    const lines = readFileSync(join(toolsDir, file), 'utf8').split('\n');
    lines.forEach((line, i) => {
      // Matches both client.call('Mod', 'fn') and client.callApi2('Mod', 'fn').
      // The API 2 form matters most: that is where the historical bug lived, so
      // a parser blind to it would miss the next one.
      const re = /client\.(call|callApi2)\(\s*'([A-Za-z0-9_]+)'\s*,\s*'([A-Za-z0-9_]+)'/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(line)) !== null) {
        sites.push({
          kind: m[1] as 'call' | 'callApi2',
          module: m[2],
          fn: m[3],
          where: `src/tools/${file}:${i + 1}`,
        });
      }
    });
  }
  return sites;
}

describe('UAPI catalog coverage', () => {
  const sites = collectCallSites();

  it('finds a plausible number of call sites', () => {
    // Guards the parser itself. Without this, a regex that matched nothing would
    // make the assertions below pass while checking nothing at all.
    const distinct = new Set(sites.map((s) => `${s.module}::${s.fn}`));
    expect(distinct.size).toBeGreaterThanOrEqual(MIN_EXPECTED_PAIRS);
  });

  it('sees both the UAPI and the API 2 call forms', () => {
    expect(sites.some((s) => s.kind === 'call')).toBe(true);
    expect(sites.some((s) => s.kind === 'callApi2')).toBe(true);
  });

  it('every called UAPI function exists in the module catalog', () => {
    const missing = sites
      .filter((s) => s.kind === 'call')
      .filter((s) => {
        const mod = MODULE_MAP.get(s.module.toLowerCase());
        return !mod || !mod.functions.some((f) => f.name === s.fn);
      })
      .map((s) => `${s.module}::${s.fn} (${s.where})`);

    expect(missing).toEqual([]);
  });

  it('every API 2 call is on the allowlist', () => {
    const unexpected = sites
      .filter((s) => s.kind === 'callApi2')
      .filter((s) => !ALLOWED_API2.has(`${s.module}::${s.fn}`))
      .map((s) => `${s.module}::${s.fn} (${s.where})`);

    expect(unexpected).toEqual([]);
  });
});

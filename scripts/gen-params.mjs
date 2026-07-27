// Generates docs/parameters.md from the server's live tools/list output.
//
// Single source of truth: the Zod schemas in src/tools/*.ts, read back as JSON
// Schema by actually launching the built server and asking it. That means the
// page cannot drift from the code the way a hand-maintained table would.
//
//   npm run build && npm run docs:params
//
// Run it after changing any tool's inputSchema. The build must be current -
// this reads dist/, not src/.

import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const ENTRY = process.argv[2] || 'dist/index.js';
const OUT = process.argv[3] || 'docs/parameters.md';

/** Launch the built server over stdio and return its tools/list payload. */
function fetchTools() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [ENTRY], {
      stdio: ['pipe', 'pipe', 'ignore'],
      // Deliberately unconfigured: no CPANEL_* vars, so this makes no network
      // call to cPanel and cannot trip cPHulk. The tool list is static, so an
      // unconfigured server still advertises every tool.
      env: { PATH: process.env.PATH, HOME: '/nonexistent', CPANEL_HOST: '', CPANEL_USER: '', CPANEL_API_KEY: '' },
    });

    let out = '';
    child.stdout.on('data', (c) => (out += c));
    child.on('error', reject);

    const send = (o) => child.stdin.write(JSON.stringify(o) + '\n');
    send({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'gen-params', version: '0' } },
    });
    send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });

    setTimeout(() => {
      child.kill('SIGKILL');
      const msgs = out
        .split('\n')
        .filter(Boolean)
        .map((l) => {
          try {
            return JSON.parse(l);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
      const tools = msgs.find((m) => m.id === 2)?.result?.tools;
      if (!Array.isArray(tools) || !tools.length) {
        return reject(new Error(`no tools/list response from ${ENTRY} - is the build current?`));
      }
      resolve(tools);
    }, 4000);
  });
}

const tools = await fetchTools();

// Family grouping mirrors docs/tools.md so the two pages read the same way.
const FAMILIES = [
  ['Auth and setup', (n) => n === 'setup' || n.startsWith('auth_') || n === 'whoami'],
  ['Discovery and escape hatch', (n) => ['list_modules', 'list_functions', 'uapi_call'].includes(n)],
  ['Email', (n) => n.startsWith('email_')],
  ['DNS', (n) => n.startsWith('dns_')],
  ['Files', (n) => n.startsWith('files_')],
  ['MySQL', (n) => n.startsWith('mysql_')],
  ['FTP', (n) => n.startsWith('ftp_')],
  [
    'Domains',
    (n) => n.startsWith('domains_') || n.startsWith('subdomain_') || n.startsWith('addon_domain_'),
  ],
  ['SSL', (n) => n.startsWith('ssl_')],
  ['Cron', (n) => n.startsWith('cron_')],
  ['Backups and account', (n) => n.startsWith('backup_') || n === 'account_info'],
];

// Escape table cells, and normalise any em/en dash a description might carry
// so the published page matches the hand-written docs. The source tree itself
// is plain-hyphen only, so this is a backstop against regressions rather than a
// fixup for known content. Presentation only - the schemas stay the source of
// truth. The class is written with escapes to keep this file pure ASCII:
// U+2010-U+2015 are the dash punctuation block, U+2212 is the minus sign.
const esc = (s) =>
  String(s)
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/\|/g, '\\|')
    .replace(/\n+/g, ' ')
    .trim();

// Render a JSON Schema node as a short human type.
function typeOf(s) {
  if (!s) return 'any';
  if (s.enum) return s.enum.map((v) => `\`${v}\``).join(' \\| ');
  if (s.anyOf || s.oneOf) {
    const parts = (s.anyOf || s.oneOf).map(typeOf);
    return [...new Set(parts)].join(' or ');
  }
  if (s.type === 'array') return `array of ${typeOf(s.items)}`;
  return s.type || 'any';
}

const byName = new Map(tools.map((t) => [t.name, t]));
const claimed = new Set();
const sections = [];

for (const [title, match] of FAMILIES) {
  const names = tools
    .map((t) => t.name)
    .filter((n) => match(n))
    .sort();
  names.forEach((n) => claimed.add(n));
  if (names.length) sections.push([title, names]);
}

// Anything a family predicate missed must still be documented - never drop
// a tool silently just because the grouping did not anticipate it.
const orphans = tools.map((t) => t.name).filter((n) => !claimed.has(n)).sort();
if (orphans.length) sections.push(['Other', orphans]);

let md = `---
permalink: /parameters/
title: Parameter reference
description: Input parameters for every cpanel-mcp tool, generated from the live tool schemas.
---

# Parameter reference

[Back to index]({{ site.baseurl }}/) &middot; [Tool reference]({{ site.baseurl }}/tools/)

Input parameters for all ${tools.length} tools. Generated from the server's own \`tools/list\` output, so it reflects the actual Zod schemas rather than a hand-maintained copy.

**Required** parameters are marked \`yes\`. Anything else is optional; where a default exists it is stated in the description.

Every tool also shares one behaviour not repeated below: if no credentials are loaded, the call returns a structured "unconfigured" error instead of contacting cPanel.

`;

const toc = sections.map(([t]) => `[${t}](#${t.toLowerCase().replace(/[^a-z0-9]+/g, '-')})`);
md += `Jump to: ${toc.join(' &middot; ')}\n`;

for (const [title, names] of sections) {
  md += `\n## ${title}\n`;
  for (const name of names) {
    const t = byName.get(name);
    const props = t.inputSchema?.properties || {};
    const required = new Set(t.inputSchema?.required || []);
    const keys = Object.keys(props);

    md += `\n### \`${name}\`\n\n`;
    if (t.description) md += `${esc(t.description)}\n\n`;

    if (!keys.length) {
      md += `Takes no parameters.\n`;
      continue;
    }

    md += `| Parameter | Type | Required | Description |\n| --- | --- | --- | --- |\n`;
    for (const k of keys) {
      const p = props[k];
      md += `| \`${k}\` | ${typeOf(p)} | ${required.has(k) ? 'yes' : 'no'} | ${
        esc(p.description || '')
      } |\n`;
    }
  }
}

md += `\n---\n\nGenerated from \`tools/list\`. To regenerate after a schema change, see [Development]({{ site.baseurl }}/development/).\n`;

writeFileSync(OUT, md);

const totalParams = tools.reduce(
  (n, t) => n + Object.keys(t.inputSchema?.properties || {}).length,
  0,
);
console.log(
  `wrote ${OUT}: ${tools.length} tools, ${totalParams} params, ${sections.length} sections`,
);

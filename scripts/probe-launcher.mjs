// Drives the plugin LAUNCHER (not dist/index.js directly) over stdio and prints
// the number of tools it advertises.
//
//   node scripts/probe-launcher.mjs <plugin-root>
//
// Going through hooks/scripts/launch-mcp.sh is the whole point: that script is
// what performs the first-run `npm install --omit=dev`, and that install is the
// step that has broken before. Probing dist/index.js directly would skip it.
//
// Exit codes are distinct so the caller can say which thing broke:
//   0  ok, tool count printed to stdout
//   3  launcher exited non-zero (install or startup failure)
//   4  launcher ran but never answered tools/list (timeout / protocol failure)

import { spawn } from 'node:child_process';
import { join } from 'node:path';

const root = process.argv[2];
if (!root) {
  console.error('usage: node scripts/probe-launcher.mjs <plugin-root>');
  process.exit(2);
}

const launcher = join(root, 'hooks', 'scripts', 'launch-mcp.sh');

// The first-run npm install dominates; allow generously for it.
const TIMEOUT_MS = Number(process.env.VERIFY_INSTALL_TIMEOUT_MS || 180000);

const child = spawn('sh', [launcher], {
  stdio: ['pipe', 'pipe', 'inherit'],
  env: {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    CLAUDE_PLUGIN_ROOT: root,
    // Deliberately unconfigured: no CPANEL_* values, so the server makes no
    // call to cPanel and cannot trip cPHulk. The tool list is static, so an
    // unconfigured server still advertises every tool.
    CPANEL_HOST: '',
    CPANEL_USER: '',
    CPANEL_API_KEY: '',
  },
});

let out = '';
let exited = null;
child.stdout.on('data', (c) => (out += c));
child.on('exit', (code) => (exited = code));
child.on('error', (err) => {
  console.error(`[probe] could not start launcher: ${err.message}`);
  process.exit(3);
});

const send = (o) => {
  if (!child.stdin.destroyed) child.stdin.write(JSON.stringify(o) + '\n');
};

// The launcher may spend a long time on `npm install` before exec'ing node, but
// writes to its stdin are buffered by the pipe, so sending immediately is safe.
send({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'verify-install', version: '0' },
  },
});
send({ jsonrpc: '2.0', method: 'notifications/initialized' });
send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });

function parseToolCount() {
  for (const line of out.split('\n')) {
    if (!line.trim()) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    if (msg.id === 2 && Array.isArray(msg.result?.tools)) return msg.result.tools.length;
  }
  return null;
}

const started = Date.now();
const poll = setInterval(() => {
  const count = parseToolCount();

  if (count !== null) {
    clearInterval(poll);
    child.kill('SIGKILL');
    console.log(String(count));
    process.exit(0);
  }

  // Launcher died before answering - an install or startup failure.
  if (exited !== null) {
    clearInterval(poll);
    console.error(`[probe] launcher exited with code ${exited} before answering tools/list`);
    process.exit(3);
  }

  if (Date.now() - started > TIMEOUT_MS) {
    clearInterval(poll);
    child.kill('SIGKILL');
    console.error(`[probe] no tools/list response within ${TIMEOUT_MS}ms`);
    process.exit(4);
  }
}, 250);

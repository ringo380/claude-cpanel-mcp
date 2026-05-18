#!/usr/bin/env node

// Silence stdout before any imports — MCP uses stdout exclusively for JSON-RPC.
/* eslint-disable no-console */
console.log = () => {};
console.warn = () => {};
console.info = () => {};
console.debug = () => {};
console.trace = () => {};
/* eslint-enable no-console */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CpanelClient } from './cpanel-client.js';
import { readConfig } from './config.js';
import { registerSetupTools } from './tools/setup.js';
import { registerGenericTools } from './tools/generic.js';
import { registerEmailTools } from './tools/email.js';
import { registerDnsTools } from './tools/dns.js';
import { registerFileTools } from './tools/files.js';
import { registerMysqlTools } from './tools/mysql.js';
import { registerDomainTools } from './tools/domains.js';
import { registerSslTools } from './tools/ssl.js';
import { registerCronTools } from './tools/cron.js';
import { registerBackupTools } from './tools/backups.js';

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PKG_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
const VERSION: string = (() => {
  try {
    return JSON.parse(readFileSync(PKG_PATH, 'utf8')).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
})();

const initialConfig = readConfig();
let clientRef: CpanelClient | null = initialConfig.ok
  ? new CpanelClient(initialConfig.config!)
  : null;

const getClient = (): CpanelClient | null => clientRef;
const setClient = (c: CpanelClient | null): void => {
  clientRef = c;
};

// Neutral instructions valid in both unconfigured and configured states.
// Auth state can change mid-session via the `setup` tool, but the server's
// instructions string is captured at startup and not refreshed by the SDK,
// so neither a hard "ready" nor "unconfigured" claim stays accurate.
const INSTRUCTIONS =
  'cpanel-mcp wraps the cPanel UAPI. Run `auth_status` to check whether credentials ' +
  'are loaded; if not, run `setup` with host/user/api_key (generate the token in ' +
  'cPanel → Security → Manage API Tokens). Once authenticated, use the curated tools ' +
  '(email_*, dns_*, files_*, mysql_*, ssl_*, cron_*, backup_*, domains_*, subdomain_*) ' +
  'or `uapi_call` for any UAPI module/function not wrapped. The HTTP layer is ' +
  'cPHulk-safe: a single attempt per call, with `CPHULK_LOCKOUT` errors surfaced ' +
  'distinctly from auth failures.';

const server = new McpServer(
  { name: 'cpanel-mcp', version: VERSION },
  { instructions: INSTRUCTIONS },
);

// Setup tools are always available, regardless of state.
registerSetupTools(server, setClient, () => {
  /* tools are already registered up-front; nothing to do post-config */
});

// Register all tools up-front. Each handler checks getClient() and returns
// a structured "unconfigured" error if credentials are missing. This keeps
// the tool list stable across (re)configuration without needing dynamic
// registration / list_changed notifications.
registerGenericTools(server, getClient);
registerEmailTools(server, getClient);
registerDnsTools(server, getClient);
registerFileTools(server, getClient);
registerMysqlTools(server, getClient);
registerDomainTools(server, getClient);
registerSslTools(server, getClient);
registerCronTools(server, getClient);
registerBackupTools(server, getClient);

// Insurance against orphan stdio processes.
process.stdin.on('end', () => process.exit(0));
process.stdin.on('close', () => process.exit(0));
for (const sig of ['SIGTERM', 'SIGINT', 'SIGHUP'] as const) {
  process.on(sig, () => process.exit(0));
}

const transport = new StdioServerTransport();
await server.connect(transport);

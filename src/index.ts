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
import { registerAuthHelperTools } from './tools/auth-helpers.js';
import { registerGenericTools } from './tools/generic.js';
import { registerEmailTools } from './tools/email.js';
import { registerDnsTools } from './tools/dns.js';
import { registerFileTools } from './tools/files.js';
import { registerFileWriteTools } from './tools/files-write.js';
import { registerMysqlTools } from './tools/mysql.js';
import { registerDomainTools } from './tools/domains.js';
import { registerSslTools } from './tools/ssl.js';
import { registerCronTools } from './tools/cron.js';
import { registerBackupTools } from './tools/backups.js';
import { registerFtpTools } from './tools/ftp.js';

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

// Build instructions reflecting startup-time state. The SDK doesn't refresh
// `instructions` mid-session, so this is a best-effort hint baked in at
// connect time; runtime state can drift if profiles/setup tools are used.
function buildInstructions(): string {
  const base =
    'cpanel-mcp wraps the cPanel UAPI with curated tools plus a generic `uapi_call` escape hatch. ' +
    'Authenticates via cPanel API tokens; supports multiple named profiles ' +
    '(see auth_list_profiles / auth_switch_profile / /cpanel-mcp:account-switch). ' +
    'The HTTP layer is cPHulk-safe: a single attempt per call, CPHULK_LOCKOUT errors ' +
    'surfaced distinctly from AUTH_FAILED. Sensitive params (password|key|cert|...) ' +
    'auto-route via POST so they never appear in cPanel access logs.';
  if (initialConfig.ok) {
    return (
      base +
      ` Configured at startup: profile="${initialConfig.profile}", ` +
      `user="${initialConfig.config!.user}", host="${initialConfig.config!.host}:${initialConfig.config!.port}". ` +
      'Tool families available: email_*, dns_*, files_*, mysql_*, ssl_*, cron_*, ' +
      'backup_*, domains_*, subdomain_*, ftp_*, plus uapi_call.'
    );
  }
  return (
    base +
    ` ⚠ NO CREDENTIALS LOADED at startup (active profile "${initialConfig.profile}" missing: ` +
    `${initialConfig.missing.join(', ')}). Start by calling \`auth_status\` for diagnostics, ` +
    'then either invoke /cpanel-mcp:setup for a guided flow, or call `auth_test` to dry-run ' +
    'a host/user/token combination before committing it with `setup`.'
  );
}

const server = new McpServer(
  { name: 'cpanel-mcp', version: VERSION },
  { instructions: buildInstructions() },
);

// Setup + auth-helper tools are always available, regardless of state.
registerSetupTools(server, setClient, () => {
  /* tools are already registered up-front; nothing to do post-config */
});
registerAuthHelperTools(server);

// Register all tools up-front. Each handler checks getClient() and returns
// a structured "unconfigured" error if credentials are missing. This keeps
// the tool list stable across (re)configuration without needing dynamic
// registration / list_changed notifications.
registerGenericTools(server, getClient);
registerEmailTools(server, getClient);
registerDnsTools(server, getClient);
registerFileTools(server, getClient);
registerFileWriteTools(server, getClient);
registerMysqlTools(server, getClient);
registerDomainTools(server, getClient);
registerSslTools(server, getClient);
registerCronTools(server, getClient);
registerBackupTools(server, getClient);
registerFtpTools(server, getClient);

// Insurance against orphan stdio processes.
process.stdin.on('end', () => process.exit(0));
process.stdin.on('close', () => process.exit(0));
for (const sig of ['SIGTERM', 'SIGINT', 'SIGHUP'] as const) {
  process.on(sig, () => process.exit(0));
}

const transport = new StdioServerTransport();
await server.connect(transport);

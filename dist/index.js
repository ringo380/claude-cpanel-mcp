#!/usr/bin/env node
// Silence stdout before any imports — MCP uses stdout exclusively for JSON-RPC.
/* eslint-disable no-console */
console.log = () => { };
console.warn = () => { };
console.info = () => { };
console.debug = () => { };
console.trace = () => { };
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
const VERSION = '0.1.0';
const initialConfig = readConfig();
let clientRef = initialConfig.ok
    ? new CpanelClient(initialConfig.config)
    : null;
const getClient = () => clientRef;
const setClient = (c) => {
    clientRef = c;
};
const UNCONFIGURED_INSTRUCTIONS = 'cpanel-mcp is not yet authenticated. Call the `setup` tool with your cPanel host, ' +
    'user, and API token to validate and save credentials, or `auth_status` to diagnose. ' +
    'You can generate an API token in cPanel → Security → Manage API Tokens. The full ' +
    'tool suite (email, DNS, files, MySQL, SSL, cron, backups) is registered up-front but ' +
    'all calls return an unconfigured error until setup succeeds.';
const READY_INSTRUCTIONS = 'cpanel-mcp is authenticated. Manage email accounts, DNS records, files, MySQL, ' +
    'SSL, cron, subdomains, and backups via the exposed tools. The `uapi_call` tool is ' +
    'a universal escape hatch for any UAPI endpoint not covered by a curated tool. ' +
    'Call `auth_status` to verify credentials, or `setup` to reconfigure.';
const server = new McpServer({ name: 'cpanel-mcp', version: VERSION }, { instructions: clientRef ? READY_INSTRUCTIONS : UNCONFIGURED_INSTRUCTIONS });
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
for (const sig of ['SIGTERM', 'SIGINT', 'SIGHUP']) {
    process.on(sig, () => process.exit(0));
}
const transport = new StdioServerTransport();
await server.connect(transport);
//# sourceMappingURL=index.js.map
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CpanelClient } from '../cpanel-client.js';
type GetClient = () => CpanelClient | null;
export declare function registerDnsTools(server: McpServer, getClient: GetClient): void;
export {};

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CpanelClient } from '../cpanel-client.js';
type GetClient = () => CpanelClient | null;
export declare function pathLooksDangerous(dir: string): boolean;
export declare function validateFilename(file: string): string | null;
export declare function registerFileWriteTools(server: McpServer, getClient: GetClient): void;
export {};

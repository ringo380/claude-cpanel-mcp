import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CpanelClient } from '../cpanel-client.js';
type SetClient = (c: CpanelClient | null) => void;
type Notify = () => void;
export declare function registerSetupTools(server: McpServer, setClient: SetClient, onConfigured: Notify): void;
export {};

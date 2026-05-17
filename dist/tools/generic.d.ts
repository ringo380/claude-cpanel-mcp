import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CpanelClient } from '../cpanel-client.js';
type GetClient = () => CpanelClient | null;
declare function unconfiguredResult(): {
    isError: boolean;
    content: {
        type: "text";
        text: string;
    }[];
};
declare function asJsonContent(data: unknown): {
    content: {
        type: "text";
        text: string;
    }[];
};
declare function asErrorContent(err: unknown): {
    isError: boolean;
    content: {
        type: "text";
        text: string;
    }[];
};
export { unconfiguredResult, asJsonContent, asErrorContent };
export declare function registerGenericTools(server: McpServer, getClient: GetClient): void;

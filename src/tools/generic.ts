import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { CpanelClient } from '../cpanel-client.js';
import { MODULES, MODULE_MAP } from '../modules-catalog.js';

type GetClient = () => CpanelClient | null;

function unconfiguredResult() {
  return {
    isError: true,
    content: [
      {
        type: 'text' as const,
        text:
          'cpanel-mcp is not configured. Set CPANEL_HOST, CPANEL_USER, and CPANEL_API_KEY ' +
          'in your environment (or run /cpanel-mcp:setup), then reconnect the MCP server.',
      },
    ],
  };
}

function asJsonContent(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

function asErrorContent(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : 'Error';
  const code = (err as { code?: string })?.code;
  return {
    isError: true,
    content: [
      {
        type: 'text' as const,
        text: code ? `[${name}:${code}] ${message}` : `[${name}] ${message}`,
      },
    ],
  };
}

export { unconfiguredResult, asJsonContent, asErrorContent };

export function registerGenericTools(server: McpServer, getClient: GetClient): void {
  server.registerTool(
    'whoami',
    {
      description:
        'Return the configured cPanel host, port, user, and last-4 of the API token. No network call. Use to verify credentials are present before issuing calls.',
      inputSchema: {},
    },
    async () => {
      const client = getClient();
      if (!client) return unconfiguredResult();
      return asJsonContent({
        host: client.host,
        port: client.port,
        user: client.user,
        tokenSuffix: client.tokenSuffix(),
      });
    },
  );

  server.registerTool(
    'list_modules',
    {
      description:
        'List known cPanel UAPI modules with one-line descriptions. Static catalog — no network call. Use as a navigation aid before calling list_functions or uapi_call.',
      inputSchema: {},
    },
    async () =>
      asJsonContent(MODULES.map((m) => ({ name: m.name, description: m.description }))),
  );

  server.registerTool(
    'list_functions',
    {
      description:
        'List known functions for a UAPI module. Static catalog — not exhaustive. For any module/function not listed, use uapi_call directly.',
      inputSchema: {
        module: z.string().describe('UAPI module name, e.g. "Email", "DNS", "Mysql"'),
      },
    },
    async ({ module }) => {
      const info = MODULE_MAP.get(module.toLowerCase());
      if (!info) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: `Unknown module "${module}". Call list_modules to see the catalog. (You can still call uapi_call with any module name.)`,
            },
          ],
        };
      }
      return asJsonContent({
        name: info.name,
        description: info.description,
        functions: info.functions,
      });
    },
  );

  server.registerTool(
    'uapi_call',
    {
      description:
        'Universal cPanel UAPI escape hatch. Calls https://<host>:2083/execute/<module>/<function> with the given params and returns parsed JSON. Use this when no curated tool covers your need. Will throw on cPHulk lockout (CPHULK_LOCKOUT) or auth failure (AUTH_FAILED).',
      inputSchema: {
        module: z.string().describe('UAPI module, e.g. "Email"'),
        function: z.string().describe('Function name on that module, e.g. "list_pops"'),
        params: z
          .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
          .optional()
          .describe('Query-string parameters'),
      },
    },
    async ({ module, function: func, params }) => {
      const client = getClient();
      if (!client) return unconfiguredResult();
      try {
        const result = await client.call(module, func, params ?? {});
        return asJsonContent(result);
      } catch (err) {
        return asErrorContent(err);
      }
    },
  );
}

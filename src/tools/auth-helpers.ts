import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { tokenManagementUrl } from '../config.js';
import { readProfile, getActiveProfileName, profileExists } from '../profiles.js';

export function registerAuthHelperTools(server: McpServer): void {
  server.registerTool(
    'auth_open_token_page',
    {
      description:
        'Return the URL of the cPanel API token management page for a given host (or the ' +
        'active profile\'s host), plus step-by-step instructions for generating a token. ' +
        'Does NOT open the browser automatically — that would be unreliable in headless / ' +
        'SSH sessions. Surface the URL to the user so they (or Claude) can open it.',
      inputSchema: {
        host: z
          .string()
          .optional()
          .describe('cPanel host. If omitted, uses the host from the active profile.'),
        port: z.number().optional().describe('cPanel HTTPS port (defaults to 2083 or the active profile\'s port).'),
      },
    },
    async ({ host, port }) => {
      let resolvedHost = host;
      let resolvedPort = port;
      let profileNote = '';
      if (!resolvedHost) {
        const active = getActiveProfileName();
        if (profileExists(active)) {
          const v = readProfile(active);
          resolvedHost = v.CPANEL_HOST;
          if (!resolvedPort && v.CPANEL_PORT) resolvedPort = parseInt(v.CPANEL_PORT, 10);
          profileNote = ` (from active profile "${active}")`;
        }
      }
      if (!resolvedHost) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text:
                'No host provided and no active profile to fall back to. Pass `host` ' +
                'explicitly, e.g. auth_open_token_page(host="web2.example.com").',
            },
          ],
        };
      }
      const finalPort = resolvedPort ?? 2083;
      const url = tokenManagementUrl(resolvedHost, finalPort);
      const suggestedName = `claude-mcp-${resolvedHost.replace(/[^a-zA-Z0-9.-]/g, '_')}-${new Date()
        .toISOString()
        .slice(0, 10)}`;
      return {
        content: [
          {
            type: 'text' as const,
            text:
              `cPanel API token management URL${profileNote}:\n\n  ${url}\n\n` +
              `Steps to generate a token:\n` +
              `  1. Open the URL above in a browser and log into cPanel.\n` +
              `     (If "Manage API Tokens" 404s, the hosting provider has disabled the\n` +
              `     feature — file a support ticket asking for it to be enabled.)\n` +
              `  2. Click "Create".\n` +
              `  3. Name the token (suggested: "${suggestedName}").\n` +
              `  4. Leave privileges at the default (full access) unless you have a reason to scope.\n` +
              `  5. Click "Create" again, then COPY THE TOKEN — it is shown exactly once.\n` +
              `  6. Paste the token back in chat; we\'ll validate it with \`auth_test\`\n` +
              `     before committing with \`setup\`.\n`,
          },
        ],
      };
    },
  );
}

import { z } from 'zod';
import { CpanelClient } from '../cpanel-client.js';
import { CONFIG_FILE, readConfig, tokenManagementUrl, validateConfig, writeConfigFile, } from '../config.js';
export function registerSetupTools(server, setClient, onConfigured) {
    server.registerTool('setup', {
        description: 'Interactive setup: validate and save cPanel credentials (host, username, API token). Writes ~/.config/cpanel-mcp/.env with mode 0600. To generate an API token, log into cPanel → Security → Manage API Tokens → Create. Pass the values as arguments to this tool. After success, ALL other cPanel tools become available immediately without restart.',
        inputSchema: {
            host: z
                .string()
                .describe('cPanel hostname or IP. Example: "web2.siteocity.com" or "203.0.113.5". Do NOT include https:// or port.'),
            user: z.string().describe('cPanel username.'),
            api_key: z.string().describe('cPanel API token (created in cPanel → Security → Manage API Tokens).'),
            port: z.number().optional().describe('cPanel HTTPS port. Defaults to 2083.'),
            insecure_tls: z
                .boolean()
                .optional()
                .describe('Skip TLS cert verification. Only enable if your cPanel host uses a self-signed cert.'),
        },
    }, async ({ host, user, api_key, port, insecure_tls }) => {
        const cleanHost = host.replace(/^https?:\/\//, '').replace(/[:/].*$/, '');
        const config = {
            host: cleanHost,
            port: port ?? 2083,
            user,
            apiKey: api_key,
            insecureTls: insecure_tls,
        };
        const result = await validateConfig(config);
        if (!result.ok) {
            return {
                isError: true,
                content: [
                    {
                        type: 'text',
                        text: `Validation failed: [${result.code}] ${result.message}\n\n` +
                            `Credentials NOT saved. Check:\n` +
                            `  1. The host is reachable on port ${config.port} (try opening https://${cleanHost}:${config.port}/ in a browser).\n` +
                            `  2. The username matches your cPanel login.\n` +
                            `  3. The API token was created under that exact user.\n` +
                            `  4. If CPHULK_LOCKOUT: your IP is blocked, file a hosting-provider support ticket.\n` +
                            `  5. Manage API tokens at: ${tokenManagementUrl(cleanHost, config.port)}`,
                    },
                ],
            };
        }
        const path = writeConfigFile({
            CPANEL_HOST: cleanHost,
            CPANEL_PORT: String(config.port),
            CPANEL_USER: user,
            CPANEL_API_KEY: api_key,
            CPANEL_INSECURE_TLS: insecure_tls ? '1' : undefined,
        });
        setClient(new CpanelClient(config));
        onConfigured();
        return {
            content: [
                {
                    type: 'text',
                    text: `Success — credentials validated and saved to ${path} (mode 0600).\n\n` +
                        `Authenticated as user "${user}" on ${cleanHost}:${config.port}.\n` +
                        `All cPanel tools (email_*, dns_*, files_*, mysql_*, etc.) are now available.\n\n` +
                        `Account info:\n${JSON.stringify(result.data, null, 2)}`,
                },
            ],
        };
    });
    server.registerTool('auth_status', {
        description: 'Report whether cpanel-mcp is configured and where credentials are loaded from (process env vs ~/.config/cpanel-mcp/.env). No network call. Use to diagnose unconfigured state or to confirm credential source before changing it.',
        inputSchema: {},
    }, async () => {
        const cfg = readConfig();
        if (cfg.ok) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `Configured.\n` +
                            `  host:    ${cfg.config.host}:${cfg.config.port}\n` +
                            `  user:    ${cfg.config.user}\n` +
                            `  token:   ...${cfg.config.apiKey.slice(-4)}\n` +
                            `  sources: ${JSON.stringify(cfg.sources)}\n` +
                            `  file:    ${CONFIG_FILE}`,
                    },
                ],
            };
        }
        return {
            content: [
                {
                    type: 'text',
                    text: `NOT configured.\n` +
                        `  missing: ${cfg.missing.join(', ')}\n` +
                        `  sources: ${JSON.stringify(cfg.sources)}\n` +
                        `  expected file: ${CONFIG_FILE}\n\n` +
                        `Run the \`setup\` tool with host/user/api_key, or invoke /cpanel-mcp:setup for guided setup.`,
                },
            ],
        };
    });
}

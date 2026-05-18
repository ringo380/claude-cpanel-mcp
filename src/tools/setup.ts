import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { CpanelClient, type CpanelConfig } from '../cpanel-client.js';
import {
  CONFIG_FILE,
  readConfig,
  tokenManagementUrl,
  validateConfigEphemeral,
  writeConfigFile,
} from '../config.js';
import {
  assertValidProfileName,
  deleteProfile,
  getActiveProfileName,
  profileExists,
  readProfile,
  setActiveProfile,
  summarizeProfiles,
} from '../profiles.js';

type SetClient = (c: CpanelClient | null) => void;
type Notify = () => void;

function cleanHost(host: string): string {
  return host.replace(/^https?:\/\//, '').replace(/[:/].*$/, '');
}

function makeConfig(opts: {
  host: string;
  user: string;
  api_key: string;
  port?: number;
  insecure_tls?: boolean;
}): CpanelConfig {
  return {
    host: cleanHost(opts.host),
    port: opts.port ?? 2083,
    user: opts.user,
    apiKey: opts.api_key,
    insecureTls: opts.insecure_tls,
  };
}

export function registerSetupTools(
  server: McpServer,
  setClient: SetClient,
  onConfigured: Notify,
): void {
  server.registerTool(
    'setup',
    {
      description:
        'Interactive setup: validate and save cPanel credentials (host, username, API token). ' +
        'Writes ~/.config/cpanel-mcp/profiles/<profile>.env with mode 0600 (atomic temp+rename). ' +
        'To generate an API token, log into cPanel → Security → Manage API Tokens → Create. ' +
        'After success, ALL other cPanel tools become available immediately without restart. ' +
        'For try-before-save, use `auth_test` instead.',
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
        profile: z
          .string()
          .optional()
          .describe('Named profile to write under (default: "default"). Use distinct names for multi-account setups (e.g. "siteocity", "client-acme"). 1-64 chars of [a-zA-Z0-9_.-].'),
        activate: z
          .boolean()
          .optional()
          .describe('Switch the active profile to this one after writing. Defaults to true. Set false to save creds without making them active.'),
      },
    },
    async ({ host, user, api_key, port, insecure_tls, profile, activate }) => {
      const config = makeConfig({ host, user, api_key, port, insecure_tls });
      const profileName = profile ?? 'default';
      try {
        assertValidProfileName(profileName);
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: (err as Error).message }],
        };
      }

      const result = await validateConfigEphemeral(config);
      if (!result.ok) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text:
                `Validation failed: [${result.code}] ${result.message}\n\n` +
                `Credentials NOT saved. Check:\n` +
                `  1. The host is reachable on port ${config.port} (try opening https://${config.host}:${config.port}/ in a browser).\n` +
                `  2. The username matches your cPanel login.\n` +
                `  3. The API token was created under that exact user.\n` +
                `  4. If CPHULK_LOCKOUT: your IP is blocked, file a hosting-provider support ticket.\n` +
                `  5. Manage API tokens at: ${tokenManagementUrl(config.host, config.port)}`,
            },
          ],
        };
      }

      const path = writeConfigFile(
        {
          CPANEL_HOST: config.host,
          CPANEL_PORT: String(config.port),
          CPANEL_USER: user,
          CPANEL_API_KEY: api_key,
          CPANEL_INSECURE_TLS: insecure_tls ? '1' : undefined,
        },
        profileName,
      );

      const shouldActivate = activate !== false;
      if (shouldActivate) {
        setActiveProfile(profileName);
        setClient(new CpanelClient(config));
        onConfigured();
      }

      return {
        content: [
          {
            type: 'text' as const,
            text:
              `Success — credentials validated and saved to ${path} (mode 0600, atomic).\n\n` +
              `Profile: "${profileName}"${shouldActivate ? ' (now active)' : ' (saved but NOT active — call auth_switch_profile to activate)'}.\n` +
              `Authenticated as user "${user}" on ${config.host}:${config.port}.\n` +
              (shouldActivate ? `All cPanel tools (email_*, dns_*, files_*, mysql_*, etc.) are now available.\n\n` : '\n') +
              `Account info:\n${JSON.stringify(result.data, null, 2)}`,
          },
        ],
      };
    },
  );

  server.registerTool(
    'auth_status',
    {
      description:
        'Report whether cpanel-mcp is configured and where credentials are loaded from ' +
        '(process env vs ~/.config/cpanel-mcp/profiles/<active>.env). No network call. ' +
        'Use to diagnose unconfigured state or to confirm credential source before changing it.',
      inputSchema: {},
    },
    async () => {
      const cfg = readConfig();
      const profiles = summarizeProfiles();
      if (cfg.ok) {
        return {
          content: [
            {
              type: 'text' as const,
              text:
                `Configured.\n` +
                `  active profile: ${cfg.profile}\n` +
                `  host:    ${cfg.config!.host}:${cfg.config!.port}\n` +
                `  user:    ${cfg.config!.user}\n` +
                `  token:   ...${cfg.config!.apiKey.slice(-4)}\n` +
                `  sources: ${JSON.stringify(cfg.sources)}\n` +
                `  file:    ${CONFIG_FILE}\n` +
                `  all profiles: ${JSON.stringify(profiles, null, 2)}`,
            },
          ],
        };
      }
      return {
        content: [
          {
            type: 'text' as const,
            text:
              `NOT configured.\n` +
              `  active profile: ${cfg.profile}\n` +
              `  missing: ${cfg.missing.join(', ')}\n` +
              `  sources: ${JSON.stringify(cfg.sources)}\n` +
              `  profiles available: ${profiles.length === 0 ? '(none)' : profiles.map((p) => p.name).join(', ')}\n\n` +
              `Run the \`setup\` tool with host/user/api_key, or invoke /cpanel-mcp:setup for guided setup.`,
          },
        ],
      };
    },
  );

  server.registerTool(
    'auth_test',
    {
      description:
        'Dry-run credential validation against cPanel UAPI without writing anything to disk. ' +
        'Use this to verify a host/user/token combination before committing it with `setup`. ' +
        'Returns the cPanel account info on success, or a structured error code (CPHULK_LOCKOUT, ' +
        'AUTH_FAILED, NETWORK_ERROR, etc.) on failure.',
      inputSchema: {
        host: z.string().describe('cPanel hostname or IP. Do NOT include https:// or port.'),
        user: z.string(),
        api_key: z.string().describe('cPanel API token to test.'),
        port: z.number().optional().describe('Defaults to 2083.'),
        insecure_tls: z.boolean().optional(),
      },
    },
    async ({ host, user, api_key, port, insecure_tls }) => {
      const config = makeConfig({ host, user, api_key, port, insecure_tls });
      const result = await validateConfigEphemeral(config);
      if (!result.ok) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text:
                `auth_test FAILED: [${result.code}] ${result.message}\n\n` +
                `Nothing was written to disk. Common causes:\n` +
                `  • CPHULK_LOCKOUT — your IP is blocked; file a support ticket (retrying extends the lockout).\n` +
                `  • AUTH_FAILED — wrong user/token; check both at ${tokenManagementUrl(config.host, config.port)}\n` +
                `  • NETWORK_ERROR — host unreachable on port ${config.port}.`,
            },
          ],
        };
      }
      return {
        content: [
          {
            type: 'text' as const,
            text:
              `auth_test OK — credentials are valid for ${user}@${config.host}:${config.port}.\n` +
              `Nothing was written to disk. Run \`setup\` with these same values to persist.\n\n` +
              `Account info:\n${JSON.stringify(result.data, null, 2)}`,
          },
        ],
      };
    },
  );

  server.registerTool(
    'auth_rotate_token',
    {
      description:
        'Atomically swap the API token for an existing profile. Re-uses the profile\'s ' +
        'stored host/port/user, validates the new token, and only writes if validation ' +
        'succeeds. Returns last-4 of the old and new tokens for confirmation. ' +
        'If the rotated profile is active, the in-memory client is updated immediately.',
      inputSchema: {
        api_key: z.string().describe('New cPanel API token.'),
        profile: z.string().optional().describe('Profile to rotate. Defaults to the active profile.'),
      },
    },
    async ({ api_key, profile }) => {
      const profileName = profile ?? getActiveProfileName();
      try {
        assertValidProfileName(profileName);
      } catch (err) {
        return { isError: true, content: [{ type: 'text' as const, text: (err as Error).message }] };
      }
      if (!profileExists(profileName)) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: `Profile "${profileName}" does not exist. Create it via the \`setup\` tool first.`,
            },
          ],
        };
      }
      const existing = readProfile(profileName);
      const host = existing.CPANEL_HOST;
      const user = existing.CPANEL_USER;
      const port = existing.CPANEL_PORT ? parseInt(existing.CPANEL_PORT, 10) : 2083;
      const insecureTls = existing.CPANEL_INSECURE_TLS === '1' || existing.CPANEL_INSECURE_TLS === 'true';
      if (!host || !user) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: `Profile "${profileName}" is incomplete (missing host or user). Re-run \`setup\` instead of rotating.`,
            },
          ],
        };
      }

      const oldSuffix = existing.CPANEL_API_KEY?.slice(-4) ?? '????';
      const newSuffix = api_key.slice(-4);

      const config: CpanelConfig = { host, port, user, apiKey: api_key, insecureTls };
      const result = await validateConfigEphemeral(config);
      if (!result.ok) {
        const cphulkWarning =
          result.code === 'CPHULK_LOCKOUT'
            ? `\n\n⚠ This was a CPHULK_LOCKOUT. DO NOT RETRY — repeated attempts extend ` +
              `the lockout window. File a support ticket with the hosting provider to unblock, ` +
              `or try again from a different IP (cPHulk is often hostname/IP-keyed).`
            : '';
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text:
                `Rotation REJECTED: new token failed validation [${result.code}] ${result.message}\n\n` +
                `The existing token (...${oldSuffix}) is unchanged on disk and in memory.` +
                cphulkWarning,
            },
          ],
        };
      }

      writeConfigFile(
        {
          CPANEL_HOST: host,
          CPANEL_PORT: String(port),
          CPANEL_USER: user,
          CPANEL_API_KEY: api_key,
          CPANEL_INSECURE_TLS: insecureTls ? '1' : undefined,
        },
        profileName,
      );

      const isActive = profileName === getActiveProfileName();
      if (isActive) {
        setClient(new CpanelClient(config));
        onConfigured();
      }

      return {
        content: [
          {
            type: 'text' as const,
            text:
              `Token rotated for profile "${profileName}": ...${oldSuffix} → ...${newSuffix}.\n` +
              `${isActive ? 'Active profile — in-memory client refreshed.' : 'Profile is NOT active; no in-memory effect.'}\n\n` +
              `Reminder: revoke the old token (...${oldSuffix}) in cPanel UI when you\'re sure the new one is healthy.`,
          },
        ],
      };
    },
  );

  server.registerTool(
    'auth_list_profiles',
    {
      description:
        'List all saved cPanel credential profiles with host/user/last-4-token, and which one is active.',
      inputSchema: {},
    },
    async () => {
      const profiles = summarizeProfiles();
      if (profiles.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'No profiles configured. Run /cpanel-mcp:setup or call the `setup` tool to create one.',
            },
          ],
        };
      }
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(profiles, null, 2),
          },
        ],
      };
    },
  );

  server.registerTool(
    'auth_switch_profile',
    {
      description:
        'Switch the active cPanel profile. Reinstantiates the in-memory client immediately ' +
        'so subsequent tool calls use the new profile\'s host/user/token. Use ' +
        '`auth_list_profiles` first to see options.',
      inputSchema: {
        profile: z.string().describe('Name of the profile to activate.'),
      },
    },
    async ({ profile }) => {
      try {
        assertValidProfileName(profile);
      } catch (err) {
        return { isError: true, content: [{ type: 'text' as const, text: (err as Error).message }] };
      }
      if (!profileExists(profile)) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: `Profile "${profile}" does not exist. Available: ${summarizeProfiles().map((p) => p.name).join(', ') || '(none)'}`,
            },
          ],
        };
      }
      setActiveProfile(profile);
      const cfg = readConfig();
      if (cfg.ok) {
        setClient(new CpanelClient(cfg.config!));
        onConfigured();
        return {
          content: [
            {
              type: 'text' as const,
              text: `Active profile is now "${profile}" — ${cfg.config!.user}@${cfg.config!.host}:${cfg.config!.port}.`,
            },
          ],
        };
      }
      setClient(null);
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: `Switched to "${profile}" but it is incomplete: ${cfg.missing.join(', ')}. Run \`setup\` to fix.`,
          },
        ],
      };
    },
  );

  server.registerTool(
    'auth_delete_profile',
    {
      description:
        'Delete a saved profile. Refuses to delete the active profile — switch first. ' +
        'Use cautiously; the on-disk credentials are removed immediately (no undo).',
      inputSchema: {
        profile: z.string(),
        confirm: z
          .boolean()
          .describe('Must be true. Guards against accidental deletion when a profile name is autocompleted.'),
      },
    },
    async ({ profile, confirm }) => {
      if (!confirm) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: 'Refusing to delete: pass `confirm: true` to acknowledge this destroys the credentials on disk.',
            },
          ],
        };
      }
      try {
        deleteProfile(profile);
        return {
          content: [
            {
              type: 'text' as const,
              text: `Profile "${profile}" deleted.`,
            },
          ],
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: (err as Error).message }],
        };
      }
    },
  );
}

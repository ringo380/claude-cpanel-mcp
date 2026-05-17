import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { CpanelClient } from '../cpanel-client.js';
import { unconfiguredResult, asJsonContent, asErrorContent } from './generic.js';

type GetClient = () => CpanelClient | null;

export function registerSslTools(server: McpServer, getClient: GetClient): void {
  server.registerTool(
    'ssl_list_certs',
    {
      description: 'List installed SSL certificates. Wraps SSL::list_ssl_certs.',
      inputSchema: {},
    },
    async () => {
      const client = getClient();
      if (!client) return unconfiguredResult();
      try {
        return asJsonContent(await client.call('SSL', 'list_ssl_certs'));
      } catch (err) {
        return asErrorContent(err);
      }
    },
  );

  server.registerTool(
    'ssl_install_cert',
    {
      description: 'Install an SSL certificate on a domain. Wraps SSL::install_ssl.',
      inputSchema: {
        domain: z.string(),
        cert: z.string().describe('PEM-encoded certificate.'),
        key: z.string().describe('PEM-encoded private key.'),
        cabundle: z.string().optional().describe('PEM-encoded CA chain.'),
      },
    },
    async ({ domain, cert, key, cabundle }) => {
      const client = getClient();
      if (!client) return unconfiguredResult();
      try {
        return asJsonContent(await client.call('SSL', 'install_ssl', { domain, cert, key, cabundle }));
      } catch (err) {
        return asErrorContent(err);
      }
    },
  );

  server.registerTool(
    'ssl_autossl_status',
    {
      description: 'Check whether an AutoSSL check is currently running, and list any problem domains. Wraps AutoSSL::is_autossl_check_in_progress + AutoSSL::get_autossl_problems.',
      inputSchema: {},
    },
    async () => {
      const client = getClient();
      if (!client) return unconfiguredResult();
      try {
        const [running, problems] = await Promise.all([
          client.call('AutoSSL', 'is_autossl_check_in_progress'),
          client.call('AutoSSL', 'get_autossl_problems'),
        ]);
        return asJsonContent({ running: running.data, problems: problems.data });
      } catch (err) {
        return asErrorContent(err);
      }
    },
  );

  server.registerTool(
    'ssl_autossl_run',
    {
      description: 'Trigger an AutoSSL check for this account. Wraps AutoSSL::start_autossl_check.',
      inputSchema: {},
    },
    async () => {
      const client = getClient();
      if (!client) return unconfiguredResult();
      try {
        return asJsonContent(await client.call('AutoSSL', 'start_autossl_check'));
      } catch (err) {
        return asErrorContent(err);
      }
    },
  );
}

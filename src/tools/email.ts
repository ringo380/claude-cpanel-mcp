import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { CpanelClient } from '../cpanel-client.js';
import { unconfiguredResult, asJsonContent, asErrorContent } from './generic.js';

type GetClient = () => CpanelClient | null;

export function registerEmailTools(server: McpServer, getClient: GetClient): void {
  server.registerTool(
    'email_list_accounts',
    {
      description: 'List all email accounts on this cPanel account. Wraps Email::list_pops_with_disk.',
      inputSchema: {},
    },
    async () => {
      const client = getClient();
      if (!client) return unconfiguredResult();
      try {
        return asJsonContent(await client.call('Email', 'list_pops_with_disk'));
      } catch (err) {
        return asErrorContent(err);
      }
    },
  );

  server.registerTool(
    'email_add_account',
    {
      description: 'Create a new email account. Wraps Email::add_pop.',
      inputSchema: {
        email: z.string().describe('Local part of the address (before @).'),
        domain: z.string().describe('Domain part.'),
        password: z.string().describe('Mailbox password.'),
        quota: z.number().optional().describe('Mailbox quota in MB. 0 = unlimited. Defaults to 250.'),
      },
    },
    async ({ email, domain, password, quota }) => {
      const client = getClient();
      if (!client) return unconfiguredResult();
      try {
        return asJsonContent(
          await client.call('Email', 'add_pop', { email, domain, password, quota: quota ?? 250 }),
        );
      } catch (err) {
        return asErrorContent(err);
      }
    },
  );

  server.registerTool(
    'email_delete_account',
    {
      description: 'Delete an email account. Wraps Email::delete_pop.',
      inputSchema: {
        email: z.string().describe('Local part of the address.'),
        domain: z.string().describe('Domain part.'),
      },
    },
    async ({ email, domain }) => {
      const client = getClient();
      if (!client) return unconfiguredResult();
      try {
        return asJsonContent(await client.call('Email', 'delete_pop', { email, domain }));
      } catch (err) {
        return asErrorContent(err);
      }
    },
  );

  server.registerTool(
    'email_change_password',
    {
      description: 'Change an email account password. Wraps Email::passwd_pop.',
      inputSchema: {
        email: z.string(),
        domain: z.string(),
        password: z.string().describe('New password.'),
      },
    },
    async ({ email, domain, password }) => {
      const client = getClient();
      if (!client) return unconfiguredResult();
      try {
        return asJsonContent(await client.call('Email', 'passwd_pop', { email, domain, password }));
      } catch (err) {
        return asErrorContent(err);
      }
    },
  );

  server.registerTool(
    'email_list_forwarders',
    {
      description: 'List email forwarders. Wraps Email::list_forwarders.',
      inputSchema: {
        domain: z.string().optional().describe('Optional domain filter.'),
      },
    },
    async ({ domain }) => {
      const client = getClient();
      if (!client) return unconfiguredResult();
      try {
        return asJsonContent(await client.call('Email', 'list_forwarders', { domain }));
      } catch (err) {
        return asErrorContent(err);
      }
    },
  );

  server.registerTool(
    'email_add_forwarder',
    {
      description: 'Add a forwarder that sends mail for one address to another. Wraps Email::add_forwarder.',
      inputSchema: {
        domain: z.string(),
        email: z.string().describe('Source address (local part).'),
        fwdemail: z.string().describe('Destination email address.'),
      },
    },
    async ({ domain, email, fwdemail }) => {
      const client = getClient();
      if (!client) return unconfiguredResult();
      try {
        return asJsonContent(
          await client.call('Email', 'add_forwarder', {
            domain,
            email,
            fwdopt: 'fwd',
            fwdemail,
          }),
        );
      } catch (err) {
        return asErrorContent(err);
      }
    },
  );
}

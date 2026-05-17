import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { CpanelClient } from '../cpanel-client.js';
import { unconfiguredResult, asJsonContent, asErrorContent } from './generic.js';

type GetClient = () => CpanelClient | null;

export function registerMysqlTools(server: McpServer, getClient: GetClient): void {
  server.registerTool(
    'mysql_list_databases',
    {
      description: 'List all MySQL databases. Wraps Mysql::list_databases.',
      inputSchema: {},
    },
    async () => {
      const client = getClient();
      if (!client) return unconfiguredResult();
      try {
        return asJsonContent(await client.call('Mysql', 'list_databases'));
      } catch (err) {
        return asErrorContent(err);
      }
    },
  );

  server.registerTool(
    'mysql_list_users',
    {
      description: 'List all MySQL users. Wraps Mysql::list_users.',
      inputSchema: {},
    },
    async () => {
      const client = getClient();
      if (!client) return unconfiguredResult();
      try {
        return asJsonContent(await client.call('Mysql', 'list_users'));
      } catch (err) {
        return asErrorContent(err);
      }
    },
  );

  server.registerTool(
    'mysql_create_database',
    {
      description: 'Create a MySQL database. cPanel automatically prefixes the name with <cpanel_user>_. Wraps Mysql::create_database.',
      inputSchema: {
        name: z.string().describe('Database name (cPanel will prefix with your username).'),
      },
    },
    async ({ name }) => {
      const client = getClient();
      if (!client) return unconfiguredResult();
      try {
        return asJsonContent(await client.call('Mysql', 'create_database', { name }));
      } catch (err) {
        return asErrorContent(err);
      }
    },
  );

  server.registerTool(
    'mysql_create_user',
    {
      description: 'Create a MySQL user. cPanel will prefix the name. Wraps Mysql::create_user.',
      inputSchema: {
        name: z.string(),
        password: z.string(),
      },
    },
    async ({ name, password }) => {
      const client = getClient();
      if (!client) return unconfiguredResult();
      try {
        return asJsonContent(await client.call('Mysql', 'create_user', { name, password }));
      } catch (err) {
        return asErrorContent(err);
      }
    },
  );

  server.registerTool(
    'mysql_grant_privileges',
    {
      description: 'Grant privileges on a database to a user. Wraps Mysql::set_privileges_on_database.',
      inputSchema: {
        user: z.string().describe('Full username including the cPanel prefix.'),
        database: z.string().describe('Full database name including the cPanel prefix.'),
        privileges: z
          .string()
          .describe('Comma-separated MySQL privileges, e.g. "ALL PRIVILEGES" or "SELECT,INSERT,UPDATE".'),
      },
    },
    async ({ user, database, privileges }) => {
      const client = getClient();
      if (!client) return unconfiguredResult();
      try {
        return asJsonContent(
          await client.call('Mysql', 'set_privileges_on_database', {
            user,
            database,
            privileges,
          }),
        );
      } catch (err) {
        return asErrorContent(err);
      }
    },
  );
}

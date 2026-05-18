import { z } from 'zod';
import { unconfiguredResult, asJsonContent, asErrorContent } from './generic.js';
export function registerMysqlTools(server, getClient) {
    server.registerTool('mysql_list_databases', {
        description: 'List all MySQL databases. Wraps Mysql::list_databases.',
        inputSchema: {},
    }, async () => {
        const client = getClient();
        if (!client)
            return unconfiguredResult();
        try {
            return asJsonContent(await client.call('Mysql', 'list_databases'));
        }
        catch (err) {
            return asErrorContent(err);
        }
    });
    server.registerTool('mysql_list_users', {
        description: 'List all MySQL users. Wraps Mysql::list_users.',
        inputSchema: {},
    }, async () => {
        const client = getClient();
        if (!client)
            return unconfiguredResult();
        try {
            return asJsonContent(await client.call('Mysql', 'list_users'));
        }
        catch (err) {
            return asErrorContent(err);
        }
    });
    server.registerTool('mysql_create_database', {
        description: 'Create a MySQL database. cPanel automatically prefixes the name with <cpanel_user>_. Wraps Mysql::create_database.',
        inputSchema: {
            name: z.string().describe('Database name (cPanel will prefix with your username).'),
        },
    }, async ({ name }) => {
        const client = getClient();
        if (!client)
            return unconfiguredResult();
        try {
            return asJsonContent(await client.call('Mysql', 'create_database', { name }));
        }
        catch (err) {
            return asErrorContent(err);
        }
    });
    server.registerTool('mysql_create_user', {
        description: 'Create a MySQL user. cPanel will prefix the name. Wraps Mysql::create_user.',
        inputSchema: {
            name: z.string(),
            password: z.string(),
        },
    }, async ({ name, password }) => {
        const client = getClient();
        if (!client)
            return unconfiguredResult();
        try {
            return asJsonContent(await client.call('Mysql', 'create_user', { name, password }));
        }
        catch (err) {
            return asErrorContent(err);
        }
    });
    server.registerTool('mysql_delete_database', {
        description: 'Delete a MySQL database. DESTRUCTIVE — no undo. Pass the full name including the cPanel prefix. Wraps Mysql::delete_database.',
        inputSchema: {
            name: z.string().describe('Full database name including the cPanel user prefix.'),
            confirm: z.boolean().describe('Must be true to acknowledge data loss.'),
        },
    }, async ({ name, confirm }) => {
        const client = getClient();
        if (!client)
            return unconfiguredResult();
        if (!confirm) {
            return {
                isError: true,
                content: [
                    { type: 'text', text: 'Refusing to delete: pass `confirm: true` to acknowledge irreversible data loss.' },
                ],
            };
        }
        try {
            return asJsonContent(await client.call('Mysql', 'delete_database', { name }));
        }
        catch (err) {
            return asErrorContent(err);
        }
    });
    server.registerTool('mysql_delete_user', {
        description: 'Delete a MySQL user. Wraps Mysql::delete_user.',
        inputSchema: {
            name: z.string().describe('Full username including the cPanel user prefix.'),
            confirm: z.boolean().describe('Must be true.'),
        },
    }, async ({ name, confirm }) => {
        const client = getClient();
        if (!client)
            return unconfiguredResult();
        if (!confirm) {
            return {
                isError: true,
                content: [{ type: 'text', text: 'Refusing to delete: pass `confirm: true`.' }],
            };
        }
        try {
            return asJsonContent(await client.call('Mysql', 'delete_user', { name }));
        }
        catch (err) {
            return asErrorContent(err);
        }
    });
    server.registerTool('mysql_rename_database', {
        description: 'Rename a MySQL database. DISRUPTIVE — every application connecting by the old name breaks until reconfigured. Wraps Mysql::rename_database.',
        inputSchema: {
            oldname: z.string().describe('Current full database name (with cPanel prefix).'),
            newname: z.string().describe('New full database name (with cPanel prefix).'),
            confirm: z
                .boolean()
                .describe('Must be true. Acknowledges that connecting apps must be reconfigured.'),
        },
    }, async ({ oldname, newname, confirm }) => {
        const client = getClient();
        if (!client)
            return unconfiguredResult();
        if (!confirm) {
            return {
                isError: true,
                content: [
                    {
                        type: 'text',
                        text: 'Refusing to rename: pass `confirm: true` to acknowledge apps connecting by the old name will break.',
                    },
                ],
            };
        }
        try {
            return asJsonContent(await client.call('Mysql', 'rename_database', { oldname, newname }));
        }
        catch (err) {
            return asErrorContent(err);
        }
    });
    server.registerTool('mysql_change_user_password', {
        description: 'Change a MySQL user\'s password. Wraps Mysql::set_password.',
        inputSchema: {
            user: z.string().describe('Full username including the cPanel prefix.'),
            password: z.string().describe('New password.'),
        },
    }, async ({ user, password }) => {
        const client = getClient();
        if (!client)
            return unconfiguredResult();
        try {
            return asJsonContent(await client.call('Mysql', 'set_password', { user, password }));
        }
        catch (err) {
            return asErrorContent(err);
        }
    });
    server.registerTool('mysql_revoke_privileges', {
        description: 'Revoke all privileges from a user on a specific database. Wraps Mysql::revoke_access_to_database.',
        inputSchema: {
            user: z.string().describe('Full username (with prefix).'),
            database: z.string().describe('Full database name (with prefix).'),
        },
    }, async ({ user, database }) => {
        const client = getClient();
        if (!client)
            return unconfiguredResult();
        try {
            return asJsonContent(await client.call('Mysql', 'revoke_access_to_database', { user, database }));
        }
        catch (err) {
            return asErrorContent(err);
        }
    });
    server.registerTool('mysql_grant_privileges', {
        description: 'Grant privileges on a database to a user. Wraps Mysql::set_privileges_on_database.',
        inputSchema: {
            user: z.string().describe('Full username including the cPanel prefix.'),
            database: z.string().describe('Full database name including the cPanel prefix.'),
            privileges: z
                .string()
                .describe('Comma-separated MySQL privilege keywords WITHOUT the word "PRIVILEGES". For all privileges use "ALL" (not "ALL PRIVILEGES"). Examples: "ALL" or "SELECT,INSERT,UPDATE,DELETE".'),
        },
    }, async ({ user, database, privileges }) => {
        const client = getClient();
        if (!client)
            return unconfiguredResult();
        try {
            return asJsonContent(await client.call('Mysql', 'set_privileges_on_database', {
                user,
                database,
                privileges,
            }));
        }
        catch (err) {
            return asErrorContent(err);
        }
    });
}

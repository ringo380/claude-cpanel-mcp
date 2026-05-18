import { z } from 'zod';
import { unconfiguredResult, asJsonContent, asErrorContent } from './generic.js';
export function registerFtpTools(server, getClient) {
    server.registerTool('ftp_list', {
        description: 'List FTP accounts. Wraps Ftp::list_ftp.',
        inputSchema: {
            include_acct_types: z
                .string()
                .optional()
                .describe('Comma-separated account types to include (e.g. "sub,anonymous,main,logaccess"). Default: all.'),
        },
    }, async ({ include_acct_types }) => {
        const client = getClient();
        if (!client)
            return unconfiguredResult();
        try {
            return asJsonContent(await client.call('Ftp', 'list_ftp', { include_acct_types }));
        }
        catch (err) {
            return asErrorContent(err);
        }
    });
    server.registerTool('ftp_add', {
        description: 'Create an FTP account. Wraps Ftp::add_ftp. Note: cPanel scopes the username under the cPanel user (e.g. "uploader" becomes "uploader@<primary-domain>").',
        inputSchema: {
            user: z.string().describe('FTP username (local part).'),
            pass: z.string().describe('FTP password.'),
            homedir: z.string().describe('Absolute path to the FTP home directory.'),
            quota: z.number().optional().describe('Quota in MB. 0 = unlimited. Default 0.'),
        },
    }, async ({ user, pass, homedir, quota }) => {
        const client = getClient();
        if (!client)
            return unconfiguredResult();
        try {
            return asJsonContent(await client.call('Ftp', 'add_ftp', { user, pass, homedir, quota: quota ?? 0 }));
        }
        catch (err) {
            return asErrorContent(err);
        }
    });
    server.registerTool('ftp_delete', {
        description: 'Delete an FTP account. Wraps Ftp::delete_ftp.',
        inputSchema: {
            user: z.string().describe('Full FTP username (typically "name@domain.tld").'),
            destroy: z
                .boolean()
                .optional()
                .describe('Set true to also remove the user\'s home directory. DESTRUCTIVE — defaults to false.'),
        },
    }, async ({ user, destroy }) => {
        const client = getClient();
        if (!client)
            return unconfiguredResult();
        try {
            return asJsonContent(await client.call('Ftp', 'delete_ftp', { user, destroy: destroy ? 1 : 0 }));
        }
        catch (err) {
            return asErrorContent(err);
        }
    });
    server.registerTool('ftp_change_password', {
        description: 'Change an FTP account password. Wraps Ftp::passwd.',
        inputSchema: {
            user: z.string().describe('Full FTP username.'),
            pass: z.string().describe('New password.'),
        },
    }, async ({ user, pass }) => {
        const client = getClient();
        if (!client)
            return unconfiguredResult();
        try {
            return asJsonContent(await client.call('Ftp', 'passwd', { user, pass }));
        }
        catch (err) {
            return asErrorContent(err);
        }
    });
    server.registerTool('ftp_change_quota', {
        description: 'Change an FTP account quota. Wraps Ftp::set_quota.',
        inputSchema: {
            user: z.string().describe('Full FTP username.'),
            quota: z.number().describe('Quota in MB. 0 = unlimited.'),
        },
    }, async ({ user, quota }) => {
        const client = getClient();
        if (!client)
            return unconfiguredResult();
        try {
            return asJsonContent(await client.call('Ftp', 'set_quota', { user, quota }));
        }
        catch (err) {
            return asErrorContent(err);
        }
    });
    server.registerTool('ftp_server_info', {
        description: 'Return FTP server-level info (port, SSL ports, etc.). Wraps Ftp::server_name + get_port.',
        inputSchema: {},
    }, async () => {
        const client = getClient();
        if (!client)
            return unconfiguredResult();
        try {
            // Sequential, not Promise.all: cPHulk-safe — a single failure on the
            // first call short-circuits and we don't issue the second, which
            // would otherwise double the cPHulk increment on stale creds.
            const name = await client.call('Ftp', 'server_name');
            const port = await client.call('Ftp', 'get_port');
            return asJsonContent({ server_name: name.data, port: port.data });
        }
        catch (err) {
            return asErrorContent(err);
        }
    });
}

import { z } from 'zod';
import { unconfiguredResult, asJsonContent, asErrorContent } from './generic.js';
export function registerBackupTools(server, getClient) {
    server.registerTool('backup_list', {
        description: 'List available backups. Wraps Backup::list_backups.',
        inputSchema: {},
    }, async () => {
        const client = getClient();
        if (!client)
            return unconfiguredResult();
        try {
            return asJsonContent(await client.call('Backup', 'list_backups'));
        }
        catch (err) {
            return asErrorContent(err);
        }
    });
    server.registerTool('backup_create_full', {
        description: 'Create a full backup written to the account home directory. Wraps Backup::fullbackup_to_homedir.',
        inputSchema: {
            email: z.string().optional().describe('Email to notify when backup completes.'),
        },
    }, async ({ email }) => {
        const client = getClient();
        if (!client)
            return unconfiguredResult();
        try {
            return asJsonContent(await client.call('Backup', 'fullbackup_to_homedir', { email }));
        }
        catch (err) {
            return asErrorContent(err);
        }
    });
    server.registerTool('account_info', {
        description: 'Get this cPanel account\'s sidebar stats (disk, bandwidth, email count, etc.). Wraps Variables::get_user_information.',
        inputSchema: {},
    }, async () => {
        const client = getClient();
        if (!client)
            return unconfiguredResult();
        try {
            return asJsonContent(await client.call('Variables', 'get_user_information'));
        }
        catch (err) {
            return asErrorContent(err);
        }
    });
}
//# sourceMappingURL=backups.js.map
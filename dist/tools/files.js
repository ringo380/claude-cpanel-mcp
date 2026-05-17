import { z } from 'zod';
import { unconfiguredResult, asJsonContent, asErrorContent } from './generic.js';
export function registerFileTools(server, getClient) {
    server.registerTool('files_list_dir', {
        description: 'List directory contents. Wraps Fileman::list_files.',
        inputSchema: {
            dir: z.string().describe('Absolute path, e.g. "/home/woobyava/public_html".'),
            show_hidden: z.boolean().optional().describe('Include dotfiles. Defaults to false.'),
        },
    }, async ({ dir, show_hidden }) => {
        const client = getClient();
        if (!client)
            return unconfiguredResult();
        try {
            return asJsonContent(await client.call('Fileman', 'list_files', {
                dir,
                show_hidden: show_hidden ? 1 : 0,
            }));
        }
        catch (err) {
            return asErrorContent(err);
        }
    });
    server.registerTool('files_get_info', {
        description: 'Get stat info for a single file. Wraps Fileman::get_file_information.',
        inputSchema: {
            dir: z.string(),
            file: z.string(),
        },
    }, async ({ dir, file }) => {
        const client = getClient();
        if (!client)
            return unconfiguredResult();
        try {
            return asJsonContent(await client.call('Fileman', 'get_file_information', { dir, file }));
        }
        catch (err) {
            return asErrorContent(err);
        }
    });
    server.registerTool('files_read_file', {
        description: 'Read a small text file. Wraps Fileman::get_file_content. Do not use for binaries; UAPI returns the raw content inline.',
        inputSchema: {
            dir: z.string(),
            file: z.string(),
        },
    }, async ({ dir, file }) => {
        const client = getClient();
        if (!client)
            return unconfiguredResult();
        try {
            return asJsonContent(await client.call('Fileman', 'get_file_content', { dir, file }));
        }
        catch (err) {
            return asErrorContent(err);
        }
    });
    server.registerTool('files_disk_usage', {
        description: 'Get disk quota info for the account. Wraps Quota::get_quota_info.',
        inputSchema: {},
    }, async () => {
        const client = getClient();
        if (!client)
            return unconfiguredResult();
        try {
            return asJsonContent(await client.call('Quota', 'get_quota_info'));
        }
        catch (err) {
            return asErrorContent(err);
        }
    });
}
//# sourceMappingURL=files.js.map
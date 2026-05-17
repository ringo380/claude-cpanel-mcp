import { z } from 'zod';
import { unconfiguredResult, asJsonContent, asErrorContent } from './generic.js';
export function registerCronTools(server, getClient) {
    server.registerTool('cron_list', {
        description: 'List cron jobs. Wraps Cron::list_lines.',
        inputSchema: {},
    }, async () => {
        const client = getClient();
        if (!client)
            return unconfiguredResult();
        try {
            return asJsonContent(await client.call('Cron', 'list_lines'));
        }
        catch (err) {
            return asErrorContent(err);
        }
    });
    server.registerTool('cron_add', {
        description: 'Add a cron job. Wraps Cron::add_line.',
        inputSchema: {
            command: z.string().describe('Shell command to run.'),
            minute: z.string().default('*').describe('Cron minute field. Default "*".'),
            hour: z.string().default('*'),
            day: z.string().default('*'),
            month: z.string().default('*'),
            weekday: z.string().default('*'),
        },
    }, async ({ command, minute, hour, day, month, weekday }) => {
        const client = getClient();
        if (!client)
            return unconfiguredResult();
        try {
            return asJsonContent(await client.call('Cron', 'add_line', {
                command,
                minute,
                hour,
                day,
                month,
                weekday,
            }));
        }
        catch (err) {
            return asErrorContent(err);
        }
    });
    server.registerTool('cron_remove', {
        description: 'Remove a cron job by line number. Wraps Cron::remove_line.',
        inputSchema: {
            line: z.number().describe('Line number from cron_list.'),
        },
    }, async ({ line }) => {
        const client = getClient();
        if (!client)
            return unconfiguredResult();
        try {
            return asJsonContent(await client.call('Cron', 'remove_line', { line }));
        }
        catch (err) {
            return asErrorContent(err);
        }
    });
}
//# sourceMappingURL=cron.js.map
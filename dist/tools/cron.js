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
        description: 'Add a cron job. Wraps Cron::add_line. NOTE: shell metacharacters in `command` (e.g. $VAR, backticks, `~`) are passed verbatim to cron and interpolated by the shell at job-run time, not now.',
        inputSchema: {
            command: z.string().describe('Shell command to run.'),
            minute: z.string().default('*').describe('Cron minute field. Default "*".'),
            hour: z.string().default('*').describe('Cron hour field (0-23). Default "*".'),
            day: z.string().default('*').describe('Cron day-of-month field (1-31). Default "*".'),
            month: z.string().default('*').describe('Cron month field (1-12). Default "*".'),
            weekday: z
                .string()
                .default('*')
                .describe('Cron day-of-week field (0-6, Sunday is 0). Default "*".'),
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

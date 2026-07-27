import { z } from 'zod';
import { unconfiguredResult, asJsonContent, asErrorContent } from './generic.js';
export function registerEmailTools(server, getClient) {
    server.registerTool('email_list_accounts', {
        description: 'List all email accounts on this cPanel account. Wraps Email::list_pops_with_disk.',
        inputSchema: {},
    }, async () => {
        const client = getClient();
        if (!client)
            return unconfiguredResult();
        try {
            return asJsonContent(await client.call('Email', 'list_pops_with_disk'));
        }
        catch (err) {
            return asErrorContent(err);
        }
    });
    server.registerTool('email_add_account', {
        description: 'Create a new email account. Wraps Email::add_pop.',
        inputSchema: {
            email: z.string().describe('Local part of the address (before @).'),
            domain: z.string().describe('Domain part.'),
            password: z.string().describe('Mailbox password.'),
            quota: z.number().optional().describe('Mailbox quota in MB. If omitted, defaults to 250 MB. Pass 0 for unlimited.'),
        },
    }, async ({ email, domain, password, quota }) => {
        const client = getClient();
        if (!client)
            return unconfiguredResult();
        try {
            return asJsonContent(await client.call('Email', 'add_pop', { email, domain, password, quota: quota ?? 250 }));
        }
        catch (err) {
            return asErrorContent(err);
        }
    });
    server.registerTool('email_delete_account', {
        description: 'Delete an email account. Wraps Email::delete_pop.',
        inputSchema: {
            email: z.string().describe('Local part of the address.'),
            domain: z.string().describe('Domain part.'),
        },
    }, async ({ email, domain }) => {
        const client = getClient();
        if (!client)
            return unconfiguredResult();
        try {
            return asJsonContent(await client.call('Email', 'delete_pop', { email, domain }));
        }
        catch (err) {
            return asErrorContent(err);
        }
    });
    server.registerTool('email_change_password', {
        description: 'Change an email account password. Wraps Email::passwd_pop.',
        inputSchema: {
            email: z
                .string()
                .describe('Mailbox local part only, e.g. "info" for info@example.com. Not the full address.'),
            domain: z.string().describe('Domain the mailbox belongs to, e.g. "example.com".'),
            password: z.string().describe('New password. Routed via POST, so it never reaches the cPanel access log.'),
        },
    }, async ({ email, domain, password }) => {
        const client = getClient();
        if (!client)
            return unconfiguredResult();
        try {
            return asJsonContent(await client.call('Email', 'passwd_pop', { email, domain, password }));
        }
        catch (err) {
            return asErrorContent(err);
        }
    });
    server.registerTool('email_list_forwarders', {
        description: 'List email forwarders. Wraps Email::list_forwarders.',
        inputSchema: {
            domain: z.string().optional().describe('Optional domain filter.'),
        },
    }, async ({ domain }) => {
        const client = getClient();
        if (!client)
            return unconfiguredResult();
        try {
            return asJsonContent(await client.call('Email', 'list_forwarders', { domain }));
        }
        catch (err) {
            return asErrorContent(err);
        }
    });
    server.registerTool('email_delete_forwarder', {
        description: 'Delete an email forwarder. Wraps Email::delete_forwarder.',
        inputSchema: {
            address: z.string().describe('The source address being forwarded, e.g. "info@example.com".'),
            forwarder: z.string().describe('The destination address the forwarder sends to.'),
        },
    }, async ({ address, forwarder }) => {
        const client = getClient();
        if (!client)
            return unconfiguredResult();
        try {
            return asJsonContent(await client.call('Email', 'delete_forwarder', { address, forwarder }));
        }
        catch (err) {
            return asErrorContent(err);
        }
    });
    server.registerTool('email_get_disk_usage', {
        description: 'Return disk usage for one mailbox. Wraps Email::get_disk_usage.',
        inputSchema: {
            user: z
                .string()
                .describe('Mailbox local part only, e.g. "info" for info@example.com. Not the full address.'),
            domain: z.string().describe('Domain the mailbox belongs to, e.g. "example.com".'),
        },
    }, async ({ user, domain }) => {
        const client = getClient();
        if (!client)
            return unconfiguredResult();
        try {
            return asJsonContent(await client.call('Email', 'get_disk_usage', { user, domain }));
        }
        catch (err) {
            return asErrorContent(err);
        }
    });
    server.registerTool('email_list_autoresponders', {
        description: 'List autoresponders. Wraps Email::list_auto_responders.',
        inputSchema: {
            domain: z.string().optional().describe('Optional domain filter.'),
        },
    }, async ({ domain }) => {
        const client = getClient();
        if (!client)
            return unconfiguredResult();
        try {
            return asJsonContent(await client.call('Email', 'list_auto_responders', { domain }));
        }
        catch (err) {
            return asErrorContent(err);
        }
    });
    server.registerTool('email_add_autoresponder', {
        description: 'Add or update an autoresponder for an email address. Wraps Email::add_auto_responder. ' +
            'Times use Unix epoch seconds; pass 0 for start/stop to mean "always on".',
        inputSchema: {
            email: z.string().describe('Full email address, e.g. "info@example.com".'),
            from: z.string().describe('From-name shown to recipients.'),
            subject: z.string().describe('Subject line used on the auto-reply itself.'),
            body: z.string().describe('Plain-text body. Use %subject% and %from% as placeholders.'),
            is_html: z.boolean().optional().describe('Set true for HTML body.'),
            interval: z.number().optional().describe('Hours between repeats to the same sender (default 0).'),
            start: z.number().optional().describe('Unix epoch seconds when autoresponder activates. 0 = immediately.'),
            stop: z.number().optional().describe('Unix epoch seconds when it deactivates. 0 = never.'),
            charset: z.string().optional().describe('Default "utf-8".'),
        },
    }, async ({ email, from, subject, body, is_html, interval, start, stop, charset }) => {
        const client = getClient();
        if (!client)
            return unconfiguredResult();
        try {
            return asJsonContent(await client.call('Email', 'add_auto_responder', {
                email,
                from,
                subject,
                body,
                is_html: is_html ? 1 : 0,
                interval: interval ?? 0,
                start: start ?? 0,
                stop: stop ?? 0,
                charset: charset ?? 'utf-8',
            }));
        }
        catch (err) {
            return asErrorContent(err);
        }
    });
    server.registerTool('email_delete_autoresponder', {
        description: 'Delete an autoresponder. Wraps Email::delete_auto_responder.',
        inputSchema: {
            email: z.string().describe('Full email address whose autoresponder to remove.'),
        },
    }, async ({ email }) => {
        const client = getClient();
        if (!client)
            return unconfiguredResult();
        try {
            return asJsonContent(await client.call('Email', 'delete_auto_responder', { email }));
        }
        catch (err) {
            return asErrorContent(err);
        }
    });
    server.registerTool('email_list_filters', {
        description: 'List mail filters for an email account (or account-level if no email). Wraps Email::list_filters.',
        inputSchema: {
            account: z.string().optional().describe('Full email address. Omit for account-level filters.'),
        },
    }, async ({ account }) => {
        const client = getClient();
        if (!client)
            return unconfiguredResult();
        try {
            return asJsonContent(await client.call('Email', 'list_filters', { account }));
        }
        catch (err) {
            return asErrorContent(err);
        }
    });
    server.registerTool('email_delete_filter', {
        description: 'Delete a mail filter by name. Wraps Email::delete_filter.',
        inputSchema: {
            filtername: z
                .string()
                .describe('Filter name exactly as returned by email_list_filters.'),
            account: z.string().optional().describe('Full email address; omit for account-level filter.'),
        },
    }, async ({ filtername, account }) => {
        const client = getClient();
        if (!client)
            return unconfiguredResult();
        try {
            return asJsonContent(await client.call('Email', 'delete_filter', { filtername, account }));
        }
        catch (err) {
            return asErrorContent(err);
        }
    });
    server.registerTool('email_add_forwarder', {
        description: 'Add a forwarder that sends mail for one address to another. Wraps Email::add_forwarder.',
        inputSchema: {
            domain: z
                .string()
                .describe('Domain of the address being forwarded, e.g. "example.com".'),
            email: z
                .string()
                .describe('Local part of the source address, e.g. "sales" to forward sales@<domain>. ' +
                'Does not have to be an existing mailbox - cPanel will forward for an address that has no inbox.'),
            fwdemail: z.string().describe('Full destination address mail is delivered to, e.g. "owner@elsewhere.com".'),
        },
    }, async ({ domain, email, fwdemail }) => {
        const client = getClient();
        if (!client)
            return unconfiguredResult();
        try {
            return asJsonContent(await client.call('Email', 'add_forwarder', {
                domain,
                email,
                fwdopt: 'fwd',
                fwdemail,
            }));
        }
        catch (err) {
            return asErrorContent(err);
        }
    });
}

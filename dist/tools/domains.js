import { z } from 'zod';
import { unconfiguredResult, asJsonContent, asErrorContent } from './generic.js';
export function registerDomainTools(server, getClient) {
    server.registerTool('domains_list_all', {
        description: 'List main, parked, addon, and sub domains. Wraps DomainInfo::list_domains.',
        inputSchema: {},
    }, async () => {
        const client = getClient();
        if (!client)
            return unconfiguredResult();
        try {
            return asJsonContent(await client.call('DomainInfo', 'list_domains'));
        }
        catch (err) {
            return asErrorContent(err);
        }
    });
    server.registerTool('subdomain_list', {
        description: 'List subdomains. Wraps SubDomain::list_subdomains.',
        inputSchema: {},
    }, async () => {
        const client = getClient();
        if (!client)
            return unconfiguredResult();
        try {
            return asJsonContent(await client.call('SubDomain', 'list_subdomains'));
        }
        catch (err) {
            return asErrorContent(err);
        }
    });
    server.registerTool('subdomain_add', {
        description: 'Create a subdomain. Wraps SubDomain::add_subdomain.',
        inputSchema: {
            domain: z.string().describe('Subdomain prefix, e.g. "blog".'),
            rootdomain: z.string().describe('Parent domain, e.g. "example.com".'),
            dir: z.string().optional().describe('Document root, relative to home. Defaults to public_html/<sub>.'),
        },
    }, async ({ domain, rootdomain, dir }) => {
        const client = getClient();
        if (!client)
            return unconfiguredResult();
        try {
            return asJsonContent(await client.call('SubDomain', 'add_subdomain', { domain, rootdomain, dir }));
        }
        catch (err) {
            return asErrorContent(err);
        }
    });
    server.registerTool('subdomain_remove', {
        description: 'Delete a subdomain. Wraps SubDomain::delete_subdomain.',
        inputSchema: {
            domain: z.string().describe('Full subdomain, e.g. "blog.example.com".'),
        },
    }, async ({ domain }) => {
        const client = getClient();
        if (!client)
            return unconfiguredResult();
        try {
            return asJsonContent(await client.call('SubDomain', 'delete_subdomain', { domain }));
        }
        catch (err) {
            return asErrorContent(err);
        }
    });
    server.registerTool('addon_domain_list', {
        description: 'List addon domains. Wraps AddonDomain::list_addon_domains.',
        inputSchema: {},
    }, async () => {
        const client = getClient();
        if (!client)
            return unconfiguredResult();
        try {
            return asJsonContent(await client.call('AddonDomain', 'list_addon_domains'));
        }
        catch (err) {
            return asErrorContent(err);
        }
    });
    server.registerTool('addon_domain_add', {
        description: 'Add an addon domain. Wraps AddonDomain::add_addon_domain.',
        inputSchema: {
            newdomain: z.string().describe('Addon domain name, e.g. "newsite.com".'),
            subdomain: z.string().describe('Internal subdomain alias (cPanel always creates one).'),
            pass: z.string().describe('FTP password for the co-located FTP account cPanel provisions for the addon. Required by UAPI.'),
            dir: z.string().optional().describe('Document root.'),
        },
    }, async ({ newdomain, subdomain, dir, pass }) => {
        const client = getClient();
        if (!client)
            return unconfiguredResult();
        try {
            return asJsonContent(await client.call('AddonDomain', 'add_addon_domain', { newdomain, subdomain, dir, pass }));
        }
        catch (err) {
            return asErrorContent(err);
        }
    });
}

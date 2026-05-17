import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { CpanelClient } from '../cpanel-client.js';
import { unconfiguredResult, asJsonContent, asErrorContent } from './generic.js';

type GetClient = () => CpanelClient | null;

export function registerDnsTools(server: McpServer, getClient: GetClient): void {
  server.registerTool(
    'dns_list_zones',
    {
      description: 'List all DNS zones managed on this account. Wraps DomainInfo::list_domains for zone enumeration.',
      inputSchema: {},
    },
    async () => {
      const client = getClient();
      if (!client) return unconfiguredResult();
      try {
        return asJsonContent(await client.call('DomainInfo', 'list_domains'));
      } catch (err) {
        return asErrorContent(err);
      }
    },
  );

  server.registerTool(
    'dns_get_zone_records',
    {
      description: 'Get DNS records for a zone. Wraps DNS::parse_zone.',
      inputSchema: {
        zone: z.string().describe('Domain / zone name, e.g. "example.com".'),
      },
    },
    async ({ zone }) => {
      const client = getClient();
      if (!client) return unconfiguredResult();
      try {
        return asJsonContent(await client.call('DNS', 'parse_zone', { zone }));
      } catch (err) {
        return asErrorContent(err);
      }
    },
  );

  server.registerTool(
    'dns_add_record',
    {
      description: 'Add a DNS record. Uses ZoneEdit::add_zone_record (works on most cPanels). For complex/batch edits use uapi_call with DNS::mass_edit_zone.',
      inputSchema: {
        domain: z.string().describe('Zone, e.g. "example.com".'),
        name: z.string().describe('Record name (subdomain). Use "@" or the zone name itself for apex.'),
        type: z.enum(['A', 'AAAA', 'CNAME', 'TXT', 'MX', 'SRV', 'NS', 'CAA']),
        address: z.string().describe('Record value (IP for A/AAAA, target hostname for CNAME/MX, text for TXT, etc.).'),
        ttl: z.number().optional().describe('TTL in seconds. Defaults to 14400.'),
        priority: z.number().optional().describe('MX/SRV priority.'),
      },
    },
    async ({ domain, name, type, address, ttl, priority }) => {
      const client = getClient();
      if (!client) return unconfiguredResult();
      try {
        const params: Record<string, string | number> = {
          domain,
          name,
          type,
          address,
          ttl: ttl ?? 14400,
        };
        if (priority !== undefined) params.priority = priority;
        return asJsonContent(await client.call('ZoneEdit', 'add_zone_record', params));
      } catch (err) {
        return asErrorContent(err);
      }
    },
  );

  server.registerTool(
    'dns_edit_record',
    {
      description: 'Edit an existing DNS record by line number. Use dns_get_zone_records first to find the line. Wraps ZoneEdit::edit_zone_record.',
      inputSchema: {
        domain: z.string(),
        line: z.number().describe('Line number of the record in the zone (from dns_get_zone_records).'),
        name: z.string().optional(),
        type: z.string().optional(),
        address: z.string().optional(),
        ttl: z.number().optional(),
      },
    },
    async ({ domain, line, name, type, address, ttl }) => {
      const client = getClient();
      if (!client) return unconfiguredResult();
      try {
        return asJsonContent(
          await client.call('ZoneEdit', 'edit_zone_record', {
            domain,
            line,
            name,
            type,
            address,
            ttl,
          }),
        );
      } catch (err) {
        return asErrorContent(err);
      }
    },
  );

  server.registerTool(
    'dns_remove_record',
    {
      description: 'Remove a DNS record by line number. Wraps ZoneEdit::remove_zone_record.',
      inputSchema: {
        domain: z.string(),
        line: z.number().describe('Line number of the record to remove.'),
      },
    },
    async ({ domain, line }) => {
      const client = getClient();
      if (!client) return unconfiguredResult();
      try {
        return asJsonContent(await client.call('ZoneEdit', 'remove_zone_record', { domain, line }));
      } catch (err) {
        return asErrorContent(err);
      }
    },
  );
}

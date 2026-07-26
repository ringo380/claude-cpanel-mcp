---
permalink: /
title: cpanel-mcp
description: MCP server for the cPanel UAPI, distributed as a Claude Code plugin.
---

# cpanel-mcp

MCP server for the cPanel UAPI, distributed as a Claude Code plugin. Manage email accounts, DNS records, files, MySQL databases, FTP accounts, SSL certificates, cron jobs, subdomains, addon domains, and backups on any shared cPanel host - directly from Claude Code.

[Source on GitHub](https://github.com/ringo380/claude-cpanel-mcp) &middot; [Changelog](https://github.com/ringo380/claude-cpanel-mcp/blob/main/CHANGELOG.md) &middot; MIT licensed

## Documentation

- **[Setup and authentication]({{ site.baseurl }}/setup/)** - creating a cPanel API token, credential profiles, environment variables.
- **[Tool reference]({{ site.baseurl }}/tools/)** - all 74 tools, grouped by family, with the UAPI call each one wraps.
- **[Troubleshooting]({{ site.baseurl }}/troubleshooting/)** - cPHulk lockouts, auth failures, TLS problems, common error codes.
- **[Development]({{ site.baseurl }}/development/)** - building, testing, the design invariants, and the release flow.

## Install

Via the Robworks marketplace:

```
/plugin marketplace add robworks-code/robworks-claude-code-plugins
/plugin install cpanel-mcp
```

Or directly:

```
/plugin install ringo380/claude-cpanel-mcp
```

Then run `/cpanel-mcp:setup` in Claude Code and follow the prompts. Full details in [Setup]({{ site.baseurl }}/setup/).

## Why this exists

cPanel's UAPI is broad but awkward: 80+ modules, inconsistent naming between UAPI and the older API 2, and a brute-force guard (cPHulk) that will lock you out of your own hosting account if a client retries a bad token. This server wraps the parts you actually use, and is built so that a wrong credential costs you one failed request rather than a support ticket.

### What you get

| | |
| --- | --- |
| **74 tools** | Email, DNS, files (read and write), MySQL, FTP, domains, SSL, cron, backups, plus auth management. |
| **`uapi_call` escape hatch** | Reach any UAPI module or function that has no dedicated wrapper. |
| **Named profiles** | Manage several cPanel accounts and switch between them mid-session. |
| **cPHulk-safe by design** | One attempt per call, never a retry. Lockouts surface as a distinct `CPHULK_LOCKOUT` error with remediation guidance. |
| **Secrets stay out of the logs** | Params matching `password`, `key`, `cert`, `token`, `secret` and similar are automatically routed over POST, so they never appear in `/usr/local/cpanel/logs/access_log`. |
| **Validated setup** | Credentials are checked against the live UAPI before anything is written to disk. |

## Quick examples

Once configured, ask Claude Code in plain language. Some things it can do:

- "List every email account on the server and show me which mailboxes are over 1 GB."
- "Add an A record for `staging.example.com` pointing at 203.0.113.10 with a 300 second TTL."
- "Create a MySQL database and user for a new WordPress install, and grant all privileges."
- "Show me what's in `public_html/wp-content/uploads` and delete the `.DS_Store` files."
- "Is AutoSSL healthy? If any domain has a problem, run a fresh check."
- "Add a nightly cron job at 3:15 am that runs my backup script."

## Requirements

- Node 18 or newer.
- A cPanel account with API token access (Security -> Manage API Tokens). WHM is not required.
- Nothing else - no OAuth app, no server-side install.

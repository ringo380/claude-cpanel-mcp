# cpanel-mcp

MCP server for the cPanel UAPI, distributed as a Claude Code plugin. Manage email accounts, DNS records, files, MySQL databases, SSL certificates, cron jobs, subdomains, addon domains, and backups on any shared cPanel host — directly from Claude Code.

## What it does

- **Curated tools** for the most-used cPanel operations: email, DNS, files, MySQL, domains, SSL, cron, backups.
- **`uapi_call` escape hatch** — any of cPanel's ~80 UAPI modules and hundreds of functions are reachable, even ones without a dedicated wrapper.
- **`list_modules` / `list_functions`** for discovery.
- **cPHulk-aware**: detects brute-force-protection lockouts and refuses to retry, surfacing a clear "file a support ticket" message instead of hammering the server.
- **Interactive setup** via an MCP `setup` tool, a `/cpanel-mcp:setup` slash command, or a standalone `cpanel-mcp-setup` CLI. Credentials are validated against the live UAPI before being saved.

## Install

### Via the Robworks marketplace
```
/plugin marketplace add ringo380/robworks-claude-code-plugins
/plugin install cpanel-mcp
```

### Direct
```
/plugin install ringo380/claude-cpanel-mcp
```

## Setup

cPanel uses API tokens for authentication — there is no OAuth. You create the token in cPanel's UI, then paste it back.

1. **Generate a token**: log into cPanel, open **Security → Manage API Tokens**, click **Create**, name it (e.g. `claude-code-mcp`), copy the value once.
2. **Run setup**:

   - **In Claude Code**: call the `setup` MCP tool with `host`, `user`, `api_key`, or invoke `/cpanel-mcp:setup` for a guided walk-through.
   - **CLI** (after a local `git clone` + `npm install -g .`): `cpanel-mcp-setup` (input is hidden for the token).

Setup validates the credentials by calling `Variables::get_user_information`. On success, it writes `~/.config/cpanel-mcp/.env` with mode 0600 and you can immediately use every tool. On failure it tells you what went wrong without saving anything.

### Configuration precedence

`process.env` > `~/.config/cpanel-mcp/.env`. Useful env vars:

| Var | Purpose |
| --- | --- |
| `CPANEL_HOST` | cPanel hostname or IP, no scheme, no port. |
| `CPANEL_PORT` | Defaults to `2083`. |
| `CPANEL_USER` | cPanel username. |
| `CPANEL_API_KEY` | API token. |
| `CPANEL_INSECURE_TLS` | Set to `1` to skip cert verification (only for self-signed). |

## Tool catalog

Universal:
- `setup`, `auth_status`, `whoami`, `list_modules`, `list_functions`, `uapi_call`

Curated:
- Email: `email_list_accounts`, `email_add_account`, `email_delete_account`, `email_change_password`, `email_list_forwarders`, `email_add_forwarder`
- DNS: `dns_list_zones`, `dns_get_zone_records`, `dns_add_record`, `dns_edit_record`, `dns_remove_record`
- Files: `files_list_dir`, `files_get_info`, `files_read_file`, `files_disk_usage`
- MySQL: `mysql_list_databases`, `mysql_list_users`, `mysql_create_database`, `mysql_create_user`, `mysql_grant_privileges`
- Domains: `domains_list_all`, `subdomain_list`, `subdomain_add`, `subdomain_remove`, `addon_domain_list`, `addon_domain_add`
- SSL: `ssl_list_certs`, `ssl_install_cert`, `ssl_autossl_status`, `ssl_autossl_run`
- Cron: `cron_list`, `cron_add`, `cron_remove`
- Backups / account: `backup_list`, `backup_create_full`, `account_info`

Anything not covered above: use `uapi_call(module, function, params)`. Reference: [cPanel UAPI docs](https://api.docs.cpanel.net/openapi/cpanel-public/operations/).

## cPHulk lockout warning

Shared cPanel hosts (Siteocity, etc.) often run aggressive cPHulk brute-force protection. **A wrong token can lock your account/IP**, sometimes requiring a support ticket to unblock. This plugin defends against that by:

- Never retrying on failure.
- Detecting cPHulk responses (403/503 with brute-force markers) and raising a distinct `CPHULK_LOCKOUT` error with remediation guidance.
- Validating credentials once in `setup` and not auto-validating again on every server start.

If you do get locked out, sometimes connecting via the server's raw IP (set `CPANEL_HOST` to the IP and re-run `setup`) bypasses hostname-keyed cPHulk rules. Otherwise: support ticket.

## Develop

```bash
git clone https://github.com/ringo380/claude-cpanel-mcp.git
cd claude-cpanel-mcp
npm install
npm run build
npm test
```

## License

MIT

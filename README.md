# cpanel-mcp

MCP server for the cPanel UAPI, distributed as a Claude Code plugin. Manage email accounts, DNS records, files, MySQL databases, FTP accounts, SSL certificates, cron jobs, subdomains, addon domains, and backups on any shared cPanel host - directly from Claude Code.

**Docs site**: https://ringo380.github.io/claude-cpanel-mcp/

## What it does

- **74 tools** covering the most-used cPanel operations: email, DNS, files (read *and* write), MySQL, FTP, domains, SSL, cron, backups.
- **`uapi_call` escape hatch** - any of cPanel's 80+ UAPI modules and hundreds of functions are reachable, even ones without a dedicated wrapper.
- **`list_modules` / `list_functions`** for discovery, backed by a static catalog (no network call).
- **Named credential profiles** - manage several cPanel accounts and switch between them (`auth_switch_profile`, `/cpanel-mcp:account-switch`).
- **cPHulk-aware**: detects brute-force-protection lockouts and refuses to retry, surfacing a clear "file a support ticket" message instead of hammering the server.
- **Secrets never hit the access log**: calls carrying a password, token, key, or certificate are automatically routed over POST.
- **Interactive setup** via an MCP `setup` tool, a `/cpanel-mcp:setup` slash command, or a standalone `cpanel-mcp-setup` CLI. Credentials are validated against the live UAPI before being saved.

## Install

### Via the Robworks marketplace

```
/plugin marketplace add robworks-code/robworks-claude-code-plugins
/plugin install cpanel-mcp
```

### Direct

```
/plugin install ringo380/claude-cpanel-mcp
```

## Setup

cPanel uses API tokens for authentication - there is no OAuth. You create the token in cPanel's UI, then paste it back.

1. **Generate a token**: log into cPanel, open **Security -> Manage API Tokens**, click **Create**, name it (e.g. `claude-code-mcp`), copy the value once. (`auth_open_token_page` will print the exact URL for your host.)
2. **Run setup**:
   - **In Claude Code**: invoke `/cpanel-mcp:setup` for a guided walk-through, or call the `setup` MCP tool directly with `host`, `user`, `api_key`.
   - **CLI** (after a local `git clone` + `npm install -g .`): `cpanel-mcp-setup` (token input is hidden).

Setup validates the credentials by calling `Variables::get_user_information`. On success it writes `~/.config/cpanel-mcp/profiles/<name>.env` with mode 0600 (atomic temp + rename) and every tool becomes usable immediately. On failure it tells you what went wrong without saving anything.

Want to check credentials without writing anything to disk? Use `auth_test`.

### Credential profiles

Credentials live under `~/.config/cpanel-mcp/profiles/<name>.env`. The default profile is named `default`.

| Task | Tool | Slash command |
| --- | --- | --- |
| See what is configured | `auth_status` | - |
| List saved profiles | `auth_list_profiles` | `/cpanel-mcp:account-switch` |
| Switch active profile | `auth_switch_profile` | `/cpanel-mcp:account-switch` |
| Add a profile | `setup` (pass `profile`) | `/cpanel-mcp:setup` |
| Replace a token | `auth_rotate_token` | `/cpanel-mcp:setup` |
| Remove a profile | `auth_delete_profile` | - |

`auth_delete_profile` refuses to delete the active profile - switch away first.

A pre-0.3 `~/.config/cpanel-mcp/.env` is migrated to `profiles/default.env` automatically on first read; the legacy file is left in place with a deprecation header.

### Configuration precedence

`process.env` wins over the profile file on disk. Useful env vars:

| Var | Purpose |
| --- | --- |
| `CPANEL_HOST` | cPanel hostname or IP, no scheme, no port. |
| `CPANEL_PORT` | Defaults to `2083`. |
| `CPANEL_USER` | cPanel username. |
| `CPANEL_API_KEY` | API token. |
| `CPANEL_PROFILE` | Which saved profile to load. Defaults to `default`. |
| `CPANEL_INSECURE_TLS` | Set to `1` to skip cert verification (only for self-signed certs). |

## Tool catalog

### Auth and setup

`setup`, `auth_status`, `auth_test`, `auth_rotate_token`, `auth_list_profiles`, `auth_switch_profile`, `auth_delete_profile`, `auth_open_token_page`, `whoami`

### Discovery and escape hatch

`list_modules`, `list_functions`, `uapi_call`

### Email

`email_list_accounts`, `email_add_account`, `email_delete_account`, `email_change_password`, `email_get_disk_usage`, `email_list_forwarders`, `email_add_forwarder`, `email_delete_forwarder`, `email_list_autoresponders`, `email_add_autoresponder`, `email_delete_autoresponder`, `email_list_filters`, `email_delete_filter`

### DNS

`dns_list_zones`, `dns_get_zone_records`, `dns_add_record`, `dns_edit_record`, `dns_remove_record`

### Files

Read: `files_list_dir`, `files_get_info`, `files_read_file`, `files_disk_usage`

Write: `files_write_file`, `files_create_directory`, `files_delete`, `files_move`, `files_copy`, `files_chmod`, `files_compress`, `files_extract`

`files_delete` requires an explicit confirm flag, and every write tool rejects system paths (`/`, `/etc`, `/var`, `/usr`, ...).

### MySQL

`mysql_list_databases`, `mysql_list_users`, `mysql_create_database`, `mysql_create_user`, `mysql_delete_database`, `mysql_delete_user`, `mysql_rename_database`, `mysql_change_user_password`, `mysql_grant_privileges`, `mysql_revoke_privileges`

cPanel prefixes database and user names with `<cpanel_user>_` on create; pass the full prefixed name when deleting or renaming.

### FTP

`ftp_list`, `ftp_add`, `ftp_delete`, `ftp_change_password`, `ftp_change_quota`, `ftp_server_info`

### Domains

`domains_list_all`, `subdomain_list`, `subdomain_add`, `subdomain_remove`, `addon_domain_list`, `addon_domain_add`

### SSL

`ssl_list_certs`, `ssl_install_cert`, `ssl_autossl_status`, `ssl_autossl_run`

### Cron

`cron_list`, `cron_add`, `cron_remove`

Shell metacharacters in a cron `command` (`$VAR`, backticks, `~`) are passed verbatim and interpolated by the shell at job-run time, not at add time.

### Backups and account

`backup_list`, `backup_create_full`, `account_info`

Anything not covered above: use `uapi_call(module, function, params)`. Reference: [cPanel UAPI docs](https://api.docs.cpanel.net/openapi/cpanel-public/operations/).

## cPHulk lockout warning

Shared cPanel hosts often run aggressive cPHulk brute-force protection. **A wrong token can lock your account or IP**, sometimes requiring a support ticket to unblock. This plugin defends against that by:

- Never retrying on failure - one attempt per call, always.
- Detecting cPHulk responses (403/503 with brute-force markers) and raising a distinct `CPHULK_LOCKOUT` error with remediation guidance, separate from a plain `AUTH_FAILED`.
- Validating credentials once during `setup` rather than re-validating on every server start.

If you do get locked out, connecting via the server's raw IP (set `CPANEL_HOST` to the IP and re-run `setup`) sometimes bypasses hostname-keyed cPHulk rules. Otherwise: support ticket.

## Notes on the API surface

- **File mutations use cPanel API 2, not UAPI.** UAPI's `Fileman` module is read/utility only - `delete_files`, `move_files` and friends do not exist there. `files_delete|move|copy|chmod|compress|extract` route through API 2 `Fileman::fileop`. `files_write_file`, `files_create_directory`, and all reads stay on UAPI. See [CHANGELOG 0.4.0](CHANGELOG.md).
- **Sensitive params force POST.** Any param whose name matches `password|pass|key|cert|cabundle|token|secret` (and similar) is sent as a POST body, because GET query strings land in `/usr/local/cpanel/logs/access_log` in plaintext.
- **The tool list is static.** Every tool registers at startup; if no credentials are loaded, handlers return a structured "unconfigured" error rather than disappearing from the list.

## Develop

```bash
git clone https://github.com/ringo380/claude-cpanel-mcp.git
cd claude-cpanel-mcp
npm install
npm run build
npm test          # vitest, 50 tests
npm run dev       # watch mode via tsx
npm run type-check
```

Requires Node 18+.

## License

MIT - see [LICENSE](LICENSE).

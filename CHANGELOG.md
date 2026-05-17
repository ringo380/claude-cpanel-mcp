# Changelog

## 0.1.0 — 2026-05-17

Initial release.

- MCP server (`@ringo380/cpanel-mcp`) over the cPanel UAPI.
- Claude Code plugin manifest, stdio launcher, and `/cpanel-mcp:setup` slash command.
- Interactive `setup` MCP tool and standalone `cpanel-mcp-setup` CLI; credentials validated against live UAPI before save.
- Curated tools: email, DNS, files, MySQL, domains/subdomains, SSL/AutoSSL, cron, backups.
- Universal `uapi_call` escape hatch plus `list_modules` / `list_functions` discovery.
- cPHulk-safe HTTP layer: no retries, typed `CPHulkLockoutError`, `CPanelAuthError`, `CPanelUapiError`.
- `~/.config/cpanel-mcp/.env` persistent config (mode 0600), env-overrides-file precedence.

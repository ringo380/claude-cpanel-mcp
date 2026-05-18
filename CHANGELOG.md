# Changelog

## 0.2.0 — 2026-05-17

Code-review fixes (no breaking changes for tool callers; one stricter param):

- **Security**: UAPI calls carrying sensitive params (`password`, `key`, `cert`, `cabundle`, `pass`, `token`, `secret`, etc.) now auto-route via POST with a form-encoded body so the values never appear in the request URL. Previously these landed in `/usr/local/cpanel/logs/access_log`. Most impactful: `ssl_install_cert` no longer leaks TLS private keys.
- `addon_domain_add`: `pass` is now required (matches UAPI's actual contract).
- `mysql_grant_privileges`: description corrected — UAPI wants `"ALL"`, not `"ALL PRIVILEGES"`.
- `cron_add`: description now warns about shell-metacharacter interpolation timing.
- Auth-error regex tightened to word-boundary matches so "Invalid domain name" no longer trips an auth-error classification.
- Server-version literal now read from `package.json` at runtime.
- Server `instructions` string rewritten to be valid in both unconfigured and authenticated states (the SDK captures it once at startup).
- `tsconfig.json`: `module` and `moduleResolution` switched to `NodeNext` (correct for Node ESM); source maps disabled in shipped `dist/`.
- Launcher no longer prefers a globally-installed `cpanel-mcp` over the bundled `dist/index.js` — marketplace updates now take effect immediately. Opt back in with `CPANEL_MCP_USE_GLOBAL=1`.
- New tests: network error branch, non-JSON 200 body, `validateStatus` regression guard, sensitive-param POST routing.

## 0.1.1 — 2026-05-17

- Update repository URLs to `ringo380/claude-cpanel-mcp` (avoids collision with an older unrelated `ringo380/cpanel-mcp` repo).

## 0.1.0 — 2026-05-17

Initial release.

- MCP server (`@ringo380/cpanel-mcp`) over the cPanel UAPI.
- Claude Code plugin manifest, stdio launcher, and `/cpanel-mcp:setup` slash command.
- Interactive `setup` MCP tool and standalone `cpanel-mcp-setup` CLI; credentials validated against live UAPI before save.
- Curated tools: email, DNS, files, MySQL, domains/subdomains, SSL/AutoSSL, cron, backups.
- Universal `uapi_call` escape hatch plus `list_modules` / `list_functions` discovery.
- cPHulk-safe HTTP layer: no retries, typed `CPHulkLockoutError`, `CPanelAuthError`, `CPanelUapiError`.
- `~/.config/cpanel-mcp/.env` persistent config (mode 0600), env-overrides-file precedence.

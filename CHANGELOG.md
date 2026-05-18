# Changelog

## 0.3.0 — 2026-05-18

Major coverage expansion and auth UX overhaul. No breaking changes to existing tools or env-var setup; the on-disk credential layout migrates automatically.

### Auth UX

- **Named profiles**: credentials now live under `~/.config/cpanel-mcp/profiles/<name>.env` (mode 0600, atomic temp+rename). Default profile name is `default`. Switch via `CPANEL_PROFILE` env var, the `auth_switch_profile` tool, or `/cpanel-mcp:account-switch`.
- **Backward-compat migration**: existing `~/.config/cpanel-mcp/.env` is migrated to `profiles/default.env` on first read. The legacy file is left in place with a deprecation header for reference.
- **New tools**:
  - `auth_test` — dry-run credential validation without writing to disk.
  - `auth_rotate_token` — atomically swap the API token for a profile, re-validating before commit.
  - `auth_list_profiles` / `auth_switch_profile` / `auth_delete_profile` — multi-account management.
  - `auth_open_token_page` — surface the cPanel token-management URL with step-by-step instructions and a suggested token name. Does not auto-open the browser (unsafe in headless/SSH).
- **Setup tool** now accepts a `profile` arg and an `activate` flag.
- **Server instructions** at startup now reflect configured/unconfigured state and the active profile (best-effort: SDK doesn't refresh mid-session).
- **Slash commands** rewritten as state machines:
  - `/cpanel-mcp:setup` now drives the full flow via `auth_status` → `auth_open_token_page` → `auth_test` → `setup`.
  - `/cpanel-mcp:account-switch` (new) for picking among saved profiles.

### Coverage additions

- **Files (write)**: `files_write_file`, `files_create_directory`, `files_delete` (with confirm guard), `files_move`, `files_copy`, `files_chmod`, `files_compress`, `files_extract`. System-path guard rejects writes to `/`, `/etc`, `/var`, `/usr`, etc.
- **MySQL**: `mysql_delete_database`, `mysql_delete_user`, `mysql_rename_database`, `mysql_change_user_password`, `mysql_revoke_privileges`.
- **Email**: `email_list_autoresponders`, `email_add_autoresponder`, `email_delete_autoresponder`, `email_list_filters`, `email_delete_filter`, `email_delete_forwarder`, `email_get_disk_usage`.
- **FTP** (new module): `ftp_list`, `ftp_add`, `ftp_delete`, `ftp_change_password`, `ftp_change_quota`, `ftp_server_info`.

### Invariants

All Release 0.2 invariants retained and tested:
- POST routing for sensitive params (`password|pass|key|cert|cabundle|token|secret|...`).
- `validateStatus: () => true` on the axios instance.
- Single attempt per call; distinct `CPHULK_LOCKOUT` vs `AUTH_FAILED` classification.
- All new write tools register up-front and degrade to a structured "unconfigured" error when no creds are loaded.

### Hardening (post-review)

- `ftp_server_info`: switched from `Promise.all` to sequential calls. First failure short-circuits so a stale-creds AUTH_FAILED only counts once against cPHulk instead of twice.
- `files-write` path guards: `pathLooksDangerous` now blocks system roots AND their descendants (prefix match, not exact-match) — `/etc/cron.d` and `/usr/local/bin` no longer slip through. Added `validateFilename` that rejects empty, traversal (`..`, `/`, `\\`), null bytes, and `.`/`..` for all single-file and array-of-files write tools.
- `mysql_rename_database`: now requires `confirm: true` (matches the delete tools' pattern; rename breaks every app pointing at the old name).
- `auth_rotate_token`: failure path now appends an explicit "DO NOT RETRY" warning when the cause was `CPHULK_LOCKOUT`, matching `auth_test`'s wording.

### Tests

34 tests across 5 files (was 19). New coverage: profile round-trips, atomic writes, mode 0600, legacy migration, `auth_test` never touches disk, sensitive-param routing for new tools, `pathLooksDangerous` prefix-match, `validateFilename` traversal/null-byte/empty rejection.

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

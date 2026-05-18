---
description: Guided first-run setup for cpanel-mcp — collect cPanel host, username, and API token, validate, and save to ~/.config/cpanel-mcp/.env.
allowed-tools: ["Bash", "Read", "Write", "AskUserQuestion"]
disable-model-invocation: true
---

# /cpanel-mcp:setup

Walk the user through end-to-end setup so they can go from "plugin enabled" to "issuing cPanel API calls from Claude Code" in one session.

> cPanel does NOT support OAuth — authentication is via an API token the user creates inside the cPanel UI, then pastes back here. This command guides that flow.

## Pre-flight

1. Check whether a config already exists:
   ```bash
   test -f "$HOME/.config/cpanel-mcp/.env" && echo "EXISTS" || echo "MISSING"
   ```
   If `EXISTS`, ask the user whether to keep or overwrite before proceeding.

2. Call the `auth_status` MCP tool to confirm current state and credential source.

## What the user needs

Use `AskUserQuestion` to collect, one at a time:

1. **cPanel hostname** — what they put in the browser to reach `cPanel`. Examples: `web2.siteocity.com`, `cpanel.theirdomain.com`, or the server's raw IP. Strip any `https://` or trailing port.
2. **cPanel username** — their login name.
3. **cPanel API token** — see "Generate the token" below.

## Generate the token

Tell the user to:

1. Log into cPanel at `https://<host>:2083/` in a browser.
2. Search the cPanel home page for **"Manage API Tokens"** (or go directly to `https://<host>:2083/frontend/jupiter/security/tokens/index.html`).
3. Click **Create**, give it a name like `claude-code-mcp`, leave privileges at the default (full access), and copy the token shown — it is displayed exactly once.

> Note: many shared hosts limit API token features. If "Manage API Tokens" is missing from cPanel, ask the hosting provider's support team to enable it for the account.

## Install credentials

Offer two setup styles:

### Option A — MCP `setup` tool (recommended)

Call the `setup` MCP tool with the collected values:

```
setup(host="<host>", user="<user>", api_key="<token>")
```

The tool validates by calling `Variables::get_user_information` against the cPanel UAPI; on success it writes `~/.config/cpanel-mcp/.env` (mode 0600) and immediately marks the session as authenticated — every other cPanel tool becomes usable without a restart.

If validation fails with `CPHULK_LOCKOUT`, the user's IP has been blocked by cPHulk brute-force protection. They must file a ticket with the hosting provider to clear it; retrying will only extend the lockout window. Direct-IP `:2083` access sometimes bypasses hostname-keyed cPHulk rules — offer to retry `setup` with the server's raw IP as `host`.

### Option B — Standalone CLI

Requires a local clone and global install (`git clone …/cpanel-mcp && cd cpanel-mcp && npm install -g .`). Then:
```bash
cpanel-mcp-setup
```
Input is hidden for the token. After it finishes, ask the user to reconnect the MCP server (`/mcp` → reconnect `cpanel-mcp`).

## Verify

Call read-only tools to confirm:

- `whoami` — shows host, user, and last-4 of the token.
- `account_info` — returns cPanel sidebar stats (disk, bandwidth, etc.).
- `email_list_accounts` — lists email accounts.

## Notes

- Config load order: `process.env` > `~/.config/cpanel-mcp/.env` (env wins). Note: the MCP host (Claude Code) captures env vars at server-launch time, not per-call, so changing an env var only takes effect after `/mcp` → reconnect `cpanel-mcp`. For mid-session credential changes, prefer calling the `setup` MCP tool — it updates the in-memory client immediately.
- The token is stored on disk as plain text under mode 0600. Treat it like a password.
- To revoke, delete the token in cPanel → Manage API Tokens, then re-run `/cpanel-mcp:setup` with a new one.

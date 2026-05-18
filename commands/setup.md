---
description: Guided interactive setup for cpanel-mcp — collect cPanel host, username, and API token, validate (dry-run), and save to a named profile.
allowed-tools: ["Bash", "Read", "Write", "AskUserQuestion"]
disable-model-invocation: true
---

# /cpanel-mcp:setup

Drive a state-machine flow that takes the user from "plugin enabled" to "issuing cPanel API calls" entirely in chat. The MCP tools handle persistence; this command orchestrates the conversation.

> cPanel does NOT support OAuth. Authentication is via an API token the user creates inside the cPanel UI and pastes back here.

## Step 1 — Diagnose current state

Call `auth_status`. Branch on the result:

- **Already configured**: ask via `AskUserQuestion` whether they want to (a) add a new profile (multi-account setup), (b) rotate the token on the active profile (`auth_rotate_token`), or (c) abort. If (a), proceed to Step 2 with a fresh profile name. If (b), skip to Step 4 with `auth_rotate_token` instead of `setup`.
- **Not configured**: proceed to Step 2 with profile name `"default"`.

## Step 2 — Collect host + user

Use `AskUserQuestion`, one field at a time:

1. **cPanel hostname** — what they put in the browser to reach cPanel. Examples: `web2.siteocity.com`, `cpanel.theirdomain.com`, or the server's raw IP. Strip any `https://` or trailing port for them.
2. **cPanel username** — their login name.
3. **(If adding a profile)** profile name — short kebab-case label like `siteocity` or `client-acme`. 1-64 chars of `[a-zA-Z0-9_.-]`.

## Step 3 — Surface the token-creation URL

Call `auth_open_token_page(host=<host>)`. Relay the URL and the numbered steps it returns to the user.

> If they report "Manage API Tokens" is missing from cPanel, the hosting provider has it disabled. Stop here and tell them to file a support ticket.

Ask them to paste the token back in chat. Treat the pasted value as opaque — never log or echo it back in full.

## Step 4 — Dry-run validate

Call `auth_test(host=<host>, user=<user>, api_key=<token>)`. **This does NOT write to disk.**

Branch on result:

- **OK**: proceed to Step 5.
- **`CPHULK_LOCKOUT`**: stop. Tell the user their IP is blocked, instruct them to file a hosting-provider ticket, and offer to retry once unblocked. Suggest trying the server's raw IP instead of hostname (cPHulk is often hostname-keyed). Do NOT retry automatically — repeated attempts extend the lockout.
- **`AUTH_FAILED`**: ask whether the token is fresh (cPanel sometimes shows the token only once and pasting can lose characters). Loop back to Step 3 with a regenerated token.
- **`NETWORK_ERROR`**: confirm host and port (default 2083); ask whether the host uses a self-signed cert (offer `insecure_tls=true`).

## Step 5 — Persist

Call `setup(host=..., user=..., api_key=..., profile=<name>)`. The tool re-validates (idempotent) then writes atomically to `~/.config/cpanel-mcp/profiles/<name>.env` (mode 0600) and activates the profile.

## Step 6 — Verify

Call lightweight read-only tools to confirm the session is live:

- `whoami` — host, user, last-4 of token.
- `account_info` — account stats (disk, bandwidth, etc.).
- `email_list_accounts` — sanity check that a write-capable tool resolves.

## Notes for the operator

- For mid-session credential changes, prefer `setup` / `auth_rotate_token` / `auth_switch_profile` over editing files or env vars — they refresh the in-memory client immediately. Env-var changes only take effect after `/mcp` → reconnect `cpanel-mcp`.
- Tokens are stored as plain text under mode 0600. Treat them like passwords.
- To revoke a token, delete it in cPanel → Manage API Tokens, then either run this command again (to install a new one) or call `auth_rotate_token` directly with the replacement.
- Multi-account: re-invoke this command with a fresh profile name. Switch between accounts with `auth_switch_profile` or `/cpanel-mcp:account-switch`.

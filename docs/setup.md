---
permalink: /setup/
title: Setup and authentication
description: Creating a cPanel API token, credential profiles, and environment variables for cpanel-mcp.
---

# Setup and authentication

[Back to index]({{ site.baseurl }}/)

cPanel does not support OAuth. Authentication is a **username plus an API token** that you create inside the cPanel web UI and paste back into Claude Code once.

## 1. Create an API token

1. Log into cPanel (usually `https://your-host:2083`).
2. Open **Security -> Manage API Tokens**.
3. Click **Create**, name the token something recognisable such as `claude-code-mcp`.
4. Copy the value. cPanel shows it exactly once.

If you are not sure of the URL for your host, call the `auth_open_token_page` tool - it prints the token-management URL and the steps above, tailored to your hostname. It deliberately does not launch a browser, because that is unsafe over SSH or in a headless session.

**Scope the token if your host allows it.** cPanel tokens can be restricted to specific features. A token limited to what you actually intend to automate limits the blast radius if it leaks.

## 2. Run setup

Pick whichever fits your session:

### Guided (recommended)

```
/cpanel-mcp:setup
```

This drives the whole flow in chat: it checks current state with `auth_status`, points you at the token page, dry-run validates with `auth_test`, then saves with `setup`.

### Direct tool call

Call the `setup` MCP tool with:

| Arg | Required | Notes |
| --- | --- | --- |
| `host` | yes | Hostname or IP. No scheme, no port. |
| `user` | yes | cPanel username. |
| `api_key` | yes | The token you just copied. |
| `port` | no | Defaults to `2083`. |
| `profile` | no | Profile name to save under. Defaults to `default`. |
| `activate` | no | Make this profile active immediately. |

### CLI

After a local clone:

```bash
git clone https://github.com/ringo380/claude-cpanel-mcp.git
cd claude-cpanel-mcp
npm install -g .
cpanel-mcp-setup
```

Token input is hidden as you type.

## What setup actually does

1. Builds a client for the host and port you gave.
2. Calls `Variables::get_user_information` once - a cheap, read-only UAPI call.
3. **On success**, writes `~/.config/cpanel-mcp/profiles/<name>.env` with mode `0600`, using an atomic temp-file-then-rename so a crash mid-write cannot leave a truncated credential file.
4. **On failure**, writes nothing and reports what went wrong: bad credentials, wrong host, TLS problem, or a cPHulk lockout.

There is exactly one validation attempt. See [Troubleshooting]({{ site.baseurl }}/troubleshooting/) for why that matters.

To check credentials without touching disk at all, use `auth_test`.

## Credential profiles

Profiles let you manage several cPanel accounts - useful for agency or reseller work.

| Task | Tool | Slash command |
| --- | --- | --- |
| See what is configured | `auth_status` | - |
| List saved profiles | `auth_list_profiles` | `/cpanel-mcp:account-switch` |
| Switch active profile | `auth_switch_profile` | `/cpanel-mcp:account-switch` |
| Add a profile | `setup` with a `profile` arg | `/cpanel-mcp:setup` |
| Replace a token | `auth_rotate_token` | `/cpanel-mcp:setup` |
| Remove a profile | `auth_delete_profile` | - |

Notes:

- `auth_switch_profile` reinstantiates the in-memory client immediately, so the next tool call uses the new account.
- `auth_delete_profile` refuses to delete the profile that is currently active. Switch away first.
- `auth_rotate_token` re-validates the new token *before* it commits the swap, so a typo cannot leave a profile broken.
- `auth_list_profiles` shows host, user, and the last four characters of each token - never the full value.

### On-disk layout

```
~/.config/cpanel-mcp/
├── .env                      # legacy, pre-0.3 only
└── profiles/
    ├── default.env
    └── clientsite.env
```

A pre-0.3 `~/.config/cpanel-mcp/.env` is migrated into `profiles/default.env` automatically the first time it is read. The old file is left in place with a deprecation header so nothing silently disappears - you can delete it once you have confirmed the migration.

## Environment variables

`process.env` takes precedence over whatever is stored in the profile file. This is the hook for CI, containers, or a one-off override.

| Var | Purpose |
| --- | --- |
| `CPANEL_HOST` | cPanel hostname or IP. No scheme, no port. |
| `CPANEL_PORT` | Defaults to `2083`. |
| `CPANEL_USER` | cPanel username. |
| `CPANEL_API_KEY` | API token. |
| `CPANEL_PROFILE` | Which saved profile to load. Defaults to `default`. |
| `CPANEL_INSECURE_TLS` | Set to `1` to skip certificate verification. Only for self-signed certs - see the warning below. |

### About `CPANEL_INSECURE_TLS`

Setting this disables certificate verification for every request, which means your API token is exposed to anyone able to intercept the connection. Use it only against a host you control with a known self-signed certificate, and prefer fixing the certificate. It is never appropriate for a shared-hosting provider whose cert should be valid.

## Verifying it works

- `whoami` - shows the configured host, port, user, and last four of the token. No network call.
- `auth_status` - reports whether the server is configured and where the credentials came from.
- `account_info` - a live call returning disk, bandwidth, and email counts. If this returns data, everything is wired up.

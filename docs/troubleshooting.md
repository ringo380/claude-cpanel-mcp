---
permalink: /troubleshooting/
title: Troubleshooting
description: cPHulk lockouts, auth failures, TLS problems, and the error codes cpanel-mcp raises.
---

# Troubleshooting

[Back to index]({{ site.baseurl }}/)

## Error codes

Every failure surfaces a structured error with a `code`. The five you will see:

| Code | Meaning | What to do |
| --- | --- | --- |
| `CPHULK_LOCKOUT` | cPanel's brute-force guard has blocked this IP or account. | Stop. See [cPHulk lockouts](#cphulk-lockouts) below. Do **not** keep trying. |
| `AUTH_FAILED` | Credentials were rejected - wrong username, wrong or revoked token, or the token lacks the needed feature scope. | Verify with `whoami`, then re-run `/cpanel-mcp:setup` or `auth_rotate_token`. |
| `UAPI_ERROR` | The call reached cPanel and cPanel refused it - bad params, missing feature, nonexistent domain. | Read the message; it carries cPanel's own error text. |
| `API2_ERROR` | Same, for an API 2 file-mutation call (`Fileman::fileop`). | Usually a path that does not exist or is not writable. |
| `NETWORK_ERROR` (or an axios code such as `ECONNREFUSED`, `ETIMEDOUT`, `CERT_HAS_EXPIRED`) | The request never got a usable answer. | See [Connection and TLS](#connection-and-tls). |

## cPHulk lockouts

Shared cPanel hosts typically run cPHulk with aggressive thresholds. **A handful of failed authentications can lock your account or your IP out of cPanel entirely**, sometimes for hours, sometimes until a support ticket clears it. Without WHM access you cannot lift the block yourself.

### How this server protects you

- **One attempt per call, always.** There is no retry logic anywhere in the client. A single wrong token costs exactly one failed request. This is a deliberate, tested invariant - retrying is the single fastest way to turn a typo into a multi-hour outage.
- **Lockouts are classified separately from auth failures.** The client inspects status and body: explicit `cphulk` or `brute force` markers, a 503 mentioning "temporarily", or a 403 serving an **HTML** lockout page all read as `CPHULK_LOCKOUT`. A 403 returning JSON is a plain auth failure, because telling you to file a support ticket when you really just need to fix a token wastes everyone's time.
- **Credentials are validated once, during setup** - not on every server start. Restarting Claude Code does not re-hammer the login endpoint.

### If you are already locked out

1. **Stop making calls.** Every further attempt can extend the block.
2. **Wait.** Many cPHulk configurations use a rolling window and clear on their own within 15 minutes to a few hours.
3. **Try the raw IP.** cPHulk rules are often keyed to hostname. Setting `CPANEL_HOST` to the server's IP address and re-running `setup` sometimes gets through. Your host's cPanel welcome email or DNS lookup of the hostname will give you the IP.
4. **File a support ticket.** With no WHM, this is the reliable path. Ask them to clear the cPHulk block for your IP and to whitelist it if you intend to automate regularly.

### Avoiding it in the first place

- Use `auth_test` (dry-run, writes nothing) rather than guessing at `setup` repeatedly.
- Copy the token straight from cPanel. Tokens are shown once; a partially selected copy is the most common cause.
- Ask your host to whitelist your IP in cPHulk if you will be automating against the account regularly.

## Authentication failures

`AUTH_FAILED` has a short list of causes, in rough order of likelihood:

1. **Token mistyped or truncated.** Check `whoami` - it shows the last four characters of the loaded token. Compare against cPanel's token list.
2. **Token revoked or expired.** cPanel tokens can be given an expiry. Check **Security -> Manage API Tokens**.
3. **Wrong username.** The cPanel username, not an email address and not the domain.
4. **Token scope too narrow.** If you restricted the token's features, a call outside that scope fails as an auth error, not a permission error. Widen the scope or use a full-access token.
5. **Wrong profile active.** With several accounts saved it is easy to be pointed at the wrong one. `auth_list_profiles` shows which is active.

## Connection and TLS

| Symptom | Likely cause |
| --- | --- |
| `ECONNREFUSED` | Wrong port. cPanel is on `2083` for HTTPS; `2082` is plaintext and not supported here. Some hosts proxy it behind `:443/cpanel` instead. |
| `ENOTFOUND` | Hostname typo, or you included a scheme or port in `CPANEL_HOST`. It takes a bare hostname or IP. |
| `ETIMEDOUT` | A firewall between you and the host, or the host blocks 2083 from outside its own network. Some providers require you to whitelist your IP first. |
| `CERT_HAS_EXPIRED` / `UNABLE_TO_VERIFY_LEAF_SIGNATURE` / `ERR_TLS_CERT_ALTNAME_INVALID` | The host's certificate is expired, self-signed, or does not cover the hostname you used - common when connecting by IP. |

For a genuinely self-signed host you control, `CPANEL_INSECURE_TLS=1` skips verification. This exposes your API token to anyone able to intercept the connection, so treat it as a last resort and never for a commercial shared host, whose certificate should simply be valid.

## Tool-specific gotchas

**"Tool returned an unconfigured error."** No credentials are loaded. The tool list is static by design - every tool is always registered - so this is what an unconfigured server looks like rather than a missing tool. Run `auth_status`, then `/cpanel-mcp:setup`.

**A file delete, move, or chmod fails on an older release.** Versions before 0.4.0 pointed those tools at UAPI `Fileman` functions that do not exist. Upgrade to 0.4.0 or later; they now use API 2 `Fileman::fileop`.

**A DNS or cron edit hits the wrong entry.** Both address entries by **line number**, and line numbers shift after any add or remove. Re-read with `dns_get_zone_records` or `cron_list` between mutations instead of reusing a number from earlier in the session.

**A MySQL delete or grant says the database does not exist.** cPanel prefixes names with `<cpanel_user>_`. Create takes the bare name; everything else takes the full prefixed name as shown by `mysql_list_databases`.

**A file write is refused.** Write tools reject system paths (`/`, `/etc`, `/var`, `/usr`, ...). Stay inside the account home directory. `files_delete` additionally needs an explicit confirmation flag.

**A cron command behaves differently than expected.** `$VAR`, backticks and `~` are stored verbatim and expanded by the shell when the job runs, not when it is added.

**`files_read_file` returns garbage.** It wraps `Fileman::get_file_content`, which returns content inline as text. It is not usable for binaries.

## Still stuck

Open an issue at [github.com/ringo380/claude-cpanel-mcp/issues](https://github.com/ringo380/claude-cpanel-mcp/issues). Include the error `code`, the tool you called, and your cPanel version if you know it - UAPI availability varies noticeably between releases. **Never paste an API token into an issue.**

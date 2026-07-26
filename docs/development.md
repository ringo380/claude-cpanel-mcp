---
permalink: /development/
title: Development
description: Building, testing, design invariants, and the release flow for cpanel-mcp.
---

# Development

[Back to index]({{ site.baseurl }}/)

## Build and test

```bash
git clone https://github.com/ringo380/claude-cpanel-mcp.git
cd claude-cpanel-mcp
npm install
npm run build        # tsc, then chmod +x the two bin entry points
npm test             # vitest, 50 tests
```

Other scripts:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Watch mode via `tsx`. |
| `npm run type-check` | `tsc --noEmit`. |
| `npm start` | Run the built server from `dist/`. |
| `npm run test:watch` | Vitest in watch mode. |

Node 18 or newer. The test suite is entirely offline - it mocks the HTTP layer, so it never touches a real cPanel host and cannot trigger a cPHulk lockout.

## Layout

```
src/
├── index.ts              # MCP server bootstrap, tool registration
├── config.ts             # env + profile resolution, precedence
├── profiles.ts           # named credential profiles on disk
├── cpanel-client.ts      # HTTP layer: UAPI + API 2, error classification
├── modules-catalog.ts    # static UAPI module/function catalog
├── setup.ts              # standalone cpanel-mcp-setup CLI
└── tools/                # one module per tool family
    ├── auth-helpers.ts   generic.ts    setup.ts
    ├── email.ts   dns.ts   files.ts   files-write.ts
    ├── mysql.ts   ftp.ts   domains.ts   ssl.ts
    └── cron.ts   backups.ts

tests/                    # vitest, mirrors the modules it pins
commands/                 # /cpanel-mcp:setup, /cpanel-mcp:account-switch
hooks/scripts/            # launch-mcp.sh, the stdio entry point
.claude-plugin/           # plugin manifest
```

## Design invariants

These are load-bearing and pinned by tests. Changing any of them without changing the corresponding test means something is wrong.

### POST routing for sensitive params

`SENSITIVE_PARAM_KEYS` in `src/cpanel-client.ts` lists `password`, `pass`, `passwd`, `newpass`, `key`, `cert`, `cabundle`, `api_key`, `apikey`, `token`, `secret`. Any call carrying one of these is form-encoded into a POST body rather than a query string, because cPanel logs the full request line - query string included - to `/usr/local/cpanel/logs/access_log`. A GET would write the secret to disk in plaintext on the server.

Pinned by `tests/cpanel-client.test.ts`.

### `validateStatus: () => true`

The axios instance never throws on a non-2xx. Keeping 4xx and 5xx responses inside our own dispatch is what makes it possible to distinguish a cPHulk lockout page from an auth rejection from a generic server error - axios's default would collapse them all into one thrown error before we could look at the body.

Pinned by `tests/cpanel-client.test.ts` ("pins validateStatus").

### File mutations go through API 2

`files_delete`, `files_move`, `files_copy`, `files_chmod`, `files_compress`, and `files_extract` call `client.callApi2('Fileman', 'fileop', { op: ... })`. UAPI's `Fileman` module is read/utility only - the mutation functions do not exist there and calling them fails on every server. Never re-point these at `client.call`.

`files_write_file` (`save_file_content`), `files_create_directory` (`mkdir`), and all read tools legitimately stay on UAPI.

Pinned by `tests/files-write.test.ts`.

### API 2 result coercion

API 2 returns `cpanelresult.event.result` as either the number `1` or the string `"1"`, depending on cPanel version. `callApi2` coerces with `Number()`. Tightening this to a strict `=== 1` makes successful calls throw on roughly half of deployed cPanel versions.

Pinned by `tests/cpanel-client.test.ts`.

### Never retry

There is no retry logic in the client, and there must not be. cPHulk is unforgiving: a single auth failure that auto-retries can convert "wrong token" into a multi-hour IP block that needs a support ticket to clear.

### The tool list is static

Every curated tool registers up front at startup. Handlers call `getClient()` and return a structured "unconfigured" error when nothing is configured. Dynamic registration is not an option - the MCP SDK does not reliably refresh tool lists mid-session, so a tool that appears only after setup would stay invisible until restart.

## Smoke-testing against a live host

Before doing live work, probe with plain `curl`. This skips the MCP layer entirely, so a bad credential costs one request and cannot compound into a lockout through retries:

```bash
curl -sS -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: cpanel $CPANEL_USER:$CPANEL_API_KEY" \
  --max-time 15 \
  "https://YOUR_HOST:2083/execute/Variables/get_user_information"
```

`200` means good. Anything else - stop and read [Troubleshooting]({{ site.baseurl }}/troubleshooting/) before trying again.

## Release flow

1. Bump the version in `package.json`, `.claude-plugin/plugin.json`, and add a `CHANGELOG.md` entry.
2. `npm run build && npm test`.
3. Commit, push, then tag: `git tag -a vX.Y.Z -m "..." && git push origin vX.Y.Z`.
4. Bump the `ref:` for this plugin in the [Robworks marketplace manifest](https://github.com/robworks-code/robworks-claude-code-plugins), commit and push.
5. Consumers pick it up with `/plugin marketplace update`.

Ship a new patch tag rather than moving an existing one - a replaced tag leaves anyone who already installed that version silently on different code.

## Contributing

Issues and pull requests: [github.com/ringo380/claude-cpanel-mcp](https://github.com/ringo380/claude-cpanel-mcp).

When adding a tool:

- Register it up front alongside its family in `src/tools/`.
- Guard with `getClient()` and return `unconfiguredResult()` when unconfigured.
- Return errors through `asErrorContent(err)` so the structured `code` survives.
- Name any secret-bearing param so it matches `SENSITIVE_PARAM_KEYS`, or add the key to that set - otherwise it goes out over GET and into the server's access log.
- Add it to the [tool reference]({{ site.baseurl }}/tools/) and the README catalog.

Never paste real credentials into tests, fixtures, issues, or pull requests.

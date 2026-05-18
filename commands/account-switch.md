---
description: Switch the active cPanel profile (host/user/token combination) used by cpanel-mcp.
allowed-tools: ["AskUserQuestion"]
disable-model-invocation: true
---

# /cpanel-mcp:account-switch

Switch between previously-saved cPanel credential profiles. Useful when managing multiple cPanel accounts (e.g. agency / reseller workflows).

## Flow

1. Call `auth_list_profiles` to enumerate saved profiles. Each entry shows the profile name, host, user, last-4 of the token, and whether it's currently active.
2. If only one profile exists, surface that fact and stop — no switch is meaningful.
3. Use `AskUserQuestion` to let the user pick from the available non-active profiles. Show host + user alongside the profile name so they can disambiguate.
4. Call `auth_switch_profile(profile=<name>)`. The tool reinstantiates the in-memory client immediately; subsequent tool calls use the new credentials with no restart needed.
5. Verify with `whoami` and surface the new host/user to the user.

## Notes

- To add a new profile, use `/cpanel-mcp:setup` instead.
- To delete a profile, call `auth_delete_profile(profile=<name>, confirm=true)` — refuses to delete the currently-active profile.
- The `CPANEL_PROFILE` env var overrides the active-profile file at MCP server startup time, so a profile set via env var cannot be switched away from mid-session (you'd need to unset and reconnect the MCP).

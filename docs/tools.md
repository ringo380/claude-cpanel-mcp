---
permalink: /tools/
title: Tool reference
description: All 74 cpanel-mcp tools, grouped by family, with the cPanel API call each one wraps.
---

# Tool reference

[Back to index]({{ site.baseurl }}/)

74 tools. Every tool registers at server startup regardless of whether credentials are loaded; if nothing is configured, a call returns a structured "unconfigured" error rather than the tool vanishing from the list.

Unless noted, tools wrap **UAPI** (`https://<host>:2083/execute/<Module>/<function>`). The file-mutation tools wrap **API 2** instead - see [Files](#files).

Jump to: [Auth and setup](#auth-and-setup) &middot; [Discovery](#discovery-and-escape-hatch) &middot; [Email](#email) &middot; [DNS](#dns) &middot; [Files](#files) &middot; [MySQL](#mysql) &middot; [FTP](#ftp) &middot; [Domains](#domains) &middot; [SSL](#ssl) &middot; [Cron](#cron) &middot; [Backups](#backups-and-account)

## Auth and setup

| Tool | What it does |
| --- | --- |
| `setup` | Validate and save cPanel credentials (host, username, API token) to a named profile. Validates against the live UAPI before writing. |
| `auth_status` | Report whether cpanel-mcp is configured, and where the credentials were loaded from. |
| `auth_test` | Dry-run credential validation against the UAPI without writing anything to disk. |
| `auth_rotate_token` | Atomically swap the API token on an existing profile, re-validating before commit. |
| `auth_list_profiles` | List saved profiles with host, user, last-4 of token, and which is active. |
| `auth_switch_profile` | Switch the active profile. Reinstantiates the in-memory client immediately. |
| `auth_delete_profile` | Delete a saved profile. Refuses to delete the active one - switch first. |
| `auth_open_token_page` | Return the cPanel API-token management URL for a host, with step-by-step instructions and a suggested token name. Does not auto-open a browser. |
| `whoami` | Show configured host, port, user, and last-4 of the token. No network call. |

For a live credential check use `auth_status`; for live account stats use `account_info`.

## Discovery and escape hatch

| Tool | What it does |
| --- | --- |
| `list_modules` | List known UAPI modules with one-line descriptions. Static catalog, no network call. |
| `list_functions` | List known functions for a UAPI module. Static and not exhaustive. |
| `uapi_call` | Universal escape hatch. Calls `/execute/<module>/<function>` with arbitrary params and returns parsed JSON. |

`list_modules` and `list_functions` are navigation aids only. Anything they omit is still reachable through `uapi_call` - the full surface is documented in the [cPanel UAPI reference](https://api.docs.cpanel.net/openapi/cpanel-public/operations/).

`uapi_call` throws `CPHULK_LOCKOUT` on a brute-force lockout and `AUTH_FAILED` on a credential rejection, exactly like the curated tools.

## Email

| Tool | Wraps |
| --- | --- |
| `email_list_accounts` | `Email::list_pops_with_disk` |
| `email_add_account` | `Email::add_pop` |
| `email_delete_account` | `Email::delete_pop` |
| `email_change_password` | `Email::passwd_pop` |
| `email_get_disk_usage` | `Email::get_disk_usage` (one mailbox) |
| `email_list_forwarders` | `Email::list_forwarders` |
| `email_add_forwarder` | `Email::add_forwarder` |
| `email_delete_forwarder` | `Email::delete_forwarder` |
| `email_list_autoresponders` | `Email::list_auto_responders` |
| `email_add_autoresponder` | `Email::add_auto_responder` (also updates an existing one) |
| `email_delete_autoresponder` | `Email::delete_auto_responder` |
| `email_list_filters` | `Email::list_filters` (account-level if no address given) |
| `email_delete_filter` | `Email::delete_filter` (by filter name) |

Passwords are routed over POST automatically, so they never land in the cPanel access log.

## DNS

| Tool | Wraps |
| --- | --- |
| `dns_list_zones` | `DomainInfo::list_domains`, used for zone enumeration |
| `dns_get_zone_records` | `DNS::parse_zone` |
| `dns_add_record` | `ZoneEdit::add_zone_record` |
| `dns_edit_record` | `ZoneEdit::edit_zone_record` |
| `dns_remove_record` | `ZoneEdit::remove_zone_record` |

**Records are addressed by line number.** Call `dns_get_zone_records` first to find the line you want before editing or removing. Line numbers shift when records are added or removed, so re-read the zone between mutations rather than reusing a stale number.

For complex or batch zone edits, `uapi_call` with `DNS::mass_edit_zone` is the better tool.

## Files

Read tools use UAPI:

| Tool | Wraps |
| --- | --- |
| `files_list_dir` | `Fileman::list_files` |
| `files_get_info` | `Fileman::get_file_information` |
| `files_read_file` | `Fileman::get_file_content` - text only; UAPI returns content inline, so do not use it on binaries |
| `files_disk_usage` | `Quota::get_quota_info` |

Write tools split across two APIs:

| Tool | Wraps |
| --- | --- |
| `files_write_file` | UAPI `Fileman::save_file_content` (POST) |
| `files_create_directory` | UAPI `Fileman::mkdir` |
| `files_delete` | **API 2** `Fileman::fileop` `op=unlink` |
| `files_move` | **API 2** `Fileman::fileop` `op=move` |
| `files_copy` | **API 2** `Fileman::fileop` `op=copy` |
| `files_chmod` | **API 2** `Fileman::fileop` `op=chmod` (perms passed via `metadata`) |
| `files_compress` | **API 2** `Fileman::fileop` `op=compress` (type via `metadata`) |
| `files_extract` | **API 2** `Fileman::fileop` `op=extract` |

### Why API 2

cPanel's **UAPI `Fileman` module is read/utility only**. `delete_files`, `move_files` and their siblings simply do not exist there - calling them fails on every server. File mutations live in the older API 2 `Fileman::fileop` endpoint (`/json-api/cpanel`). Versions before 0.4.0 pointed these six tools at nonexistent UAPI functions and were broken against every host; 0.4.0 fixed it. This is a pinned invariant in the test suite.

`files_compress` supports `zip`, `tar`, `tar.gz` (`gz`), and `tar.bz2` (`bz2`).

### Safety guards

- `files_delete` requires an explicit confirmation flag before it will do anything.
- Every write tool rejects system paths - `/`, `/etc`, `/var`, `/usr` and similar - so a malformed path cannot walk outside the account.

## MySQL

| Tool | Wraps |
| --- | --- |
| `mysql_list_databases` | `Mysql::list_databases` |
| `mysql_list_users` | `Mysql::list_users` |
| `mysql_create_database` | `Mysql::create_database` |
| `mysql_create_user` | `Mysql::create_user` |
| `mysql_delete_database` | `Mysql::delete_database` - **destructive, no undo** |
| `mysql_delete_user` | `Mysql::delete_user` |
| `mysql_rename_database` | `Mysql::rename_database` - **disruptive**, every app connecting by the old name breaks until reconfigured |
| `mysql_change_user_password` | `Mysql::set_password` |
| `mysql_grant_privileges` | `Mysql::set_privileges_on_database` |
| `mysql_revoke_privileges` | `Mysql::revoke_access_to_database` (all privileges on one database) |

**Name prefixing:** cPanel automatically prefixes new databases and users with `<cpanel_user>_`. When creating, pass the bare name. When deleting, renaming, or granting, pass the **full prefixed name** as it appears in `mysql_list_databases`.

## FTP

| Tool | Wraps |
| --- | --- |
| `ftp_list` | `Ftp::list_ftp` |
| `ftp_add` | `Ftp::add_ftp` |
| `ftp_delete` | `Ftp::delete_ftp` |
| `ftp_change_password` | `Ftp::passwd` |
| `ftp_change_quota` | `Ftp::set_quota` |
| `ftp_server_info` | `Ftp::server_name` + `Ftp::get_port` |

cPanel scopes FTP usernames under the cPanel account: creating `uploader` yields `uploader@<primary-domain>`.

## Domains

| Tool | Wraps |
| --- | --- |
| `domains_list_all` | `DomainInfo::list_domains` - main, parked, addon, and sub domains |
| `subdomain_list` | `SubDomain::list_subdomains` |
| `subdomain_add` | `SubDomain::add_subdomain` |
| `subdomain_remove` | `SubDomain::delete_subdomain` |
| `addon_domain_list` | `AddonDomain::list_addon_domains` |
| `addon_domain_add` | `AddonDomain::add_addon_domain` |

## SSL

| Tool | Wraps |
| --- | --- |
| `ssl_list_certs` | `SSL::list_ssl_certs` |
| `ssl_install_cert` | `SSL::install_ssl` |
| `ssl_autossl_status` | `AutoSSL::is_autossl_check_in_progress` + `AutoSSL::get_autossl_problems` |
| `ssl_autossl_run` | `AutoSSL::start_autossl_check` |

Certificate, key, and CA bundle params are routed over POST automatically.

## Cron

| Tool | Wraps |
| --- | --- |
| `cron_list` | `Cron::list_lines` |
| `cron_add` | `Cron::add_line` |
| `cron_remove` | `Cron::remove_line` (by line number) |

Shell metacharacters in a `command` - `$VAR`, backticks, `~` - are passed to cron verbatim and interpolated by the shell **at job-run time**, not when the job is added. Quote accordingly.

As with DNS, `cron_remove` addresses jobs by line number, so re-read with `cron_list` before removing.

## Backups and account

| Tool | Wraps |
| --- | --- |
| `backup_list` | `Backup::list_backups` |
| `backup_create_full` | `Backup::fullbackup_to_homedir` |
| `account_info` | `Variables::get_user_information` - disk, bandwidth, email count and other sidebar stats |

`backup_create_full` writes into the account home directory, which counts against your disk quota. Check `files_disk_usage` first on a tight account.

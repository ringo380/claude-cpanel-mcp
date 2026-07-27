---
permalink: /parameters/
title: Parameter reference
description: Input parameters for every cpanel-mcp tool, generated from the live tool schemas.
---

# Parameter reference

[Back to index]({{ site.baseurl }}/) &middot; [Tool reference]({{ site.baseurl }}/tools/)

Input parameters for all 74 tools. Generated from the server's own `tools/list` output, so it reflects the actual Zod schemas rather than a hand-maintained copy.

**Required** parameters are marked `yes`. Anything else is optional; where a default exists it is stated in the description.

Every tool also shares one behaviour not repeated below: if no credentials are loaded, the call returns a structured "unconfigured" error instead of contacting cPanel.

Jump to: [Auth and setup](#auth-and-setup) &middot; [Discovery and escape hatch](#discovery-and-escape-hatch) &middot; [Email](#email) &middot; [DNS](#dns) &middot; [Files](#files) &middot; [MySQL](#mysql) &middot; [FTP](#ftp) &middot; [Domains](#domains) &middot; [SSL](#ssl) &middot; [Cron](#cron) &middot; [Backups and account](#backups-and-account)

## Auth and setup

### `auth_delete_profile`

Delete a saved profile. Refuses to delete the active profile - switch first. Use cautiously; the on-disk credentials are removed immediately (no undo).

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `profile` | string | yes | Name of the saved profile to delete. Cannot be the active profile. |
| `confirm` | boolean | yes | Must be true. Guards against accidental deletion when a profile name is autocompleted. |

### `auth_list_profiles`

List all saved cPanel credential profiles with host/user/last-4-token, and which one is active.

Takes no parameters.

### `auth_open_token_page`

Return the URL of the cPanel API token management page for a given host (or the active profile's host), plus step-by-step instructions for generating a token. Does NOT open the browser automatically - that would be unreliable in headless / SSH sessions. Surface the URL to the user so they (or Claude) can open it.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `host` | string | no | cPanel host. If omitted, uses the host from the active profile. |
| `port` | number | no | cPanel HTTPS port (defaults to 2083 or the active profile's port). |

### `auth_rotate_token`

Atomically swap the API token for an existing profile. Re-uses the profile's stored host/port/user, validates the new token, and only writes if validation succeeds. Returns last-4 of the old and new tokens for confirmation. If the rotated profile is active, the in-memory client is updated immediately.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `api_key` | string | yes | New cPanel API token. |
| `profile` | string | no | Profile to rotate. Defaults to the active profile. |

### `auth_status`

Report whether cpanel-mcp is configured and where credentials are loaded from (process env vs ~/.config/cpanel-mcp/profiles/<active>.env). No network call. Use to diagnose unconfigured state or to confirm credential source before changing it.

Takes no parameters.

### `auth_switch_profile`

Switch the active cPanel profile. Reinstantiates the in-memory client immediately so subsequent tool calls use the new profile's host/user/token. Use `auth_list_profiles` first to see options.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `profile` | string | yes | Name of the profile to activate. |

### `auth_test`

Dry-run credential validation against cPanel UAPI without writing anything to disk. Use this to verify a host/user/token combination before committing it with `setup`. Returns the cPanel account info on success, or a structured error code (CPHULK_LOCKOUT, AUTH_FAILED, NETWORK_ERROR, etc.) on failure.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `host` | string | yes | cPanel hostname or IP. Do NOT include https:// or port. |
| `user` | string | yes | cPanel username to validate. |
| `api_key` | string | yes | cPanel API token to test. |
| `port` | number | no | Defaults to 2083. |
| `insecure_tls` | boolean | no | Skip TLS certificate verification. Only for a self-signed host you control. |

### `setup`

Interactive setup: validate and save cPanel credentials (host, username, API token). Writes ~/.config/cpanel-mcp/profiles/<profile>.env with mode 0600 (atomic temp+rename). To generate an API token, log into cPanel → Security → Manage API Tokens → Create. After success, ALL other cPanel tools become available immediately without restart. For try-before-save, use `auth_test` instead.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `host` | string | yes | cPanel hostname or IP. Example: "web2.siteocity.com" or "203.0.113.5". Do NOT include https:// or port. |
| `user` | string | yes | cPanel username. |
| `api_key` | string | yes | cPanel API token (created in cPanel → Security → Manage API Tokens). |
| `port` | number | no | cPanel HTTPS port. Defaults to 2083. |
| `insecure_tls` | boolean | no | Skip TLS cert verification. Only enable if your cPanel host uses a self-signed cert. |
| `profile` | string | no | Named profile to write under (default: "default"). Use distinct names for multi-account setups (e.g. "siteocity", "client-acme"). 1-64 chars of [a-zA-Z0-9_.-]. |
| `activate` | boolean | no | Switch the active profile to this one after writing. Defaults to true. Set false to save creds without making them active. |

### `whoami`

Return the configured cPanel host, port, user, and last-4 of the API token. No network call - for a live credential check call `auth_status`; for live account stats call `account_info`. Use this to verify which credentials are loaded.

Takes no parameters.

## Discovery and escape hatch

### `list_functions`

List known functions for a UAPI module. Static catalog - not exhaustive. For any module/function not listed, use uapi_call directly.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `module` | string | yes | UAPI module name, e.g. "Email", "DNS", "Mysql" |

### `list_modules`

List known cPanel UAPI modules with one-line descriptions. Static catalog - no network call. Use as a navigation aid before calling list_functions or uapi_call.

Takes no parameters.

### `uapi_call`

Universal cPanel UAPI escape hatch. Calls https://<host>:2083/execute/<module>/<function> with the given params and returns parsed JSON. Use this when no curated tool covers your need. Will throw on cPHulk lockout (CPHULK_LOCKOUT) or auth failure (AUTH_FAILED).

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `module` | string | yes | UAPI module, e.g. "Email" |
| `function` | string | yes | Function name on that module, e.g. "list_pops" |
| `params` | object | no | Query-string parameters |

## Email

### `email_add_account`

Create a new email account. Wraps Email::add_pop.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `email` | string | yes | Local part of the address (before @). |
| `domain` | string | yes | Domain part. |
| `password` | string | yes | Mailbox password. |
| `quota` | number | no | Mailbox quota in MB. If omitted, defaults to 250 MB. Pass 0 for unlimited. |

### `email_add_autoresponder`

Add or update an autoresponder for an email address. Wraps Email::add_auto_responder. Times use Unix epoch seconds; pass 0 for start/stop to mean "always on".

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `email` | string | yes | Full email address, e.g. "info@example.com". |
| `from` | string | yes | From-name shown to recipients. |
| `subject` | string | yes | Subject line of the auto-reply. |
| `body` | string | yes | Plain-text body. Use %subject% and %from% as placeholders. |
| `is_html` | boolean | no | Set true for HTML body. |
| `interval` | number | no | Hours between repeats to the same sender (default 0). |
| `start` | number | no | Unix epoch seconds when autoresponder activates. 0 = immediately. |
| `stop` | number | no | Unix epoch seconds when it deactivates. 0 = never. |
| `charset` | string | no | Default "utf-8". |

### `email_add_forwarder`

Add a forwarder that sends mail for one address to another. Wraps Email::add_forwarder.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `domain` | string | yes | Domain the mailbox belongs to, e.g. "example.com". |
| `email` | string | yes | Source address (local part). |
| `fwdemail` | string | yes | Destination email address. |

### `email_change_password`

Change an email account password. Wraps Email::passwd_pop.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `email` | string | yes | Mailbox local part, e.g. "info" for info@example.com. |
| `domain` | string | yes | Domain the mailbox belongs to, e.g. "example.com". |
| `password` | string | yes | New password. |

### `email_delete_account`

Delete an email account. Wraps Email::delete_pop.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `email` | string | yes | Local part of the address. |
| `domain` | string | yes | Domain part. |

### `email_delete_autoresponder`

Delete an autoresponder. Wraps Email::delete_auto_responder.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `email` | string | yes | Full email address whose autoresponder to remove. |

### `email_delete_filter`

Delete a mail filter by name. Wraps Email::delete_filter.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `filtername` | string | yes | Name of the filter to delete, as shown by email_list_filters. |
| `account` | string | no | Full email address; omit for account-level filter. |

### `email_delete_forwarder`

Delete an email forwarder. Wraps Email::delete_forwarder.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `address` | string | yes | The source address being forwarded, e.g. "info@example.com". |
| `forwarder` | string | yes | The destination address the forwarder sends to. |

### `email_get_disk_usage`

Return disk usage for one mailbox. Wraps Email::get_disk_usage.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `user` | string | yes | Local part of the mailbox. |
| `domain` | string | yes | Domain the mailbox belongs to, e.g. "example.com". |

### `email_list_accounts`

List all email accounts on this cPanel account. Wraps Email::list_pops_with_disk.

Takes no parameters.

### `email_list_autoresponders`

List autoresponders. Wraps Email::list_auto_responders.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `domain` | string | no | Optional domain filter. |

### `email_list_filters`

List mail filters for an email account (or account-level if no email). Wraps Email::list_filters.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `account` | string | no | Full email address. Omit for account-level filters. |

### `email_list_forwarders`

List email forwarders. Wraps Email::list_forwarders.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `domain` | string | no | Optional domain filter. |

## DNS

### `dns_add_record`

Add a DNS record. Uses ZoneEdit::add_zone_record (works on most cPanels). For complex/batch edits use uapi_call with DNS::mass_edit_zone.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `domain` | string | yes | Zone, e.g. "example.com". |
| `name` | string | yes | Record name (subdomain). Use "@" or the zone name itself for apex. |
| `type` | `A` \| `AAAA` \| `CNAME` \| `TXT` \| `MX` \| `SRV` \| `NS` \| `CAA` | yes | Record type. |
| `address` | string | yes | Record value (IP for A/AAAA, target hostname for CNAME/MX, text for TXT, etc.). |
| `ttl` | number | no | TTL in seconds. Defaults to 14400. |
| `priority` | number | no | MX/SRV priority. |

### `dns_edit_record`

Edit an existing DNS record by line number. Use dns_get_zone_records first to find the line. Wraps ZoneEdit::edit_zone_record.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `domain` | string | yes | Zone the record belongs to, e.g. "example.com". |
| `line` | number | yes | Line number of the record in the zone (from dns_get_zone_records). |
| `name` | string | no | New record name (subdomain). Omit to leave unchanged. |
| `type` | string | no | New record type, e.g. "A" or "CNAME". Omit to leave unchanged. |
| `address` | string | no | New record value. Omit to leave unchanged. |
| `ttl` | number | no | New TTL in seconds. Omit to leave unchanged. |

### `dns_get_zone_records`

Get DNS records for a zone. Wraps DNS::parse_zone.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `zone` | string | yes | Domain / zone name, e.g. "example.com". |

### `dns_list_zones`

List all DNS zones managed on this account. Wraps DomainInfo::list_domains for zone enumeration.

Takes no parameters.

### `dns_remove_record`

Remove a DNS record by line number. Wraps ZoneEdit::remove_zone_record.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `domain` | string | yes | Zone the record belongs to, e.g. "example.com". |
| `line` | number | yes | Line number of the record to remove. |

## Files

### `files_chmod`

Change permissions on files. Wraps API2 Fileman::fileop (op=chmod).

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `dir` | string | yes | Absolute directory containing the target files. |
| `files` | string or array of string | yes | Filename(s) within dir. |
| `permissions` | string | yes | Octal string, e.g. "0755" or "0644". |

### `files_compress`

Compress files into an archive. Wraps API2 Fileman::fileop (op=compress). Supported types: zip, tar, tar.gz (gz), tar.bz2 (bz2).

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `sources` | array of string | yes | Absolute paths to files/directories to include. |
| `destination` | string | yes | Absolute path to the archive to create. |
| `type` | `zip` \| `tar` \| `gz` \| `bz2` | yes | Archive type. |

### `files_copy`

Copy files. Wraps API2 Fileman::fileop (op=copy).

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `source_dir` | string | yes | Absolute directory the files currently live in. |
| `dest_dir` | string | yes | Absolute destination directory. Must already exist. |
| `files` | string or array of string | yes | Filename(s) within source_dir. |

### `files_create_directory`

Create a directory. Wraps Fileman::mkdir.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `path` | string | yes | Parent directory path. |
| `name` | string | yes | Name of the directory to create inside `path`. |
| `permissions` | string | no | Octal permissions, e.g. "0755". Defaults to cPanel's default. |

### `files_delete`

Delete one or more files or directories. Wraps API2 Fileman::fileop (op=unlink). DESTRUCTIVE - no undo, no trash. Targets must live under a non-system path.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `dir` | string | yes | Parent directory. |
| `files` | string or array of string | yes | Filename or array of filenames within `dir`. |
| `confirm` | boolean | yes | Must be true. Guards against accidental deletion. |

### `files_disk_usage`

Get disk quota info for the account. Wraps Quota::get_quota_info.

Takes no parameters.

### `files_extract`

Extract an archive. Wraps API2 Fileman::fileop (op=extract).

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `sources` | array of string | yes | Archive file(s) to extract. |
| `destination` | string | yes | Target directory. |

### `files_get_info`

Get stat info for a single file. Wraps Fileman::get_file_information.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `dir` | string | yes | Absolute directory path containing the file. |
| `file` | string | yes | File name within `dir`, not a full path. |

### `files_list_dir`

List directory contents. Wraps Fileman::list_files.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `dir` | string | yes | Absolute path, e.g. "/home/woobyava/public_html". |
| `show_hidden` | boolean | no | Include dotfiles. Defaults to false. |

### `files_move`

Move/rename files. Wraps API2 Fileman::fileop (op=move).

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `source_dir` | string | yes | Absolute directory the files currently live in. |
| `dest_dir` | string | yes | Absolute destination directory. Must already exist. |
| `files` | string or array of string | yes | Filename(s) within source_dir. |

### `files_read_file`

Read a small text file. Wraps Fileman::get_file_content. Do not use for binaries; UAPI returns the raw content inline.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `dir` | string | yes | Absolute directory path containing the file. |
| `file` | string | yes | File name within `dir`, not a full path. |

### `files_write_file`

Write text content to a file. Wraps Fileman::save_file_content (POST). Overwrites if the file exists, creates it otherwise. For binary data, base64-encode into a text representation first or use files_upload (not yet implemented).

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `dir` | string | yes | Absolute directory path, e.g. "/home/woobyava/public_html". |
| `file` | string | yes | Filename (no slashes). |
| `content` | string | yes | UTF-8 text content to write. |
| `from_charset` | string | no | Source charset, default "utf-8". |
| `to_charset` | string | no | Target charset, default "utf-8". |

## MySQL

### `mysql_change_user_password`

Change a MySQL user's password. Wraps Mysql::set_password.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `user` | string | yes | Full username including the cPanel prefix. |
| `password` | string | yes | New password. |

### `mysql_create_database`

Create a MySQL database. cPanel automatically prefixes the name with <cpanel_user>_. Wraps Mysql::create_database.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | string | yes | Database name (cPanel will prefix with your username). |

### `mysql_create_user`

Create a MySQL user. cPanel will prefix the name. Wraps Mysql::create_user.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | string | yes | User name without the cPanel prefix; cPanel prepends <cpanel_user>_. |
| `password` | string | yes | Password for the new user. Sent via POST so it stays out of the access log. |

### `mysql_delete_database`

Delete a MySQL database. DESTRUCTIVE - no undo. Pass the full name including the cPanel prefix. Wraps Mysql::delete_database.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | string | yes | Full database name including the cPanel user prefix. |
| `confirm` | boolean | yes | Must be true to acknowledge data loss. |

### `mysql_delete_user`

Delete a MySQL user. Wraps Mysql::delete_user.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | string | yes | Full username including the cPanel user prefix. |
| `confirm` | boolean | yes | Must be true. |

### `mysql_grant_privileges`

Grant privileges on a database to a user. Wraps Mysql::set_privileges_on_database.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `user` | string | yes | Full username including the cPanel prefix. |
| `database` | string | yes | Full database name including the cPanel prefix. |
| `privileges` | string | yes | Comma-separated MySQL privilege keywords WITHOUT the word "PRIVILEGES". For all privileges use "ALL" (not "ALL PRIVILEGES"). Examples: "ALL" or "SELECT,INSERT,UPDATE,DELETE". |

### `mysql_list_databases`

List all MySQL databases. Wraps Mysql::list_databases.

Takes no parameters.

### `mysql_list_users`

List all MySQL users. Wraps Mysql::list_users.

Takes no parameters.

### `mysql_rename_database`

Rename a MySQL database. DISRUPTIVE - every application connecting by the old name breaks until reconfigured. Wraps Mysql::rename_database.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `oldname` | string | yes | Current full database name (with cPanel prefix). |
| `newname` | string | yes | New full database name (with cPanel prefix). |
| `confirm` | boolean | yes | Must be true. Acknowledges that connecting apps must be reconfigured. |

### `mysql_revoke_privileges`

Revoke all privileges from a user on a specific database. Wraps Mysql::revoke_access_to_database.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `user` | string | yes | Full username (with prefix). |
| `database` | string | yes | Full database name (with prefix). |

## FTP

### `ftp_add`

Create an FTP account. Wraps Ftp::add_ftp. Note: cPanel scopes the username under the cPanel user (e.g. "uploader" becomes "uploader@<primary-domain>").

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `user` | string | yes | FTP username (local part). |
| `pass` | string | yes | FTP password. |
| `homedir` | string | yes | Absolute path to the FTP home directory. |
| `quota` | number | no | Quota in MB. 0 = unlimited. Default 0. |

### `ftp_change_password`

Change an FTP account password. Wraps Ftp::passwd.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `user` | string | yes | Full FTP username. |
| `pass` | string | yes | New password. |

### `ftp_change_quota`

Change an FTP account quota. Wraps Ftp::set_quota.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `user` | string | yes | Full FTP username. |
| `quota` | number | yes | Quota in MB. 0 = unlimited. |

### `ftp_delete`

Delete an FTP account. Wraps Ftp::delete_ftp.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `user` | string | yes | Full FTP username (typically "name@domain.tld"). |
| `destroy` | boolean | no | Set true to also remove the user's home directory. DESTRUCTIVE - defaults to false. |

### `ftp_list`

List FTP accounts. Wraps Ftp::list_ftp.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `include_acct_types` | string | no | Comma-separated account types to include (e.g. "sub,anonymous,main,logaccess"). Default: all. |

### `ftp_server_info`

Return FTP server-level info (port, SSL ports, etc.). Wraps Ftp::server_name + get_port.

Takes no parameters.

## Domains

### `addon_domain_add`

Add an addon domain. Wraps AddonDomain::add_addon_domain.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `newdomain` | string | yes | Addon domain name, e.g. "newsite.com". |
| `subdomain` | string | yes | Internal subdomain alias (cPanel always creates one). |
| `pass` | string | yes | FTP password for the co-located FTP account cPanel provisions for the addon. Required by UAPI. |
| `dir` | string | no | Document root. |

### `addon_domain_list`

List addon domains. Wraps AddonDomain::list_addon_domains.

Takes no parameters.

### `domains_list_all`

List main, parked, addon, and sub domains. Wraps DomainInfo::list_domains.

Takes no parameters.

### `subdomain_add`

Create a subdomain. Wraps SubDomain::add_subdomain.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `domain` | string | yes | Subdomain prefix, e.g. "blog". |
| `rootdomain` | string | yes | Parent domain, e.g. "example.com". |
| `dir` | string | no | Document root, relative to home. Defaults to public_html/<sub>. |

### `subdomain_list`

List subdomains. Wraps SubDomain::list_subdomains.

Takes no parameters.

### `subdomain_remove`

Delete a subdomain. Wraps SubDomain::delete_subdomain.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `domain` | string | yes | Full subdomain, e.g. "blog.example.com". |

## SSL

### `ssl_autossl_run`

Trigger an AutoSSL check for this account. Wraps AutoSSL::start_autossl_check.

Takes no parameters.

### `ssl_autossl_status`

Check whether an AutoSSL check is currently running, and list any problem domains. Wraps AutoSSL::is_autossl_check_in_progress + AutoSSL::get_autossl_problems.

Takes no parameters.

### `ssl_install_cert`

Install an SSL certificate on a domain. Wraps SSL::install_ssl.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `domain` | string | yes | Domain to install the certificate on, e.g. "example.com". |
| `cert` | string | yes | PEM-encoded certificate. |
| `key` | string | yes | PEM-encoded private key. |
| `cabundle` | string | no | PEM-encoded CA chain. |

### `ssl_list_certs`

List installed SSL certificates. Wraps SSL::list_ssl_certs.

Takes no parameters.

## Cron

### `cron_add`

Add a cron job. Wraps Cron::add_line. NOTE: shell metacharacters in `command` (e.g. $VAR, backticks, `~`) are passed verbatim to cron and interpolated by the shell at job-run time, not now.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `command` | string | yes | Shell command to run. |
| `minute` | string | no | Cron minute field. Default "*". |
| `hour` | string | no | Cron hour field (0-23). Default "*". |
| `day` | string | no | Cron day-of-month field (1-31). Default "*". |
| `month` | string | no | Cron month field (1-12). Default "*". |
| `weekday` | string | no | Cron day-of-week field (0-6, Sunday is 0). Default "*". |

### `cron_list`

List cron jobs. Wraps Cron::list_lines.

Takes no parameters.

### `cron_remove`

Remove a cron job by line number. Wraps Cron::remove_line.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `line` | number | yes | Line number from cron_list. |

## Backups and account

### `account_info`

Get this cPanel account's sidebar stats (disk, bandwidth, email count, etc.). Wraps Variables::get_user_information.

Takes no parameters.

### `backup_create_full`

Create a full backup written to the account home directory. Wraps Backup::fullbackup_to_homedir.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `email` | string | no | Email to notify when backup completes. |

### `backup_list`

List available backups. Wraps Backup::list_backups.

Takes no parameters.

---

Generated from `tools/list`. To regenerate after a schema change, see [Development]({{ site.baseurl }}/development/).

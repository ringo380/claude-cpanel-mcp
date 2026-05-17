/**
 * Static catalog of common UAPI modules and a sampling of their most-used
 * functions. NOT exhaustive — UAPI exposes 80+ modules. This list is a
 * navigation aid for `list_modules` and `list_functions`; users can always
 * call `uapi_call(module, function, params)` directly even for items not
 * listed here.
 *
 * Reference: https://api.docs.cpanel.net/openapi/cpanel-public/operations/
 */
export const MODULES = [
    {
        name: 'Email',
        description: 'Email accounts, forwarders, auto-responders, filters.',
        functions: [
            { name: 'list_pops', description: 'List all email accounts on the cPanel account.' },
            { name: 'list_pops_with_disk', description: 'List email accounts with disk usage.' },
            { name: 'add_pop', description: 'Create an email account. Params: email, password, quota, domain.' },
            { name: 'delete_pop', description: 'Delete an email account. Params: email, domain.' },
            { name: 'passwd_pop', description: 'Change email password. Params: email, password, domain.' },
            { name: 'edit_pop_quota', description: 'Change mailbox quota in MB. Params: email, domain, quota.' },
            { name: 'list_forwarders', description: 'List email forwarders.' },
            { name: 'add_forwarder', description: 'Add a forwarder. Params: domain, email, fwdopt, fwdemail.' },
            { name: 'delete_forwarder', description: 'Remove a forwarder. Params: address, forwarder.' },
            { name: 'list_auto_responders', description: 'List autoresponders.' },
            { name: 'add_auto_responder', description: 'Configure an autoresponder.' },
        ],
    },
    {
        name: 'DNS',
        description: 'DNS zone records (A, AAAA, CNAME, TXT, MX, SRV).',
        functions: [
            { name: 'parse_zone', description: 'Get all records for a zone. Params: zone.' },
            { name: 'mass_edit_zone', description: 'Atomically add/edit/remove zone records. Params: zone, serial, add, edit, remove.' },
        ],
    },
    {
        name: 'ZoneEdit',
        description: 'Legacy DNS editing API (still works on most cPanels).',
        functions: [
            { name: 'fetchzone_records', description: 'Fetch records of a given type. Params: domain, type.' },
            { name: 'add_zone_record', description: 'Add a DNS record. Params: domain, name, type, address, ttl.' },
            { name: 'edit_zone_record', description: 'Edit a DNS record. Params: domain, line, name, type, address, ttl.' },
            { name: 'remove_zone_record', description: 'Remove a record by line number. Params: domain, line.' },
        ],
    },
    {
        name: 'Fileman',
        description: 'Filesystem operations: list, read, write, compress, extract, chmod.',
        functions: [
            { name: 'list_files', description: 'List directory contents. Params: dir, show_hidden, types.' },
            { name: 'get_file_information', description: 'Stat a file. Params: dir, file.' },
            { name: 'get_file_content', description: 'Read a small file. Params: dir, file.' },
            { name: 'save_file_content', description: 'Write a file. Params: dir, file, content, charset.' },
        ],
    },
    {
        name: 'Mysql',
        description: 'MySQL databases, users, privileges.',
        functions: [
            { name: 'list_databases', description: 'List all MySQL databases.' },
            { name: 'list_users', description: 'List all MySQL users.' },
            { name: 'create_database', description: 'Create a database. Params: name.' },
            { name: 'delete_database', description: 'Delete a database. Params: name.' },
            { name: 'create_user', description: 'Create a MySQL user. Params: name, password.' },
            { name: 'delete_user', description: 'Delete a MySQL user. Params: name.' },
            { name: 'set_privileges_on_database', description: 'Grant privileges. Params: user, database, privileges.' },
        ],
    },
    {
        name: 'SubDomain',
        description: 'Subdomains.',
        functions: [
            { name: 'list_subdomains', description: 'List subdomains.' },
            { name: 'add_subdomain', description: 'Create a subdomain. Params: domain, rootdomain, dir.' },
            { name: 'delete_subdomain', description: 'Delete a subdomain. Params: domain.' },
        ],
    },
    {
        name: 'AddonDomain',
        description: 'Addon domains.',
        functions: [
            { name: 'list_addon_domains', description: 'List addon domains.' },
            { name: 'add_addon_domain', description: 'Add an addon domain. Params: newdomain, subdomain, dir, pass.' },
            { name: 'delete_addon_domain', description: 'Remove an addon domain. Params: domain, subdomain.' },
        ],
    },
    {
        name: 'DomainInfo',
        description: 'Domain inventory and document roots.',
        functions: [
            { name: 'list_domains', description: 'List main, parked, addon, sub domains.' },
            { name: 'domains_data', description: 'Detailed info for all domains.' },
        ],
    },
    {
        name: 'SSL',
        description: 'SSL certificates and installations.',
        functions: [
            { name: 'list_ssl_certs', description: 'List installed certs.' },
            { name: 'install_ssl', description: 'Install a cert. Params: domain, cert, key, cabundle.' },
            { name: 'delete_ssl', description: 'Remove a cert. Params: host.' },
        ],
    },
    {
        name: 'AutoSSL',
        description: 'AutoSSL provider configuration and status.',
        functions: [
            { name: 'is_autossl_check_in_progress', description: 'Is AutoSSL currently running.' },
            { name: 'start_autossl_check', description: 'Trigger an AutoSSL run.' },
            { name: 'get_autossl_problems', description: 'List domains AutoSSL cannot secure.' },
        ],
    },
    {
        name: 'Cron',
        description: 'Cron jobs.',
        functions: [
            { name: 'list_lines', description: 'List cron entries.' },
            { name: 'add_line', description: 'Add a cron job. Params: command, minute, hour, day, month, weekday.' },
            { name: 'remove_line', description: 'Remove a cron entry. Params: line.' },
        ],
    },
    {
        name: 'Backup',
        description: 'Full and partial backups.',
        functions: [
            { name: 'list_backups', description: 'List available backups.' },
            { name: 'fullbackup_to_homedir', description: 'Create a full backup. Params: email, server, etc.' },
        ],
    },
    {
        name: 'Ftp',
        description: 'FTP accounts.',
        functions: [
            { name: 'list_ftp', description: 'List FTP accounts.' },
            { name: 'add_ftp', description: 'Create FTP account. Params: user, pass, quota, homedir.' },
            { name: 'delete_ftp', description: 'Delete FTP account. Params: user.' },
            { name: 'passwd', description: 'Change FTP password. Params: user, pass.' },
        ],
    },
    {
        name: 'ResourceUsage',
        description: 'Disk, bandwidth, and process resource stats.',
        functions: [
            { name: 'get_usages', description: 'Get aggregate resource usage.' },
        ],
    },
    {
        name: 'StatsBar',
        description: 'cPanel sidebar statistics (disk, email accounts, etc.).',
        functions: [
            { name: 'get_stats', description: 'Fetch stat values. Params: display=<comma-separated keys>.' },
        ],
    },
    {
        name: 'Quota',
        description: 'Disk quota information.',
        functions: [{ name: 'get_quota_info', description: 'Get disk quota usage and limit.' }],
    },
    {
        name: 'Variables',
        description: 'cPanel session variables (whoami-style introspection).',
        functions: [{ name: 'get_user_information', description: 'Return current user metadata.' }],
    },
];
export const MODULE_MAP = new Map(MODULES.map((m) => [m.name.toLowerCase(), m]));
//# sourceMappingURL=modules-catalog.js.map
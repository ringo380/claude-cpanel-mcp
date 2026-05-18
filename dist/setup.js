#!/usr/bin/env node
/**
 * Standalone interactive setup CLI: `cpanel-mcp-setup`.
 * Prompts for host, user, API token, validates against UAPI, and writes
 * credentials to ~/.config/cpanel-mcp/.env (mode 0600).
 */
import readline from 'node:readline';
import { writeConfigFile, validateConfig, tokenManagementUrl, CONFIG_FILE } from './config.js';
function prompt(rl, question, silent = false) {
    return new Promise((resolve) => {
        if (!silent) {
            rl.question(question, (answer) => resolve(answer.trim()));
            return;
        }
        // Silent prompt for secrets.
        const out = process.stdout;
        out.write(question);
        const stdin = process.stdin;
        if (stdin.isTTY)
            stdin.setRawMode?.(true);
        let buf = '';
        const onData = (chunk) => {
            const s = chunk.toString('utf8');
            for (const ch of s) {
                if (ch === '\n' || ch === '\r') {
                    if (stdin.isTTY)
                        stdin.setRawMode?.(false);
                    stdin.removeListener('data', onData);
                    out.write('\n');
                    resolve(buf.trim());
                    return;
                }
                if (ch === '') {
                    // Ctrl-C
                    process.exit(130);
                }
                if (ch === '' || ch === '\b') {
                    buf = buf.slice(0, -1);
                }
                else {
                    buf += ch;
                }
            }
        };
        stdin.on('data', onData);
    });
}
async function main() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    /* eslint-disable no-console */
    console.log('cpanel-mcp setup');
    console.log('================');
    console.log('You will need:');
    console.log('  • Your cPanel hostname (e.g. web2.siteocity.com) or its IP');
    console.log('  • Your cPanel username');
    console.log('  • An API token (cPanel → Security → Manage API Tokens → Create)');
    console.log('');
    const hostRaw = await prompt(rl, 'cPanel host (no https://, no port): ');
    const host = hostRaw.replace(/^https?:\/\//, '').replace(/[:/].*$/, '');
    if (!host) {
        console.error('Host is required.');
        process.exit(1);
    }
    const portStr = await prompt(rl, 'Port [2083]: ');
    const port = portStr ? parseInt(portStr, 10) : 2083;
    const user = await prompt(rl, 'cPanel username: ');
    if (!user) {
        console.error('Username is required.');
        process.exit(1);
    }
    console.log('');
    console.log(`Generate / copy your API token from:`);
    console.log(`  ${tokenManagementUrl(host, port)}`);
    console.log('');
    const apiKey = await prompt(rl, 'API token (input hidden): ', true);
    if (!apiKey) {
        console.error('API token is required.');
        process.exit(1);
    }
    rl.close();
    console.log('');
    console.log(`Validating against https://${host}:${port}/execute/Variables/get_user_information ...`);
    const result = await validateConfig({ host, port, user, apiKey });
    if (!result.ok) {
        console.error('');
        console.error(`Validation failed: [${result.code}] ${result.message}`);
        console.error('Credentials NOT saved.');
        process.exit(1);
    }
    const path = writeConfigFile({
        CPANEL_HOST: host,
        CPANEL_PORT: String(port),
        CPANEL_USER: user,
        CPANEL_API_KEY: apiKey,
    });
    console.log('');
    console.log(`Saved to ${path} (mode 0600).`);
    console.log(`Authenticated as ${user} on ${host}:${port}.`);
    console.log('');
    console.log('Reconnect the MCP server in Claude Code (/mcp → reconnect cpanel-mcp), then');
    console.log('use any tool — e.g. `whoami`, `email_list_accounts`, `dns_list_zones`.');
    /* eslint-enable no-console */
}
main().catch((err) => {
    /* eslint-disable no-console */
    console.error(err);
    /* eslint-enable no-console */
    process.exit(1);
});
// Reference CONFIG_FILE so it isn't pruned by tree-shaking.
void CONFIG_FILE;

#!/bin/sh
# cpanel-mcp plugin launcher.
#
# Always runs the plugin's own bundled `dist/index.js` so that marketplace
# updates take effect immediately. (Earlier versions preferred a globally
# installed `cpanel-mcp` binary, but that silently masked plugin updates and
# made debugging much harder.) If `node_modules/` is missing on a fresh
# plugin clone, install production deps once before launching.
#
# Users who explicitly want the global binary can set CPANEL_MCP_USE_GLOBAL=1.
#
# All diagnostics go to stderr so they do not corrupt the stdio JSON-RPC
# channel that the MCP host reads from stdout.

set -u

: "${CLAUDE_PLUGIN_ROOT:=$(cd "$(dirname "$0")/../.." 2>/dev/null && pwd)}"

if [ "${CPANEL_MCP_USE_GLOBAL:-}" = "1" ] && command -v cpanel-mcp >/dev/null 2>&1; then
    echo "[cpanel-mcp] CPANEL_MCP_USE_GLOBAL=1, using global binary" 1>&2
    exec cpanel-mcp "$@"
fi

BUNDLED_ENTRY="${CLAUDE_PLUGIN_ROOT}/dist/index.js"

if [ ! -f "$BUNDLED_ENTRY" ]; then
    echo "[cpanel-mcp] dist/index.js not found at $BUNDLED_ENTRY" 1>&2
    echo "[cpanel-mcp] Plugin appears incomplete. Reinstall the plugin or run 'npm run build' in the plugin directory." 1>&2
    exit 127
fi

if [ ! -d "${CLAUDE_PLUGIN_ROOT}/node_modules" ]; then
    echo "[cpanel-mcp] First-run: installing production dependencies..." 1>&2
    (cd "$CLAUDE_PLUGIN_ROOT" && npm install --omit=dev --no-audit --no-fund --silent) 1>&2 || {
        echo "[cpanel-mcp] npm install failed. Ensure Node.js 18+ and npm are installed." 1>&2
        exit 1
    }
fi

if ! command -v node >/dev/null 2>&1; then
    echo "[cpanel-mcp] 'node' not found on PATH. Install Node.js 18+." 1>&2
    exit 127
fi

exec node "$BUNDLED_ENTRY" "$@"

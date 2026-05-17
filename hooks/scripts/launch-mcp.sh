#!/bin/sh
# cpanel-mcp plugin launcher.
#
# Strategy:
#   1. Prefer a globally installed `cpanel-mcp` binary if present.
#   2. Fall back to running the bundled `dist/index.js` inside this plugin.
#      If `node_modules/` is missing (fresh plugin clone), run a one-time
#      `npm install --omit=dev` before launching.
#
# All diagnostics go to stderr so they do not corrupt the stdio JSON-RPC
# channel that the MCP host reads from stdout.

set -u

: "${CLAUDE_PLUGIN_ROOT:=$(cd "$(dirname "$0")/../.." 2>/dev/null && pwd)}"

if command -v cpanel-mcp >/dev/null 2>&1; then
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

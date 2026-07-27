#!/bin/sh
# Fresh-install verification.
#
#   npm run test:install
#
# Exports the committed tree to a scratch directory, runs the plugin launcher
# against it exactly as a new user's machine would, and asserts the MCP server
# comes up and advertises the expected number of tools.
#
# Why this exists: every other check in the repo runs against a developer tree
# that already has node_modules. `npm test`, `npm run build`, and `npm run
# type-check` all pass on a machine where the toolchain is present - which is
# precisely the condition under which a production-install bug is invisible. One
# such bug (the `prepare` hook running `npm run build`, which cannot work under
# `--omit=dev`) shipped from 0.1.0 through 0.4.2 and stopped the plugin from
# starting at all. See scripts/prepare.js.
#
# Deliberately NOT a GitHub Actions workflow: this repo has no workflows, a solo
# repo gains nothing from running this on every push, and verification should be
# runnable from one local command. Run it before tagging a release.
#
# Deliberately NOT part of `npm test`: a real install takes tens of seconds and
# the unit suite should stay fast.
#
# Makes no cPanel contact: the server is launched with empty CPANEL_* values, so
# it cannot authenticate and cannot trip cPHulk. The tool list is static, so an
# unconfigured server still advertises every tool.

set -u

REPO=$(cd "$(dirname "$0")/.." && pwd)
cd "$REPO" || exit 1

# Expected tool count. Asserted exactly, not merely as "greater than zero" - a
# wrong-but-nonzero count is exactly the failure a loose assertion waves through.
# Update deliberately when tools are added or removed.
EXPECTED_TOOLS=${EXPECTED_TOOLS:-74}

TMP=""
cleanup() {
    # Guarded: ${TMP:?} aborts at expansion time if TMP is empty or unset, so
    # this can never become `rm -rf /`.
    [ -n "$TMP" ] && rm -rf "${TMP:?}"
}
trap cleanup EXIT INT TERM

echo "== fresh-install verification =="

# --- Preconditions ----------------------------------------------------------

command -v node >/dev/null 2>&1 || { echo "FAIL: node not on PATH"; exit 1; }
command -v npm  >/dev/null 2>&1 || { echo "FAIL: npm not on PATH";  exit 1; }

# The install needs the npm registry. Skip rather than fail when it is
# unreachable - a check that fails on a train is a check that gets disabled.
if ! npm ping >/dev/null 2>&1; then
    echo "SKIP: npm registry unreachable, cannot verify a fresh install."
    echo "      Re-run when online. This is a skip, not a pass."
    exit 0
fi

# --- Export the committed tree ---------------------------------------------

TMP=$(mktemp -d) || { echo "FAIL: mktemp"; exit 1; }

# git archive rather than copying the working tree: this tests exactly what a
# tag ships, and it cannot accidentally inherit a local node_modules or any
# uncommitted edit.
if ! git archive HEAD | tar -x -C "$TMP"; then
    echo "FAIL: could not export HEAD"
    exit 1
fi

# Precondition: confirm the export really is uninstalled, otherwise the whole
# check is vacuous - it would be re-testing a developer tree under a new name.
if [ -d "$TMP/node_modules" ]; then
    echo "FAIL: exported tree already has node_modules - nothing would be verified"
    exit 1
fi
if [ ! -f "$TMP/dist/index.js" ]; then
    echo "FAIL: exported tree has no dist/index.js - is dist/ committed?"
    exit 1
fi

echo "exported HEAD to $TMP (no node_modules, dist/ present)"

# --- Run the launcher exactly as a new user's machine would -----------------

echo "running launcher (first-run npm install + stdio probe)..."
COUNT=$(node "$REPO/scripts/probe-launcher.mjs" "$TMP")
RC=$?

case "$RC" in
    0) ;;
    3) echo "FAIL: launcher exited non-zero - the plugin would not start on a fresh install"; exit 1 ;;
    4) echo "FAIL: launcher started but never answered tools/list"; exit 1 ;;
    *) echo "FAIL: probe error (rc=$RC)"; exit 1 ;;
esac

if [ ! -d "$TMP/node_modules" ]; then
    echo "FAIL: launcher succeeded but installed no node_modules - probe did not exercise the install"
    exit 1
fi

if [ "$COUNT" != "$EXPECTED_TOOLS" ]; then
    echo "FAIL: server advertised $COUNT tools, expected $EXPECTED_TOOLS"
    echo "      If this change is intended, update EXPECTED_TOOLS in $0."
    exit 1
fi

echo "PASS: fresh install launched and advertised $COUNT tools"
exit 0

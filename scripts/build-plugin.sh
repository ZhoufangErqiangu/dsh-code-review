#!/usr/bin/env bash
# Install locked dependencies, then typecheck, compile, and test the plugin.
#
# The build is what the .deb ships, so it always starts from `npm ci` rather
# than trusting an existing node_modules. dist/ is committed on purpose: the
# Harness loads the compiled entry directly, and CI compares the regenerated
# tree with the committed one.

set -euo pipefail
# shellcheck source=common.sh
. "$(dirname "${BASH_SOURCE[0]}")/common.sh"

NODE="$(node_bin)"
[ -n "$NODE" ] || die "Node.js not found. Install Node >= $NODE_MIN or set DSH_NODE."
check_node_version
require_cmd npm "npm is required to install dependencies"
init_version

cd "$ROOT"

log "installing locked dependencies (npm ci)"
npm ci --no-audit --no-fund

log "typechecking"
npm run typecheck

log "building and running the unit tests"
npm test

[ -f "$ROOT/dist/index.js" ] || die "the build did not produce dist/index.js"
[ -f "$ROOT/dist/index.d.ts" ] || die "the build did not produce dist/index.d.ts"

# The Host API is imported type-only. A runtime import would make the package
# depend on how the Host resolves its own node_modules, which differs between
# an npm install, a source checkout, and the Desktop ASAR.
log "checking that the compiled entry has no Host runtime imports"
if grep -rE "from ['\"]@deepseek-ai|require\(['\"]@deepseek-ai" "$ROOT/dist" --include='*.js'; then
  die "compiled output imports @deepseek-ai at runtime"
fi

log "${C_GREEN}build complete${C_RESET}: plugin $PLUGIN_VERSION, Node $("$NODE" -p 'process.versions.node')"

#!/usr/bin/env bash
# Install locked dependencies and bundle the plugin into lib/.
#
# Building is deliberately separate from testing and packaging: this step only
# produces lib/, and `scripts/test-plugin.sh` consumes that output. The build is
# what the .deb ships, so it always starts from `npm ci` rather than trusting an
# existing node_modules. lib/ is generated, git-ignored build output: CI and the
# .deb pipeline run this step, and no compiled tree is committed.

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

log "bundling into lib/"
npm run build

[ -f "$ROOT/lib/index.js" ] || die "the build did not produce lib/index.js"
[ -f "$ROOT/lib/index.d.ts" ] || die "the build did not produce lib/index.d.ts"
[ -f "$ROOT/lib/client.js" ] || die "the build did not produce lib/client.js"

# The Host API is imported type-only, with one exception: the Web settings
# card needs a real Config schema, so @deepseek-ai/schemastery is a runtime
# dependency. The package declares it, an npm install provides it, and the
# .deb stages it beside the plugin. Every other Host import would make the
# package depend on how the Host resolves its own node_modules, which differs
# between an npm install, a source checkout, and the Desktop ASAR.
log "checking that the compiled entry has no Host runtime imports besides schemastery"
if grep -rE "from ['\"]@deepseek-ai|require\(['\"]@deepseek-ai" "$ROOT/lib" --include='*.js' \
    | grep -v "'@deepseek-ai/schemastery'\|\"@deepseek-ai/schemastery\""; then
  die "compiled output imports an unexpected @deepseek-ai package at runtime"
fi

log "${C_GREEN}build complete${C_RESET}: plugin $PLUGIN_VERSION, Node $("$NODE" -p 'process.versions.node')"

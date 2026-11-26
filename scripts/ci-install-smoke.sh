#!/usr/bin/env bash
# CI-only check for an *installed* dsh-code-review package.
#
# The package installs files only, so this script verifies the installed
# layout, ownership, integrity, and the entry's module contract. When a
# DeepSeek Harness (dsh) is on PATH, it additionally composes a throwaway
# profile against the installed package root and asserts that the bundle is
# selected rather than skipped.

set -euo pipefail

PKG=dsh-code-review
PLUGIN_NAME='@local/dsh-code-review'
DIR=/usr/lib/dsh/plugins/code-review
DOC=/usr/share/doc/dsh-code-review

fail() { printf '[FAIL] %s\n' "$*" >&2; exit 1; }
pass() { printf '[ok] %s\n' "$*"; }
note() { printf '[info] %s\n' "$*"; }

command -v dpkg-query >/dev/null 2>&1 || fail "dpkg-query is not available"
dpkg-query -W -f='${Status}' "$PKG" 2>/dev/null | grep -q 'install ok installed' \
  || fail "$PKG is not installed"
version="$(dpkg-query -W -f='${Version}' "$PKG")"
pass "$PKG $version is installed"

for file in \
  package.json cordis.patch.yml README.md LICENSE icon.svg \
  locale/en.json locale/zh.json \
  dist/index.js dist/index.d.ts \
  dist/src/command.js dist/src/tool.js dist/scripts/dry-run.js; do
  [ -f "$DIR/$file" ] || fail "missing $DIR/$file"
done
[ ! -e "$DIR/dist/tests" ] || fail "compiled tests were installed"
[ ! -e "$DIR/node_modules" ] || fail "node_modules was installed"
[ ! -e "$DIR/src" ] || fail "TypeScript sources were installed"
[ -f "$DOC/LICENSE" ] || fail "missing $DOC/LICENSE"
[ -f "$DOC/README.Debian.gz" ] || fail "missing $DOC/README.Debian.gz"
[ -f "$DOC/BUILD-INFO.json" ] || fail "missing $DOC/BUILD-INFO.json"
pass "installed layout ($DIR + documentation)"

owner="$(stat -c '%U:%G' "$DIR/package.json")"
[ "$owner" = "root:root" ] || fail "package files are owned by $owner, expected root:root"
for path in "$DIR" "$DIR/dist" "$DIR/dist/index.js" "$DOC" "$DOC/BUILD-INFO.json"; do
  owner="$(stat -c '%U:%G' "$path")"
  [ "$owner" = "root:root" ] || fail "$path is owned by $owner, expected root:root"
done
pass "files are owned by root:root"

# dpkg --verify compares the payload with the package's md5sums database.
if ! verify_output="$(dpkg --verify "$PKG" 2>&1)"; then
  printf '%s\n' "$verify_output" >&2
  fail "dpkg --verify reported a modified installed file"
fi
[ -z "$verify_output" ] || { printf '%s\n' "$verify_output" >&2; fail "dpkg --verify reported changes"; }
pass "dpkg --verify: installed files match the package"

info_version="$(node -p "require('$DOC/BUILD-INFO.json').version")"
manifest_version="$(node -p "require('$DIR/package.json').version")"
[ "$info_version" = "$version" ] || fail "BUILD-INFO version $info_version does not match dpkg version $version"
[ "$(node -p "require('$DOC/BUILD-INFO.json').plugin.version")" = "$manifest_version" ] \
  || fail "BUILD-INFO plugin version does not match package.json"
[ "$(node -p "require('$DIR/package.json').name")" = "$PLUGIN_NAME" ] \
  || fail "installed package name is not $PLUGIN_NAME"
[ "$(node -p "require('$DIR/package.json').license")" = "MIT" ] \
  || fail "installed package is not declared MIT"
pass "installed version $version matches BUILD-INFO.json and package.json"

node --input-type=module -e '
  import { pathToFileURL } from "node:url"
  const mod = await import(pathToFileURL(process.argv[1]).href)
  if (mod.name !== "code-review") throw new Error(`name is ${String(mod.name)}`)
  if (typeof mod.apply !== "function") throw new Error("apply is not exported")
  if (!Array.isArray(mod.inject) || !mod.inject.includes("commands")) throw new Error("inject is not the Host contract")
' "$DIR/dist/index.js" || fail "the installed entry does not load"
pass "installed entry loads with Node $(node -p 'process.versions.node')"

# Optional end-to-end composition: the installed package root is linked into a
# temporary profile exactly as `dsh plugin add` would, without running pnpm.
if command -v dsh >/dev/null 2>&1 && dsh --version >/dev/null 2>&1; then
  home="$(mktemp -d)"
  trap 'rm -rf "$home"' EXIT
  profile="$home/profiles/verify"
  mkdir -p "$profile/node_modules/@local"
  ln -s "$DIR" "$profile/node_modules/@local/dsh-code-review"
  cat > "$profile/package.json" <<EOF
{
  "name": "dsh-profile-verify",
  "private": true,
  "dependencies": { "$PLUGIN_NAME": "link:$DIR" },
  "dsh": { "profile": { "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "$PLUGIN_NAME"] } }
}
EOF
  if ! DSH_HOME="$home" dsh --profile verify --dump-config > "$home/dump.yml" 2> "$home/dump.err"; then
    cat "$home/dump.err" >&2
    fail "dsh could not compose a profile with the installed plugin"
  fi
  if grep -q "skipping profile bundle" "$home/dump.err"; then
    cat "$home/dump.err" >&2
    fail "dsh skipped the installed plugin"
  fi
  grep -q "id: code-review" "$home/dump.yml" || fail "composed profile has no code-review row"
  grep -Fq "name: '$PLUGIN_NAME'" "$home/dump.yml" || fail "composed profile does not name $PLUGIN_NAME"
  pass "dsh $(dsh --version) composes the installed plugin into a web profile"
else
  note "dsh is not on PATH; skipping the end-to-end composition check"
fi

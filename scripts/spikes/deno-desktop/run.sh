#!/usr/bin/env bash
# Spike orchestrator — herocast on the Deno desktop runtime. Throwaway (see ./README.md).
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
warn() { printf '\033[33m%s\033[0m\n' "$1"; }

bold "herocast × Deno desktop runtime — spike"
echo "  docs/migration/desktop-deno-runtime.md"
echo

# --- prerequisite: Deno >= 2.9 (canary) -------------------------------------------------
if ! command -v deno >/dev/null 2>&1; then
  warn "Deno is not installed. Install it, then: deno upgrade canary"
  echo "  https://docs.deno.com/runtime/desktop/"
  exit 127
fi

VERSION="$(deno --version | head -n1 | awk '{print $2}')"
echo "  deno $VERSION"
# Require >= 2.9.0 (deno desktop landed in 2.9.0, canary).
if [ "$(printf '%s\n2.9.0\n' "$VERSION" | sort -V | head -n1)" != "2.9.0" ]; then
  warn "  deno >= 2.9.0 required for 'deno desktop'. Run: deno upgrade canary"
  exit 1
fi
echo

# --- Stage 1: native window smoke (needs a display) ------------------------------------
bold "Stage 1 — deno desktop window smoke"
if [ -z "${DISPLAY:-}" ] && [ "$(uname)" != "Darwin" ] && [ -z "${WAYLAND_DISPLAY:-}" ]; then
  warn "  no display detected (headless/CI/SSH) — skipping. Run locally to verify the window."
else
  echo "  opening a native window — close it to continue..."
  deno desktop "$DIR/hello.ts" || warn "  Stage 1 did not complete (see output above)."
fi
echo

# --- Stage 2: seam fall-through (headless) ---------------------------------------------
bold "Stage 2 — host-seam fall-through on Deno"
HEROCAST_SPIKE_ENV=ok deno run --allow-env "$DIR/seam-fallthrough.ts"

echo
bold "Done. Record findings in docs/migration/desktop-deno-runtime.md, then delete this dir."
echo "  Stage 3 (full app under deno desktop) needs a TARGET=deno build — see README."

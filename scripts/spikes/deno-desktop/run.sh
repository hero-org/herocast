#!/usr/bin/env bash
# Spike orchestrator — herocast on the Deno desktop runtime. Throwaway (see ./README.md).
#
# Default run is headless + cheap: prerequisite check + Stage 2 (seam fall-through).
# Stage 1 (the actual `deno desktop` build) is OPT-IN via `--build` because on Linux it
# downloads a ~1.5 GB CEF/Chromium backend and emits a ~1.7 GB app bundle (measured on
# canary aa90115, 2026-06-23). Pass `--build` only when you mean it.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DO_BUILD=0
[ "${1:-}" = "--build" ] && DO_BUILD=1

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
warn() { printf '\033[33m%s\033[0m\n' "$1"; }

bold "herocast × Deno desktop runtime — spike"
echo "  docs/migration/desktop-deno-runtime.md"
echo

# --- prerequisite: Deno present --------------------------------------------------------
if ! command -v deno >/dev/null 2>&1; then
  warn "Deno is not installed.  curl -fsSL https://deno.land/install.sh | sh"
  echo "  Then, for Stage 1 (deno desktop): deno upgrade canary"
  exit 127
fi
echo "  $(deno --version | head -n1)"
echo

# --- Stage 2 (headless, runs on ANY recent Deno — no canary needed) --------------------
bold "Stage 2 — host-seam fall-through on Deno"
HEROCAST_SPIKE_ENV=ok deno run --allow-env "$DIR/seam-fallthrough.ts"
echo

# --- Stage 1 (opt-in: the real deno desktop build — heavy) -----------------------------
bold "Stage 1 — deno desktop build smoke"
if [ "$DO_BUILD" -ne 1 ]; then
  warn "  skipped (cheap default). Re-run with --build to compile the bundle."
  echo "  Heads-up: downloads a ~1.5 GB CEF backend on Linux; emits a ~1.7 GB app dir."
elif ! deno desktop --help >/dev/null 2>&1; then
  # NB: the 'deno desktop' subcommand is the real capability gate — NOT a version number.
  # The canary that ships it still reports '2.8.3+<hash>', so a numeric >=2.9.0 check is wrong.
  warn "  'deno desktop' subcommand not found — run: deno upgrade canary"
else
  echo "  building (this downloads CEF + emits ./hello — cleaned up after)..."
  ( cd "$DIR" && deno desktop hello.ts ) && bold "  Stage 1 PASS — compiled a desktop bundle." \
    || warn "  Stage 1 build did not complete (see output above)."
  echo "  (Launching the window needs a display; this container is headless.)"
  rm -rf "$DIR/hello" "$DIR/hello.so"
fi

echo
bold "Done. Record findings in docs/migration/desktop-deno-runtime.md, then delete this dir."
echo "  Stage 3 (full app under deno desktop) needs a TARGET=deno build — see README."

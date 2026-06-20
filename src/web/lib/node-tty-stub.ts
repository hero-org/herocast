// Benign stub for the `node:tty` builtin, which workerd does NOT provide (even under
// nodejs_compat). The Neynar SDK's transitive dep chain (axios → follow-redirects →
// debug → supports-color) calls `tty.isatty(fd)` AT MODULE LOAD to decide terminal
// color. Unstubbed, the worker fails to initialize with `No such module "node:tty"` and
// EVERY route 500s (the route tree imports the SDK eagerly at worker init). Returning
// `isatty() === false` means "not a TTY → no ANSI color", which is the correct answer on
// the edge and keeps the dep chain purely cosmetic.
//
// Aliased ONLY in the `ssr`/workerd environment via the resolveId plugin in
// vite.config.mts — the client build never imports node:tty. Mirrors the
// cloudflare:workers / ssr-client-only stubs.
export function isatty(): boolean {
  return false;
}

// Some consumers reference these classes; harmless empty shims (never instantiated on
// the edge because isatty() is false).
export class ReadStream {}
export class WriteStream {}

export default { isatty, ReadStream, WriteStream };

// Unit #5 (#754 app shell) — workerd-bundle stand-in for component modules that are
// loaded ONLY through the next/dynamic shim with `ssr:false` (WalletProviders →
// rainbowkit/wagmi + its locale/OS chunks; NewCastModal → NewCastEditor → TipTap).
//
// With `ssr:false` the shim never invokes the lazy loader on the server, so these
// chunks are pure dead weight in the worker — yet Rollup still emits them (a dynamic
// import is statically analyzable), which pushed the worker past the 3 MB gzip limit
// (3152 KiB at this unit). `vite.config.mts` aliases the two module specifiers to this
// stub in the CF build's `ssr` environment ONLY; the client bundle keeps the real
// modules and code-splits them as before.
//
// Throwing default export: if a future unit ever renders one of these during SSR
// (e.g. by importing it statically into a server-rendered page), fail loudly instead
// of silently rendering nothing — that unit must then remove its specifier from the
// ssr alias list and re-check the bundle size.
export default function SsrClientOnlyStub(): never {
  throw new Error(
    'ssr-client-only-stub: this module is aliased out of the workerd bundle (vite.config.mts ssr alias list) ' +
      'and must never render during SSR. Load it via the next/dynamic shim with `ssr: false`.'
  );
}

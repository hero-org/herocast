// Spike Stage 1 — toolchain smoke. Throwaway (see ./README.md).
//
// Proves `deno desktop` can boot the OS-native webview and open a window. This is the
// minimal shape from https://docs.deno.com/runtime/desktop/ — a plain `Deno.serve`
// handler that `deno desktop` wraps in a native window.
//
// Run via the orchestrator: `./scripts/spikes/deno-desktop/run.sh`
// Or directly (needs Deno >= 2.9 canary):  `deno desktop scripts/spikes/deno-desktop/hello.ts`

Deno.serve(
  () =>
    new Response(
      `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>herocast — deno desktop spike</title>
    <style>
      body { font: 16px system-ui, sans-serif; margin: 0; height: 100vh; display: grid;
             place-items: center; background: #0b0b0c; color: #e8e8ea; }
      .ok { color: #34d399; }
    </style>
  </head>
  <body>
    <main>
      <h1>herocast</h1>
      <p class="ok">deno desktop window is live.</p>
      <p>Stage 1 PASS — native webview boots. Close this window to continue.</p>
    </main>
  </body>
</html>`,
      { headers: { 'content-type': 'text/html' } }
    )
);

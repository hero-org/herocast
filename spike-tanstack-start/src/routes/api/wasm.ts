// ── Phase 0.5a: embeds/metadata WASM probe ───────────────────────────────────
// app/api/embeds/metadata/route.ts loads @officialunofficial/trek's WASM via
// readFileSync(...trek_rs_bg.wasm) + initSync({ module: buffer }). That `fs` read
// can't work on workerd. The workerd-native fix is to IMPORT the .wasm as a Workers
// module (precompiled at deploy) and pass it to initSync — proven here.
import { createFileRoute } from '@tanstack/react-router';
import * as trek from '@officialunofficial/trek';
// Cloudflare Workers: a .wasm import is a precompiled WebAssembly.Module.
import trekWasm from '@officialunofficial/trek/trek_rs_bg.wasm';

// Instantiate once per isolate at module scope. workerd compiled the imported .wasm
// at deploy time, so initSync just does `new WebAssembly.Instance(module)` (sync,
// allowed). No top-level await, no per-request branch.
trek.initSync({ module: trekWasm });

const SAMPLE_HTML = `<!doctype html><html><head>
<title>Plain Title</title>
<meta property="og:title" content="Spike OG Title — Trek on workerd">
<meta property="og:description" content="OpenGraph description parsed by the trek Rust/WASM module running on Cloudflare Workers.">
<meta property="og:image" content="https://example.com/preview.png">
</head><body><article><h1>Heading</h1><p>Body paragraph for the readability parse.</p></article></body></html>`;

export const Route = createFileRoute('/api/wasm')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const target = new URL(request.url).searchParams.get('url');
        try {
          let html = SAMPLE_HTML;
          let source = 'sample-html';
          if (target) {
            const r = await fetch(target, {
              headers: { 'user-agent': 'HerocastBot/1.0 (+https://herocast.xyz)' },
              signal: AbortSignal.timeout(5000),
            });
            if (r.ok) {
              html = await r.text();
              source = target;
            }
          }

          const t1 = Date.now();
          const parser = new trek.TrekWasm({
            url: target || 'https://spike.local',
            debug: false,
            markdown: false,
            separateMarkdown: false,
            removeExactSelectors: true,
            removePartialSelectors: true,
          });
          const result: any = parser.parse(html);
          const parseMs = Date.now() - t1;

          // trek 0.2.1 flattens TrekMetadata to the result ROOT (serde flatten) —
          // there is no result.metadata. Fields are top-level camelCase.
          return Response.json({
            ok: true,
            runtime: (globalThis as any).navigator?.userAgent ?? null,
            // Proves the import gave a real precompiled module, not bytes/URL.
            wasmIsModule: (trekWasm as any) instanceof WebAssembly.Module,
            parseMs,
            htmlBytes: html.length,
            source,
            title: result?.title ?? null,
            description: result?.description ?? null,
            image: result?.image ?? null,
            favicon: result?.favicon ?? null,
          });
        } catch (e: any) {
          return Response.json(
            { ok: false, error: String(e?.stack || e?.message || e).slice(0, 1500) },
            { status: 200 }
          );
        }
      },
    },
  },
});

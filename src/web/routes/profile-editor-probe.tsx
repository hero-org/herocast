// THROWAWAY / INTERNAL — unit #8 (#754 editor + embeds) probe. Deleted at/before cutover.
//
// Mounts NewCastEditor (the TipTap composer) on a real route so the editor can be exercised
// in a real browser. The integrated production path — titlebar "Cast" action / cmd+k →
// NewCastModal → the same dynamic-shim editor — is identical but only reachable while logged
// in. This probe isolates the editor itself for the cf-canary check.
//
// PATH PREFIX IS DELIBERATE: AuthContext (in the __root <Providers>, so it wraps EVERY route)
// client-redirects logged-out users to /login on any path that does NOT start with /profile,
// /conversation, or /analytics (see src/common/context/AuthContext.tsx). Mounting at
// /profile-editor-probe rides the `/profile` allowlist `startsWith` so the editor renders
// WITHOUT a Supabase session — it does not collide with the real /profile or /profile/$slug
// routes (those are `_app` children needing a `/` segment). AuthContext is a shared live-app
// file and must NOT be edited to allowlist a probe; riding the existing prefix is the
// no-shared-edit way in.
//
// It loads the editor through the SAME `next/dynamic` shim (`ssr: false`) NewCastModal uses,
// so the chunk stays client-only and is stubbed out of the workerd bundle by the
// `ssrClientOnlyModules` regex in vite.config.mts — exactly as in production. (Verified: the
// worker bundle carries ZERO TipTap/ProseMirror; the editor lives only in the client chunk
// `dist/client/assets/NewCastEditor-*.js`.)
//
// What it proves on the client (real browser; cf-canary QA + evidence in phase-2-editor.md):
//   - TipTap mounts with no console errors (React 19 + @tiptap/react v3 interactive QA).
//   - compose: typing updates the draft (controlled `onContentChange` → updateDraftById).
//   - @-mention dropdown  → getProvider().searchUsers()  → /api/users/search   (unit #10).
//   - /channel dropdown   → getProvider().searchChannels()→ /api/channels/search (unit #10).
//   - image/video upload  → useCloudinaryUpload (direct client POST to api.cloudinary.com,
//     using the NEXT_PUBLIC_CLOUDINARY_* keys inlined by the vite `define` allowlist).
//   - embeds: image embeds render inline; auto-detected URLs render the EmbedsEditor card
//     (OpenGraphImage degrades gracefully to the plain UrlEmbed card while /api/embeds/metadata
//     is unported — that route is trek-WASM-coupled and owned by unit #11).
//
// Publishing a cast is intentionally out of scope here: it needs an active account + a
// registered Farcaster signer (the write path), which lands with unit #9 (auth/accounts).
//
// Filename has NO leading underscore — a leading `_` is TanStack's pathless/layout-route
// convention. Mounts at /profile-editor-probe. Enumerated for the #13 probe sweep alongside
// stores-probe / nav-probe / providers-probe / migration-probe / _app.shell-probe.
import { createFileRoute } from '@tanstack/react-router';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { Loading } from '@/common/components/Loading';
import { useDraftStore } from '@/stores/useDraftStore';

// Same load path as NewCastModal: the client-only editor chunk via the ssr:false shim.
const NewPostEntry = dynamic(() => import('@/common/components/Editor/NewCastEditor'), {
  loading: () => <Loading loadingMessage="Loading editor" />,
  ssr: false,
});

export const Route = createFileRoute('/profile-editor-probe')({
  component: EditorProbe,
});

function EditorProbe() {
  const [draftId, setDraftId] = useState<string | undefined>(undefined);

  // Seed a real writing-status draft on the client so the editor's updateDraftById / embed-sync
  // effects round-trip through the live store (never during SSR — the editor is ssr:false).
  useEffect(() => {
    useDraftStore.getState().addNewPostDraft({
      force: true,
      onSuccess: (id) => setDraftId(id),
    });
  }, []);

  const draft = useDraftStore((s) => s.drafts.find((d) => d.id === draftId));

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 24, lineHeight: 1.5 }}>
      <h1>editor probe</h1>
      <p>
        <small>
          Internal / throwaway (unit #8). NewCastEditor mounted via the same next/dynamic <code>ssr:false</code> shim
          production uses. Compose, @-mention, /channel, image upload, and embeds should all work on the client; publish
          needs a signer (unit #9).
        </small>
      </p>
      <div
        style={{
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: 8,
          marginTop: 12,
        }}
      >
        {draft ? <NewPostEntry draft={draft} /> : <Loading loadingMessage="Seeding draft…" />}
      </div>
    </main>
  );
}

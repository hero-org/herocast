/**
 * @jest-environment jsdom
 */

// This test depends on the parallel decomposition agent's output:
//   - src/common/components/CastRow/StandardCastRow.tsx
//   - src/common/components/CastRow.tsx re-exporting StandardCastRow as { CastRow }
// If those files don't exist yet, this test will fail — that's the regression gate.

import { describe, expect, it, jest } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render } from '@testing-library/react';
import type React from 'react';

// jsdom doesn't ship ResizeObserver; CastRow uses it for truncation detection.
class ResizeObserverPolyfill {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(global as unknown as { ResizeObserver: typeof ResizeObserverPolyfill }).ResizeObserver = ResizeObserverPolyfill;

// ── Mocks (must come before importing the components under test) ─────────

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

const setSelectedChannelByName = jest.fn();
const setSelectedChannelUrl = jest.fn();

const accountStoreState = {
  accounts: [
    {
      id: 'test-account-id',
      platform: 'farcaster',
      platformAccountId: '999',
      name: 'tester',
      status: 'active',
      user: { fid: 999, username: 'tester' },
    },
  ],
  selectedAccountIdx: 0,
  setSelectedChannelByName,
  setSelectedChannelUrl,
};

jest.mock('@/stores/useAccountStore', () => {
  const useAccountStore: any = jest.fn(() => accountStoreState);
  useAccountStore.getState = () => accountStoreState;
  useAccountStore.setState = jest.fn();
  return { useAccountStore };
});

const navigationStoreState = {
  setCastModalDraftId: jest.fn(),
  setCastModalView: jest.fn(),
  openNewCastModal: jest.fn(),
  updateSelectedCast: jest.fn(),
};

jest.mock('@/stores/useNavigationStore', () => ({
  CastModalView: { New: 'new', Reply: 'reply', Quote: 'quote' },
  useNavigationStore: jest.fn(() => navigationStoreState),
}));

jest.mock('@/stores/useDraftStore', () => ({
  useDraftStore: jest.fn(() => ({ addNewPostDraft: jest.fn() })),
}));

jest.mock('@/hooks/queries/useProfile', () => ({
  useProfileByFid: (fid: number | undefined) => ({
    data: fid ? { username: 'recaster', fname: 'recaster', fid } : undefined,
    isLoading: false,
  }),
  useProfileByUsername: () => ({ data: undefined, isLoading: false }),
  useProfile: () => ({ data: undefined, isLoading: false }),
}));

jest.mock('@/common/hooks/useChannelLookup', () => ({
  useChannelLookup: (url?: string) => ({
    channel: url ? { id: 'farcaster', name: 'farcaster', url, image_url: '', icon_url: '' } : undefined,
    isLoading: false,
  }),
}));

const noopMutation = () => ({ mutate: jest.fn(), mutateAsync: jest.fn(), isPending: false });
jest.mock('@/hooks/mutations/useCastActions', () => ({
  useLikeCast: noopMutation,
  useUnlikeCast: noopMutation,
  useRecast: noopMutation,
  useRemoveRecast: noopMutation,
}));

jest.mock('@/common/hooks/useAppHotkeys', () => ({
  useAppHotkeys: () => {},
}));

// Performance store helpers used inside the component
jest.mock('@/stores/usePerformanceStore', () => ({
  startTiming: () => 0,
  endTiming: () => {},
  measureAsync: async (_name: string, fn: () => Promise<unknown>) => fn(),
}));

// `removeCast` pulls in @farcaster/hub-web → viem, which references TextEncoder
// at module load. We don't exercise the delete codepath in this test.
jest.mock('@/common/helpers/farcaster', () => ({
  removeCast: jest.fn(),
}));

// `addToClipboard` and toasts touch DOM/Sonner globals we don't need here.
jest.mock('@/common/helpers/clipboard', () => ({
  addToClipboard: jest.fn(),
}));

jest.mock('@/common/helpers/toast', () => ({
  toastCopiedToClipboard: jest.fn(),
  toastInfoReadOnlyMode: jest.fn(),
  toastSuccessCastDeleted: jest.fn(),
  toastUnableToDeleteCast: jest.fn(),
}));

// Supabase client requires env vars at module load (via useListStore →
// QuickListManageDialog). The dialog content is hidden behind state we don't
// flip in HTML equivalence checks, so stub the client out.
// Stub the embed renderers — both legacy and new components route to the same
// modules, so stubbing them out preserves HTML equivalence and avoids dragging
// in heavy ESM-only deps (react-tweet, frame-sdk, etc.).
jest.mock('@/common/components/Embeds/EmbedCarousel', () => ({
  __esModule: true,
  default: ({ embeds }: { embeds: unknown[] }) => <div data-testid="embed-carousel-stub" data-count={embeds.length} />,
}));

jest.mock('@/common/components/Embeds/NftSaleEmbed', () => ({
  __esModule: true,
  default: ({ url }: { url: string }) => <div data-testid="nft-sale-embed" data-url={url} />,
}));

jest.mock('@/common/components/Embeds/OpenGraphImage', () => ({
  __esModule: true,
  default: ({ url }: { url: string }) => <div data-testid="og-image" data-url={url} />,
}));

jest.mock('@/common/components/Embeds/SwapEmbed', () => ({
  __esModule: true,
  default: ({ url }: { url: string }) => <div data-testid="swap-embed" data-url={url} />,
}));

jest.mock('@/common/components/CashtagHoverCard', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

jest.mock('@/common/components/ProfileHoverCard', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

jest.mock('@/common/components/HotkeyTooltipWrapper', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/common/components/QuickListManageDialog', () => ({
  QuickListManageDialog: () => null,
}));

jest.mock('@/common/helpers/supabase/component', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ data: [], error: null }) }),
      insert: () => ({ data: null, error: null }),
      update: () => ({ data: null, error: null }),
      delete: () => ({ data: null, error: null }),
    }),
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      getSession: async () => ({ data: { session: null }, error: null }),
    },
  }),
}));

// ── Component imports (after mocks) ──────────────────────────────────────

import { CastRow } from '@/common/components/CastRow';
import { CastRowLegacy } from '@/common/components/CastRowLegacy';
import {
  textOnly,
  withImageEmbed,
  withLongText,
  withMentionAndChannel,
  withQuoteCast,
  withReactions,
  withRecast,
} from './fixtures/casts';

// ── Test harness ─────────────────────────────────────────────────────────

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

type RenderProps = React.ComponentProps<typeof CastRowLegacy>;

async function renderHtml(Comp: React.ComponentType<any>, props: RenderProps): Promise<string> {
  let html = '';
  await act(async () => {
    const { container } = render(
      <Wrapper>
        <Comp {...props} />
      </Wrapper>
    );
    // Allow the truncation-detection useEffect to settle
    await Promise.resolve();
    html = container.innerHTML;
  });
  return html;
}

// ── Fixture × prop-variant matrix ────────────────────────────────────────

const fixtures = {
  textOnly,
  withMentionAndChannel,
  withImageEmbed,
  withQuoteCast,
  withRecast,
  withLongText,
  withReactions,
} as const;

type VariantSpec = {
  label: string;
  fixtureKey: keyof typeof fixtures;
  props: Partial<RenderProps>;
};

const variants: VariantSpec[] = [
  // Baseline: every fixture rendered with no special props
  ...(Object.keys(fixtures) as (keyof typeof fixtures)[]).map((key) => ({
    label: `baseline:${key}`,
    fixtureKey: key,
    props: {},
  })),
  // isEmbed (the quote-render path) — critical, must not regress
  ...(Object.keys(fixtures) as (keyof typeof fixtures)[]).map((key) => ({
    label: `isEmbed:${key}`,
    fixtureKey: key,
    props: { isEmbed: true },
  })),
  { label: 'hideAuthor:textOnly', fixtureKey: 'textOnly', props: { hideAuthor: true } },
  { label: 'hideReactions:withReactions', fixtureKey: 'withReactions', props: { hideReactions: true } },
  { label: 'showAdminActions:textOnly', fixtureKey: 'textOnly', props: { showAdminActions: true } },
  { label: 'isSelected:textOnly', fixtureKey: 'textOnly', props: { isSelected: true } },
  { label: 'isSelected:withReactions', fixtureKey: 'withReactions', props: { isSelected: true } },
  { label: 'recastedByFid:withRecast', fixtureKey: 'withRecast', props: { recastedByFid: 123 } },
  { label: 'showChannel:withMentionAndChannel', fixtureKey: 'withMentionAndChannel', props: { showChannel: true } },
];

describe('StandardCastRow regression: CastRow renders identically to CastRowLegacy', () => {
  it.each(variants)('$label', async ({ fixtureKey, props }) => {
    const cast = fixtures[fixtureKey];
    const baseProps: RenderProps = { cast, ...props } as RenderProps;

    const legacyHtml = await renderHtml(CastRowLegacy as unknown as React.ComponentType<any>, baseProps);
    const newHtml = await renderHtml(CastRow as unknown as React.ComponentType<any>, baseProps);

    expect(newHtml).toEqual(legacyHtml);
  });
});

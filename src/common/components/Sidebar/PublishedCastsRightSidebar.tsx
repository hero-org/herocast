import React from 'react';
import { SidebarHeader } from './SidebarHeader';
import { CastRow } from '../CastRow';
import { useAccountStore } from '@/stores/useAccountStore';
import { CastWithInteractions } from '@neynar/nodejs-sdk/build/neynar-api/v1';
import { useDraftStore } from '@/stores/useDraftStore';
import orderBy from 'lodash.orderby';
import filter from 'lodash.filter';
import uniqBy from 'lodash.uniqby';
import { useProfileByFid, ProfileData } from '@/hooks/queries/useProfile';

const convertDraftToFakeCast = (
  draft: any,
  profile: ProfileData
): Omit<CastWithInteractions, 'reactions' | 'recasts' | 'recasters' | 'replies'> & { accountId: string } => ({
  hash: draft.hash,
  text: draft.text,
  timestamp: draft.timestamp,
  author: {
    fid: profile.fid,
    username: profile.username,
  },
  parentAuthor: {
    fid: null,
  },
  parentHash: null,
  parentUrl: null,
  threadHash: '',
  mentionedProfiles: [],
  embeds: [],
  accountId: draft.accountId,
});

const PublishedCastsRightSidebar = () => {
  const { drafts } = useDraftStore();
  const selectedAccount = useAccountStore((state) => state.accounts[state.selectedAccountIdx]);
  const selectedAccountFid = selectedAccount?.platformAccountId ? Number(selectedAccount.platformAccountId) : undefined;

  const { data: profile } = useProfileByFid(selectedAccountFid, {
    viewerFid: selectedAccountFid,
  });

  const publishedDraftsAsFakeCasts = profile
    ? drafts
        .filter((draft) => draft.accountId === selectedAccount.id && draft.status === 'published' && draft.hash)
        .map((draft) => convertDraftToFakeCast(draft, profile))
    : [];

  const filteredCasts = filter(publishedDraftsAsFakeCasts, (cast) => cast.timestamp && cast?.author?.fid);
  const castsForSidebar = orderBy(uniqBy(filteredCasts, 'hash'), 'timestamp', 'desc');

  return (
    <aside
      style={{
        msOverflowStyle: 'none',
        scrollbarWidth: 'none',
        WebkitScrollbar: 'none',
      }}
      className="h-screen sticky top-0 bg-muted/40  w-full md:border-l md:border-foreground/5 overflow-y-auto"
    >
      <div>
        <SidebarHeader title="Recent casts" />
        <ul role="list" className="mb-36">
          {castsForSidebar.map((cast) => (
            <li key={cast.hash} className="px-2 sm:px-3 lg:px-4 border-b border-foreground/10">
              <CastRow cast={cast} isEmbed hideAuthor hideReactions showParentDetails />
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
};

export default PublishedCastsRightSidebar;

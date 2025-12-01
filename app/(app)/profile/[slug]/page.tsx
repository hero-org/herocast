'use client';

import React, { useState } from 'react';
import { SelectableListWithHotkeys } from '@/common/components/SelectableListWithHotkeys';
import { CastRow } from '@/common/components/CastRow';
import { CastWithInteractions } from '@neynar/nodejs-sdk/build/neynar-api/v2/openapi-farcaster/models/cast-with-interactions';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAccountStore } from '@/stores/useAccountStore';
import { useParams } from 'next/navigation';
import { Loading } from '@/common/components/Loading';
import ProfileInfo from '@/common/components/ProfileInfo';
import { useProfile } from '@/hooks/queries/useProfile';
import { useProfileFeed, ProfileFeedType } from '@/hooks/queries/useProfileFeed';

const APP_FID = Number(process.env.NEXT_PUBLIC_APP_FID!);

enum FeedTypeEnum {
  'casts' = 'Casts',
  'likes' = 'Likes',
}

const getUsernameAndFidFromSlug = (slug?: string) => {
  if (!slug) {
    return { username: undefined, fid: undefined };
  }
  const fid = slug.startsWith('fid:') ? slug.slice(4) : undefined;
  if (fid) {
    return { username: undefined, fid: Number(fid) };
  }
  const username = slug.startsWith('@') ? slug.slice(1) : slug;
  return { username, fid: undefined };
};

const ProfilePage = () => {
  const params = useParams();
  const slug = params.slug as string;
  const { username, fid } = getUsernameAndFidFromSlug(slug);
  const [selectedFeedIdx, setSelectedFeedIdx] = useState(0);
  const [feedType, setFeedType] = useState<FeedTypeEnum>(FeedTypeEnum.casts);

  const { accounts, selectedAccountIdx } = useAccountStore();
  const selectedAccount = accounts[selectedAccountIdx];
  const viewerFid = Number(selectedAccount?.platformAccountId) || APP_FID;

  // Use React Query for profile fetching
  const {
    data: profile,
    isLoading: isLoadingProfile,
    error: profileError,
  } = useProfile(
    { fid, username },
    {
      viewerFid,
      includeAdditionalInfo: true, // Get full profile info for profile page
      enabled: !!(fid || username),
    }
  );

  // Use React Query for feed fetching
  const feedTypeKey: ProfileFeedType = feedType === FeedTypeEnum.casts ? 'casts' : 'likes';
  const { data: feedData, isLoading: isLoadingFeed } = useProfileFeed(profile?.fid, feedTypeKey, {
    enabled: !!profile?.fid,
  });

  const casts = feedData?.casts ?? [];

  const onSelectCast = (idx: number) => {
    setSelectedFeedIdx(idx);
  };

  const renderEmptyState = () => (
    <div className="max-w-7xl px-6 pb-24 sm:pb-32 lg:flex lg:px-8">
      <div className="mx-auto max-w-2xl flex-shrink-0 lg:mx-0 lg:max-w-xl">
        <Loading />
      </div>
    </div>
  );

  const renderError = () => (
    <div className="max-w-7xl px-6 pb-24 sm:pb-32 lg:flex lg:px-8">
      <div className="mx-auto max-w-2xl flex-shrink-0 lg:mx-0 lg:max-w-xl">
        <p className="text-foreground/60">Failed to load profile. Please try again.</p>
      </div>
    </div>
  );

  const renderRow = (item: CastWithInteractions, idx: number) => (
    <li
      key={item?.hash}
      className="border-b border-gray-700/40 relative flex items-center space-x-4 max-w-full md:max-w-2xl"
    >
      <CastRow
        cast={item}
        showChannel
        isSelected={selectedFeedIdx === idx}
        onSelect={() => onSelectCast(idx)}
        showAdminActions={selectedAccount?.status === 'active' && profile?.fid === viewerFid}
        recastedByFid={item.author.fid !== profile?.fid ? profile?.fid : undefined}
      />
    </li>
  );

  const renderFeed = () => (
    <>
      <Tabs value={feedType} className="p-5 w-full max-w-full">
        <TabsList className="grid w-full grid-cols-2">
          {Object.keys(FeedTypeEnum).map((key) => {
            return (
              <TabsTrigger
                key={key}
                value={FeedTypeEnum[key as keyof typeof FeedTypeEnum]}
                className="text-foreground/80 text-center"
                onClick={() => setFeedType(FeedTypeEnum[key as keyof typeof FeedTypeEnum])}
              >
                {FeedTypeEnum[key as keyof typeof FeedTypeEnum]}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>
      <div className="px-5">
        {isLoadingFeed ? (
          <Loading />
        ) : (
          <SelectableListWithHotkeys
            data={casts}
            selectedIdx={selectedFeedIdx}
            setSelectedIdx={setSelectedFeedIdx}
            renderRow={(item: CastWithInteractions, idx: number) => renderRow(item, idx)}
            onExpand={() => null}
            onSelect={() => null}
            isActive
          />
        )}
      </div>
    </>
  );

  const renderProfile = () => (
    <div>
      <div className="m-8 mb-0">
        <ProfileInfo fid={profile!.fid} viewerFid={viewerFid} showFullInfo wideFormat />
      </div>
      {renderFeed()}
    </div>
  );

  if (profileError) {
    return renderError();
  }

  if (isLoadingProfile || !profile) {
    return renderEmptyState();
  }

  return renderProfile();
};

export default ProfilePage;

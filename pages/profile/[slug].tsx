import React, { useEffect, useState } from "react";

import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { SelectableListWithHotkeys } from "@/common/components/SelectableListWithHotkeys";
import { CastRow } from "@/common/components/CastRow";
import { CastWithInteractions } from "@neynar/nodejs-sdk/build/neynar-api/v2/openapi-farcaster/models/cast-with-interactions";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAccountStore } from "@/stores/useAccountStore";
import { useDataStore } from "@/stores/useDataStore";
import { fetchAndAddUserProfile, getProfile, shouldUpdateProfile } from "@/common/helpers/profileUtils";
import { useRouter } from "next/router";
import { Loading } from "@/common/components/Loading";
import ProfileInfo from "@/common/components/Sidebar/ProfileInfo";

const APP_FID = Number(process.env.NEXT_PUBLIC_APP_FID!);

enum FeedTypeEnum {
  "casts" = "Casts",
  "likes" = "Likes",
}

const getUsernameAndFidFromSlug = (slug?: string) => {
  if (!slug) {
    return { username: undefined, fid: undefined };
  }
  const fid = slug.startsWith("fid:") ? slug.slice(4) : undefined;
  if (fid) {
    return { username: undefined, fid };
  }
  const username = slug.startsWith("@") ? slug.slice(1) : slug;
  return { username, fid };
};

const ProfilePage = () => {
  const router = useRouter();
  const { slug } = router.query as { slug?: string };
  const { username, fid } = getUsernameAndFidFromSlug(slug);
  const [selectedFeedIdx, setSelectedFeedIdx] = useState(0);
  const [casts, setCasts] = useState<CastWithInteractions[]>([]);
  const [feedType, setFeedType] = useState<FeedTypeEnum>(FeedTypeEnum.casts);

  const profile = useDataStore((state) => getProfile(state, username, fid));
  const { accounts, selectedAccountIdx } = useAccountStore();

  const selectedAccount = accounts[selectedAccountIdx];
  const viewerFid = Number(selectedAccount?.platformAccountId) || APP_FID;

  const onSelectCast = (idx: number) => {
    setSelectedFeedIdx(idx);
  };

  useEffect(() => {
    if (shouldUpdateProfile(profile)) {
      fetchAndAddUserProfile({ username, fid, viewerFid });
    }
  }, [profile, fid, slug]);

  useEffect(() => {
    if (!profile) return;

    const loadFeed = async () => {
      const client = new NeynarAPIClient(process.env.NEXT_PUBLIC_NEYNAR_API_KEY!);

      if (feedType === FeedTypeEnum.casts) {
        client
          .fetchFeed("filter", {
            filterType: "fids",
            fids: [profile.fid],
            withRecasts: true,
            limit: 25,
          })
          .then(({ casts }) => {
            setCasts(casts);
          })
          .catch((err) => console.log(`failed to fetch ${err}`));
      } else if (feedType === FeedTypeEnum.likes) {
        client
          .fetchUserReactions(profile.fid, "likes", {
            limit: 25,
          })
          .then(({ reactions }) => {
            setCasts(reactions.map(({ cast }) => cast));
          });
      }
    };

    loadFeed();
  }, [profile, feedType]);

  const renderEmptyState = () => (
    <div className="max-w-7xl px-6 pb-24 sm:pb-32 lg:flex lg:px-8">
      <div className="mx-auto max-w-2xl flex-shrink-0 lg:mx-0 lg:max-w-xl">
        <Loading />
      </div>
    </div>
  );

  const renderRow = (item: CastWithInteractions, idx: number) => (
    <li
      key={item?.hash}
      className="border-b border-gray-700/40 relative flex items-center space-x-4 max-w-full md:max-w-2xl"
    >
      <CastRow cast={item} showChannel isSelected={selectedFeedIdx === idx} onSelect={() => onSelectCast(idx)} />
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
                value={FeedTypeEnum[key]}
                className="text-foreground/80 text-center"
                onClick={() => setFeedType(FeedTypeEnum[key])}
              >
                {FeedTypeEnum[key]}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>
      <div className="px-5">
        <SelectableListWithHotkeys
          data={casts}
          selectedIdx={selectedFeedIdx}
          setSelectedIdx={setSelectedFeedIdx}
          renderRow={(item: any, idx: number) => renderRow(item, idx)}
          onExpand={() => null}
          onSelect={() => null}
          isActive
        />
      </div>
    </>
  );

  const renderProfile = () => (
    <div>
      <div className="m-8 mb-0">
        <ProfileInfo fid={profile.fid} viewerFid={viewerFid} showFullInfo />
      </div>
      {renderFeed()}
    </div>
  );

  return router.isFallback || !profile ? renderEmptyState() : renderProfile();
};

export default ProfilePage;

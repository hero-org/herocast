import React, { useEffect, useState } from "react";

import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { AvatarImage, AvatarFallback, Avatar } from "@/components/ui/avatar";
import { CardHeader, Card } from "@/components/ui/card";
import { SelectableListWithHotkeys } from "@/common/components/SelectableListWithHotkeys";
import { CastRow } from "@/common/components/CastRow";
import { CastWithInteractions } from "@neynar/nodejs-sdk/build/neynar-api/v2/openapi-farcaster/models/cast-with-interactions";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FollowButton from "@/common/components/FollowButton";
import { useAccountStore } from "@/stores/useAccountStore";
import {
  getProfile,
  shouldUpdateProfile,
  useDataStore,
} from "@/stores/useDataStore";
import { getUserDataForFidOrUsername } from "@/common/helpers/neynar";
import { useRouter } from "next/router";
import { Loading } from "@/common/components/Loading";

const APP_FID = Number(process.env.NEXT_PUBLIC_APP_FID!);

enum FeedTypeEnum {
  "casts" = "Casts",
  "likes" = "Likes",
}

export default function Profile() {
  const router = useRouter();
  const { slug } = router.query as { slug?: string };
  const username = slug?.startsWith("@") ? slug.slice(1) : slug;

  const [selectedFeedIdx, setSelectedFeedIdx] = useState(0);
  const [casts, setCasts] = useState<CastWithInteractions[]>([]);
  const [feedType, setFeedType] = useState<FeedTypeEnum>(FeedTypeEnum.casts);

  const profile = useDataStore((state) => getProfile(state, username));
  const { addUserProfile } = useDataStore();
  const { accounts, selectedAccountIdx } = useAccountStore();

  const selectedAccount = accounts[selectedAccountIdx];
  const viewerFid = Number(selectedAccount?.platformAccountId) || APP_FID;

  const onSelectCast = (idx: number) => {
    setSelectedFeedIdx(idx);
  };

  useEffect(() => {
    const getData = async () => {
      const users = await getUserDataForFidOrUsername({
        username,
        viewerFid,
      });

      if (users.length) {
        users.forEach((user) => {
          addUserProfile({ user });
        });
      }
    };

    if (shouldUpdateProfile(profile)) {
      getData();
    }
  }, [profile, selectedAccount]);

  useEffect(() => {
    if (!profile) return;

    const loadFeed = async () => {
      const client = new NeynarAPIClient(
        process.env.NEXT_PUBLIC_NEYNAR_API_KEY!
      );

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
      <CastRow
        cast={item}
        showChannel
        isSelected={selectedFeedIdx === idx}
        onSelect={() => onSelectCast(idx)}
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
      <Card className="max-w-2xl mx-auto bg-transparent border-none shadow-none">
        <CardHeader className="flex space-y-0">
          <div className="grid space-x-4 grid-cols-2 lg:grid-cols-3">
            <div className="col-span-1 lg:col-span-2">
              <Avatar className="h-14 w-14">
                <AvatarImage alt="User avatar" src={profile.pfp_url} />
                <AvatarFallback>{profile.username}</AvatarFallback>
              </Avatar>
              <div className="text-left">
                <h2 className="text-xl font-bold text-foreground">
                  {profile.display_name}
                </h2>
                <span className="text-sm text-foreground/80">
                  @{profile.username}
                </span>
              </div>
            </div>
            {viewerFid !== profile.fid && (
              <FollowButton username={profile.username} />
            )}
          </div>
          <div className="flex pt-4 text-sm text-foreground/80">
            <span className="mr-4">
              <strong>{profile.following_count}</strong> Following
            </span>
            <span>
              <strong>{profile.follower_count}</strong> Followers
            </span>
          </div>
          <span className="text-foreground">{profile.profile.bio.text}</span>
        </CardHeader>
      </Card>
      {renderFeed()}
    </div>
  );

  return !profile ? renderEmptyState() : renderProfile();
}

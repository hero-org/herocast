import React, { useEffect, useState } from "react";

import { NeynarAPIClient, isApiErrorResponse } from "@neynar/nodejs-sdk";
import { GetStaticPaths } from "next/types";
import {
  AvatarImage,
  AvatarFallback,
  Avatar,
} from "../../src/components/ui/avatar";
import { CardHeader, Card } from "../../src/components/ui/card";
import { SelectableListWithHotkeys } from "../../src/common/components/SelectableListWithHotkeys";
import { CastRow } from "../../src/common/components/CastRow";
import { CastWithInteractions } from "@neynar/nodejs-sdk/build/neynar-api/v2/openapi-farcaster/models/cast-with-interactions";
import { Tabs, TabsList, TabsTrigger } from "../../src/components/ui/tabs";
import uniqBy from "lodash.uniqby";
import { useHotkeys } from "react-hotkeys-hook";
import FollowButton from "../../src/common/components/FollowButton";
import { useAccountStore } from "../../src/stores/useAccountStore";
import { useDataStore } from "../../src/stores/useDataStore";

export async function getStaticProps({ params: { slug } }) {
  const client = new NeynarAPIClient(process.env.NEXT_PUBLIC_NEYNAR_API_KEY!);
  let user: any = {};
  try {
    if (slug.startsWith("fid:")) {
      const fid = slug.split(":")[1];
      user = await client.lookupUserByFid(fid);
    } else {
      user = await client.lookupUserByUsername(slug);
    }

    console.log("resp in getStaticProps", JSON.stringify(user));
  } catch (error) {
    // isApiErrorResponse can be used to check for Neynar API errors
    if (isApiErrorResponse(error)) {
      console.log("API Error", error.response.data);
    } else {
      console.log("Generic Error", error);
    }
  }

  return {
    props: {
      profile: user.result.user,
    },

    // Next.js will attempt to re-generate the page:
    // - When a request comes in
    // - At most once every 60 seconds
    revalidate: 60,
  };
}

export const getStaticPaths = (async () => {
  const client = new NeynarAPIClient(process.env.NEXT_PUBLIC_NEYNAR_API_KEY!);

  const globalFeed = await client.fetchFeed("filter", {
    filterType: "global_trending",
    limit: 100,
  });

  const paths = uniqBy(
    globalFeed.casts.map(({ author }) => ({
      params: {
        slug: author.username,
      },
    })),
    "params.slug"
  );

  console.log(`preparing static profiles: ${paths.length}`);
  return {
    paths,
    fallback: true,
  };
}) satisfies GetStaticPaths;

enum FeedTypeEnum {
  "casts" = "Casts",
  "likes" = "Likes",
}

export default function Profile({ profile }) {
  const [selectedFeedIdx, setSelectedFeedIdx] = useState(0);
  const [casts, setCasts] = useState<CastWithInteractions[]>([]);
  const [feedType, setFeedType] = useState<FeedTypeEnum>(FeedTypeEnum.casts);

  const { addUserProfile } = useDataStore();
  const { accounts, selectedAccountIdx } = useAccountStore();

  const selectedAccount = accounts[selectedAccountIdx];
  const userFid = Number(selectedAccount?.platformAccountId);

  const onSelectCast = (idx: number) => {
    setSelectedFeedIdx(idx);
  };

  useEffect(() => {
    if (!profile) return;

    const getData = async () => {
      const neynarClient = new NeynarAPIClient(
        process.env.NEXT_PUBLIC_NEYNAR_API_KEY!
      );
      const resp = await neynarClient.lookupUserByUsername(
        profile.username,
        userFid! as number
      );
      if (resp.result.user) {
        addUserProfile({ username: profile.username, data: resp.result.user });
      }
    };

    getData();
  }, [profile, userFid]);

  useHotkeys(
    ["tab", "shift+tab"],
    () => {
      setFeedType(
        feedType === FeedTypeEnum.casts
          ? FeedTypeEnum.likes
          : FeedTypeEnum.casts
      );
      setSelectedFeedIdx(0);
      window.scrollTo(0, 0);
    },
    [feedType],
    {
      preventDefault: true,
    }
  );

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
        <div className="mt-2">
          <h2>Loading...</h2>
        </div>
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
                className="text-gray-300 text-center"
                onClick={() => setFeedType(FeedTypeEnum[key])}
              >
                {FeedTypeEnum[key]}
                {feedType !== FeedTypeEnum[key] && (
                  <div className="ml-4 text-gray-500 hidden md:block">
                    Switch with &nbsp;
                    <kbd className="px-1 py-0.5 text-xs border rounded-md bg-gray-700 text-gray-500 border-gray-600">
                      Tab
                    </kbd>
                  </div>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>
      <SelectableListWithHotkeys
        data={casts}
        selectedIdx={selectedFeedIdx}
        setSelectedIdx={setSelectedFeedIdx}
        renderRow={(item: any, idx: number) => renderRow(item, idx)}
        onExpand={() => null}
        onSelect={() => null}
        isActive
      />
    </>
  );

  const renderProfile = () => (
    <div>
      <Card className="max-w-2xl mx-auto bg-transparent border-none shadow-none">
        <CardHeader className="flex space-y-0">
          <div className="flex space-x-4 grid grid-cols-2 lg:grid-cols-3">
            <div className="col-span-1 lg:col-span-2">
              <Avatar className="h-14 w-14">
                <AvatarImage alt="User avatar" src={profile.pfp.url} />
                <AvatarFallback>{profile.username}</AvatarFallback>
              </Avatar>
              <div className="text-left">
                <h2 className="text-xl font-bold text-gray-200">
                  {profile.displayName}
                </h2>
                <span className="text-sm text-gray-300">
                  @{profile.username}
                </span>
              </div>
            </div>
            {userFid !== profile.fid && (
              <FollowButton username={profile.username} />
            )}
          </div>
          <div className="flex pt-4 text-sm text-gray-300">
            <span className="mr-4">
              <strong>{profile.followingCount}</strong> Following
            </span>
            <span>
              <strong>{profile.followerCount}</strong> Followers
            </span>
          </div>
          <p className="text-gray-200">{profile.profile.bio.text}</p>
        </CardHeader>
      </Card>
      {renderFeed()}
    </div>
  );

  return !profile ? renderEmptyState() : renderProfile();
}

import React, { useEffect, useState } from "react";

import { NeynarAPIClient, isApiErrorResponse } from "@neynar/nodejs-sdk";
import { GetStaticPaths } from "next/types";
import { AvatarImage, AvatarFallback, Avatar } from "@/components/ui/avatar";
import {
  CardHeader,
  CardContent,
  CardFooter,
  Card,
} from "@/components/ui/card";
import { Button } from "../../src/components/ui/button";

import { SelectableListWithHotkeys } from "../../src/common/components/SelectableListWithHotkeys";
import { CastRow } from "../../src/common/components/CastRow";
import { CastType } from "../../src/common/constants/farcaster";
import clsx from "clsx";

export async function getStaticProps({ params: { slug } }) {
  const client = new NeynarAPIClient(process.env.NEXT_PUBLIC_NEYNAR_API_KEY!);
  let user: any = {};
  try {
    user = await client.lookupUserByUsername(slug);

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
  return {
    paths: [
      {
        params: {
          slug: "dwr.eth",
        },
      },
    ],
    fallback: true,
  };
}) satisfies GetStaticPaths;

enum FeedTypeEnum {
  "casts" = "Casts",
  "casts_and_replies" = "Casts + Replies",
  "likes" = "Likes",
}

export default function Profile({ profile }) {
  console.log("profile", profile);
  const [selectedFeedIdx, setSelectedFeedIdx] = useState(0);
  const [feed, setFeed] = useState([]);
  const [feedType, setFeedType] = useState<FeedTypeEnum>(FeedTypeEnum.casts);

  const onSelectCast = (idx: number) => {
    setSelectedFeedIdx(idx);
  };

  useEffect(() => {
    if (!profile) return;

    const loadFeed = async () => {
      const client = new NeynarAPIClient(
        process.env.NEXT_PUBLIC_NEYNAR_API_KEY!
      );
      client.fetchAllCastsCreatedByUser(profile.fid).then((resp) => {
        console.log("resp", resp);
        setFeed(resp.result.casts);
      });
    };

    loadFeed();
  }, [profile, feedType]);

  const renderEmptyState = () => (
    <>
      <div className="max-w-7xl px-6 pb-24 sm:pb-32 lg:flex lg:px-8">
        <div className="mx-auto max-w-2xl flex-shrink-0 lg:mx-0 lg:max-w-xl">
          <div className="mt-2">
            <h2>Loading...</h2>
          </div>
        </div>
      </div>
    </>
  );

  const renderRow = (item: any, idx: number) => (
    <li
      key={item?.hash}
      className="border-b border-gray-700/40 relative flex items-center space-x-4 max-w-full md:max-w-2xl"
    >
      <CastRow
        cast={item as CastType}
        showChannel
        isSelected={selectedFeedIdx === idx}
        onSelect={() => onSelectCast(idx)}
      />
    </li>
  );

  const renderFeed = () => (
    <>
      <div className="flex-row border-b flex h-14 items-center justify-around">
        {Object.keys(FeedTypeEnum).map((key) => {
          return (
            <div
              key={key}
              className="flex h-full w-full items-center justify-center text-inherit"
              onClick={() => setFeedType(FeedTypeEnum[key])}
            >
              <div className="relative flex h-full w-full flex-col items-center justify-center">
                <div
                  className={clsx(
                    FeedTypeEnum[key] === feedType
                      ? "text-white"
                      : "text-gray-400",
                    "font-semibold flex items-center justify-center text-base h-full relative hover:text-white cursor-pointer"
                  )}
                >
                  {FeedTypeEnum[key]}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <SelectableListWithHotkeys
        data={feed}
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
        <CardHeader className="flex">
          <div className="flex space-x-4">
            <Avatar className="h-14 w-14">
              <AvatarImage alt="User avatar" src={profile.pfp.url} />
              <AvatarFallback>{profile.username}</AvatarFallback>
            </Avatar>
            <div className="text-left">
              <h2 className="text-xl font-bold">{profile.displayName}</h2>
              <span className="text-sm text-gray-400">{profile.username}</span>
            </div>
          </div>
          <div className="flex mt-4 text-sm text-gray-300">
            <span className="mr-4">
              <strong>{profile.followingCount}</strong> Following
            </span>
            <span>
              <strong>{profile.followerCount}</strong> Followers
            </span>
          </div>
          <p className="text-gray-200">{profile.profile.bio.text}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-4">
            <Button variant="default" className="w-full">
              Follow
            </Button>
            <Button variant="secondary" disabled className="w-full">
              Message (coming soon)
            </Button>
          </div>
        </CardContent>
      </Card>
      {renderFeed()}
    </div>
  );

  return !profile ? renderEmptyState() : renderProfile();
}

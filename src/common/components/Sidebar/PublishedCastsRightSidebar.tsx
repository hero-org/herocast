import React, { useEffect, useState } from "react";
import { SidebarHeader } from "./SidebarHeader";
import { CastRow } from "../CastRow";
import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { useAccountStore } from "@/stores/useAccountStore";
import { CastWithInteractions } from "@neynar/nodejs-sdk/build/neynar-api/v1";
import { useDraftStore } from "@/stores/useDraftStore";
import orderBy from "lodash.orderby";
import filter from "lodash.filter";
import { useDataStore, UserProfile } from "@/stores/useDataStore";
import {
  getProfile,
  getProfileFetchIfNeeded,
} from "@/common/helpers/profileUtils";
import { UUID } from "crypto";
import isEmpty from "lodash.isempty";

const convertDraftToFakeCast = (
  draft: any,
  profile: UserProfile
): Omit<
  CastWithInteractions,
  "reactions" | "recasts" | "recasters" | "replies"
> & { accountId: UUID } => ({
  hash: draft.id,
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
  threadHash: "",
  mentionedProfiles: [],
  embeds: [],
  accountId: draft.accountId,
});

const PublishedCastsRightSidebar = () => {
  const { drafts } = useDraftStore();
  const [casts, setCasts] = useState<CastWithInteractions[]>([]);
  const selectedAccount = useAccountStore(
    (state) => state.accounts[state.selectedAccountIdx]
  );
  const selectedAccountFid = selectedAccount?.platformAccountId;
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    console.log("getProfileFetchIfNeeded()");
    const fetchProfile = async () => {
      const res = await getProfileFetchIfNeeded({
        fid: selectedAccountFid,
        viewerFid: selectedAccountFid,
      });
      setProfile(res);
    };

    if (isEmpty(profile) && selectedAccountFid) {
      fetchProfile();
    }
  }, [profile, selectedAccountFid]);

  useEffect(() => {
    const fetchCasts = async () => {
      const neynarClient = new NeynarAPIClient(
        process.env.NEXT_PUBLIC_NEYNAR_API_KEY!
      );

      const res = await neynarClient.fetchAllCastsCreatedByUser(
        Number(selectedAccountFid),
        {
          limit: 5,
          viewerFid: Number(selectedAccountFid),
        }
      );
      setCasts(res.result.casts);
    };

    if (selectedAccountFid) {
      fetchCasts();
    }
  }, [selectedAccountFid, drafts.length]);

  const publishedDraftsAsFakeCasts = profile
    ? drafts
        .filter(
          (draft) =>
            draft.accountId === selectedAccount.id &&
            draft.status === "published"
        )
        .map((draft) => convertDraftToFakeCast(draft, profile))
    : [];

    const castsForSidebar = orderBy(
    filter(
      [...casts, ...publishedDraftsAsFakeCasts],
      (cast) => cast.timestamp && cast?.author?.fid
    ),
    "timestamp",
    ["desc"]
  );

  return (
    <aside
      style={{
        msOverflowStyle: "none",
        scrollbarWidth: "none",
        WebkitScrollbar: "none",
      }}
      className="min-h-full h-full bg-muted/40 overflow-y-auto md:fixed md:bottom-0 md:right-0 md:top-16 md:w-48 lg:w-64 md:border-l md:border-foreground/10"
    >
      <div className="">
        <SidebarHeader title="Recent casts" />
        <ul role="list" className="mb-36">
          {castsForSidebar.map((cast) => (
            <li
              key={cast.hash}
              className="px-2 sm:px-3 lg:px-4 border-b border-foreground/10"
            >
              <CastRow
                cast={cast}
                isEmbed
                hideAuthor
                hideReactions
                showParentDetails
              />
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
};

export default PublishedCastsRightSidebar;

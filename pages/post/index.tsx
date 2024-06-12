import NewPostEntry from "../../src/common/components/NewPostEntry";
import { classNames } from "../../src/common/helpers/css";
import { useNewPostStore } from "../../src/stores/useDraftStore";
import React, { useEffect, useState } from "react";
import { PlusCircleIcon, TrashIcon } from "@heroicons/react/24/outline";
import * as Tooltip from "@radix-ui/react-tooltip";
import HotkeyTooltipWrapper from "../../src/common/components/HotkeyTooltipWrapper";
import { Button } from "../../src/components/ui/button";
import { CastRow } from "@/common/components/CastRow";
import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { useAccountStore } from "@/stores/useAccountStore";
import { CastWithInteractions } from "@neynar/nodejs-sdk/build/neynar-api/v2";

export default function NewPost() {
  const { addNewPostDraft, removePostDraft, removeAllPostDrafts } =
    useNewPostStore();
  const { drafts } = useNewPostStore();
  const [parentCasts, setParentCasts] = useState<CastWithInteractions[]>([]);
  const { accounts, selectedAccountIdx } = useAccountStore();
  const selectedAccount = accounts[selectedAccountIdx];

  useEffect(() => {
    if (drafts.length === 0) {
      addNewPostDraft({});
    }
  }, []);

  useEffect(() => {
    const parentCastIds = drafts
      .map((draft) => draft?.parentCastId?.hash)
      .filter(Boolean) as string[];

    const fetchParentCasts = async () => {
      const neynarClient = new NeynarAPIClient(
        process.env.NEXT_PUBLIC_NEYNAR_API_KEY!
      );
      const res = await neynarClient.fetchBulkCasts(parentCastIds, {
        viewerFid: selectedAccount?.platformAccountId,
      });
      setParentCasts(res?.result?.casts);
    };
    if (parentCastIds.length) {
      fetchParentCasts();
    }
  }, [drafts]);

  const renderDraft = (draft, draftIdx) => {
    const parentCast = parentCasts.find(
      (cast) => cast.hash === draft.parentCastId?.hash
    );
    return (
      <div key={draftIdx} className="pt-4 pb-6">
        {parentCast && <CastRow cast={parentCast} />}
        <NewPostEntry
          draft={draft}
          key={`draft-${draftIdx}`}
          draftIdx={draftIdx}
          onRemove={() => removePostDraft(draftIdx)}
        />
      </div>
    );
  };

  return (
    <>
      <div className="ml-3 flex flex-col md:w-full lg:max-w-md xl:max-w-lg">
        <div className="ml-1 mt-2 w-full flex items-center justify-between">
          <div className="text-foreground/80 font-semibold">
            You have {drafts.length} {drafts.length !== 1 ? "drafts" : "draft"}
          </div>
          <div className="flex ml-8 lg:ml-0">
            <Tooltip.Provider delayDuration={50} skipDelayDuration={0}>
              <HotkeyTooltipWrapper hotkey={`c`} side="bottom">
                <Button
                  onClick={() => addNewPostDraft({})}
                  className="mr-2 inline-flex items-center"
                >
                  New draft
                  <PlusCircleIcon
                    className="hidden md:block ml-1.5 mt-0.5 h-4 w-4"
                    aria-hidden="true"
                  />
                </Button>
              </HotkeyTooltipWrapper>
            </Tooltip.Provider>

            <Button
              variant="outline"
              disabled={drafts.length === 0}
              onClick={() => removeAllPostDrafts()}
              className={classNames(
                drafts.length > 0 ? "cursor-pointer" : "cursor-default",
                "inline-flex items-center"
              )}
            >
              Remove all drafts
              <TrashIcon
                className="hidden md:block ml-1.5 mt-0.5 h-4 w-4"
                aria-hidden="true"
              />
            </Button>
          </div>
        </div>
        <div className="divide-y">
          {drafts.map((draft, draftIdx) => renderDraft(draft, draftIdx))}
        </div>
      </div>
    </>
  );
}

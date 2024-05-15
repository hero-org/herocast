import React, { useEffect, useMemo, useState } from "react";
import { Loading } from "./Loading";
import { CastRow } from "./CastRow";
import { useAccountStore } from "@/stores/useAccountStore";
import { useNewPostStore } from "@/stores/useNewPostStore";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { SelectableListWithHotkeys } from "./SelectableListWithHotkeys";
import { classNames } from "../helpers/css";
import HotkeyTooltipWrapper from "./HotkeyTooltipWrapper";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Button } from "@/components/ui/button";
import { CastParamType, NeynarAPIClient } from "@neynar/nodejs-sdk";
import { CastWithInteractions } from "@neynar/nodejs-sdk/build/neynar-api/v2";

type CastThreadViewProps = {
  cast: { hash: string; author: { fid: string } };
  onBack?: () => void;
  isActive?: boolean;
  setSelectedCast?: (cast: CastWithInteractions) => void;
  setShowReplyModal: (show: boolean) => void;
};

export const CastThreadView = ({
  cast,
  onBack,
  isActive,
  setSelectedCast,
  setShowReplyModal,
}: CastThreadViewProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [casts, setCasts] = useState<CastWithInteractions[]>([]);
  const [selectedCastIdx, setSelectedCastIdx] = useState(0);

  const draftIdx = useNewPostStore(
    (state) =>
      state.drafts &&
      state.drafts.findIndex((draft) => draft.parentCastId?.hash === cast?.hash)
  );

  const castTree = useMemo(() => {
    if (casts.length === 0) return [];

    const castTree = casts.reduce((acc, cast) => {
      if (!cast?.parentHash) {
        acc.push(cast);
      } else {
        const parentCast = casts.find((c) => c.hash === cast.parentHash);
        if (parentCast) {
          if (!parentCast.children) {
            parentCast.children = [];
          }
          parentCast.children.push(cast);
        }
      }
      return acc;
    }, [] as CastWithInteractions[]);

    return castTree;
  }, [casts]);

  const { selectedChannelUrl } = useAccountStore();

  const { addNewPostDraft, removePostDraft } = useNewPostStore();

  useEffect(() => {
    if (!cast || casts.length === 0 || !setSelectedCast) return;

    setSelectedCast(casts[selectedCastIdx]);
  }, [cast, selectedCastIdx, casts]);

  useEffect(() => {
    if (selectedCastIdx === 0) {
      window.scrollTo(0, 0);
    }
  }, [selectedCastIdx]);

  const renderGoBackButton = () => (
    <Button
      variant="outline"
      onClick={() => onBack && onBack()}
      className="w-20 group m-2 flex items-center px-2 py-1 shadow-sm text-sm font-medium rounded-md text-foreground/80 bg-background focus:outline-none"
    >
      <Tooltip.Provider delayDuration={50} skipDelayDuration={0}>
        <HotkeyTooltipWrapper hotkey="Esc" side="right">
          <>
            <ArrowLeftIcon
              className="mr-1 h-4 w-4 text-foreground/70 group-hover:text-foreground/80"
              aria-hidden="true"
            />
            Back
          </>
        </HotkeyTooltipWrapper>
      </Tooltip.Provider>
    </Button>
  );

  useEffect(() => {
    const loadData = async () => {
      const neynarClient = new NeynarAPIClient(
        process.env.NEXT_PUBLIC_NEYNAR_API_KEY!
      );
      const { conversation } = await neynarClient.lookupCastConversation(
        cast.hash,
        CastParamType.Hash,
        { replyDepth: 1, includeChronologicalParentCasts: true }
      );
      const { direct_replies: replies, ...castObjectWithoutReplies } =
        conversation.cast;
      if (replies) {
        setCasts([castObjectWithoutReplies].concat(replies));
      } else {
        const castResponse = await neynarClient.lookUpCastByHashOrWarpcastUrl(
          cast.hash,
          CastParamType.Hash
        );
        setCasts([castResponse.cast]);
      }

      setIsLoading(false);
    };

    if (!cast) return;

    setSelectedCastIdx(0);
    loadData();
    addNewPostDraft({
      parentCastId: { hash: cast.hash, fid: cast.author.fid },
    });

    return () => {
      removePostDraft(draftIdx, true);
    };
  }, [cast?.hash]);

  const renderRow = (cast: CastWithInteractions, idx: number) => {
    const isRowSelected = selectedCastIdx === idx;

    return (
      <li
        key={`cast-thread-${cast.hash}`}
        className={classNames(idx === selectedCastIdx ? "" : "")}
        onClick={() => setSelectedCastIdx(idx)}
      >
        <div className="relative pl-4">
          {/* this is the left line */}
          <div
            className={classNames(
              idx === 0 ? "-ml-8" : "border-l-2",
              isActive && isRowSelected
                ? "border-muted-background"
                : "border-foreground/10",
              "relative flex items-start"
            )}
          >
            <div className="min-w-0 flex-1">
              <CastRow
                cast={cast}
                showChannel={selectedChannelUrl === null}
                isSelected={selectedCastIdx === idx}
                isThreadView={idx > 0}
              />
            </div>
          </div>
        </div>
      </li>
    );
  };

  const renderFeed = () => (
    <SelectableListWithHotkeys
      data={castTree}
      selectedIdx={selectedCastIdx}
      setSelectedIdx={setSelectedCastIdx}
      renderRow={(item: any, idx: number) => renderRow(item, idx)}
      isActive={isActive}
    />
  );

  return (
    <div className="flex flex-col text-foreground/80 text-lg">
      {!isLoading && onBack && renderGoBackButton()}
      {isLoading ? (
        <Loading className="ml-4" />
      ) : (
        <div className="flow-root ml-4">{renderFeed()}</div>
      )}
    </div>
  );
};

import React, { useEffect, useState } from "react";
import { CastRow } from "./CastRow";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { SelectableListWithHotkeys } from "./SelectableListWithHotkeys";
import HotkeyTooltipWrapper from "./HotkeyTooltipWrapper";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Button } from "@/components/ui/button";
import { CastParamType, NeynarAPIClient } from "@neynar/nodejs-sdk";
import { CastWithInteractions } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import { cn } from "@/lib/utils";
import { useDataStore } from "@/stores/useDataStore";
import SkeletonCastRow from "./SkeletonCastRow";

type CastThreadViewProps = {
  hash?: string;
  cast?: { hash: string; author: { fid: number } };
  onBack?: () => void;
  isActive?: boolean;
  onReply?: () => void;
  onQuote?: () => void;
};

export const CastThreadView = ({
  hash,
  cast,
  onBack,
  isActive,
}: CastThreadViewProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [casts, setCasts] = useState<CastWithInteractions[]>([]);
  const [selectedCastIdx, setSelectedCastIdx] = useState(0);
  const { updateSelectedCast } = useDataStore();

  useEffect(() => {
    if (!cast || casts.length === 0) return;

    updateSelectedCast(casts[selectedCastIdx]);
  }, [cast, selectedCastIdx, casts]);

  useEffect(() => {
    if (selectedCastIdx === 0) {
      window.scrollTo(0, 0);
    }
  }, [selectedCastIdx]);

  const renderGoBackButton = () => (
    <Button
    size="sm"
      variant="outline"
      onClick={() => onBack && onBack()}
      className="w-16 group my-2"
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
      const threadHash = cast?.hash || hash;
      if (!threadHash) return;

      const neynarClient = new NeynarAPIClient(
        process.env.NEXT_PUBLIC_NEYNAR_API_KEY!
      );
      try {
        const { conversation } = await neynarClient.lookupCastConversation(
          threadHash,
          CastParamType.Hash,
          { replyDepth: 1, includeChronologicalParentCasts: true }
        );
        if (conversation?.cast?.direct_replies) {
          const { direct_replies: replies, ...castObjectWithoutReplies } =
            conversation.cast;
          setCasts(
            (conversation.chronological_parent_casts || []).concat(
              [castObjectWithoutReplies].concat(replies)
            )
          );
        }
      } catch (err) {
        console.error(`Error fetching cast thread: ${err}`);
      } finally {
        setIsLoading(false);
      }
    };

    setSelectedCastIdx(0);
    loadData();
  }, [cast?.hash, hash]);

  const renderRow = (cast: CastWithInteractions, idx: number) => {
    const isRowSelected = selectedCastIdx === idx;

    return (
      <li
        key={`cast-thread-${cast.hash}`}
        className={cn(idx === selectedCastIdx ? "" : "")}
        onClick={() => setSelectedCastIdx(idx)}
      >
        <div className="relative pl-4">
          {/* this is the left line */}
          <div
            className={cn(
              idx === 0 ? "-ml-[27px]" : "border-l-2",
              "relative flex items-start border-muted"
            )}
          >
            <div className="min-w-0 flex-1">
              {idx === 0 && (
                <div
                  className={cn(
                    isRowSelected
                      ? "bg-muted-foreground/50"
                      : "bg-foreground/10",
                    "absolute top-8 left-[31px] h-[calc(100%-32px)] w-0.5"
                  )}
                />
              )}
              <CastRow
                cast={cast}
                showChannel
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
      data={casts}
      selectedIdx={selectedCastIdx}
      setSelectedIdx={setSelectedCastIdx}
      renderRow={(item: CastWithInteractions, idx: number) =>
        renderRow(item, idx)
      }
      isActive={isActive}
    />
  );

  return (
    <div className="flex flex-col text-foreground/80 text-lg">
      {!isLoading && onBack && renderGoBackButton()}
      {isLoading ? (
        <SkeletonCastRow className="m-4" />
      ) : (
        <div className="flow-root ml-3">{renderFeed()}</div>
      )}
    </div>
  );
};

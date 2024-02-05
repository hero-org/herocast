import React, { useEffect, useMemo, useState } from "react";
import { CastType } from "@/common/constants/farcaster";
import { getNeynarCastThreadEndpoint } from "../helpers/neynar";
import { Loading } from "./Loading";
import { CastRow } from "./CastRow";
import { useAccountStore } from "@/stores/useAccountStore";
import NewPostEntry from "./NewPostEntry";
import { useNewPostStore } from "@/stores/useNewPostStore";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { SelectableListWithHotkeys } from "./SelectableListWithHotkeys";
import { openWindow } from "../helpers/navigation";
import { classNames } from "../helpers/css";
import HotkeyTooltipWrapper from "./HotkeyTooltipWrapper";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Button } from "@/components/ui/button";

type CastThreadViewProps = {
  cast: { hash: string; author: { fid: string } };
  onBack?: () => void;
  fid?: string;
  isActive?: boolean;
  setSelectedCast?: (cast: CastType) => void;
};

export const CastThreadView = ({
  cast,
  onBack,
  fid,
  isActive,
  setSelectedCast,
}: CastThreadViewProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [casts, setCasts] = useState<CastType[]>([]);
  const [selectedCastIdx, setSelectedCastIdx] = useState(0);
  const [selectedCastDepth, setSelectedCastDepth] = useState(0);

  const draftIdx = useNewPostStore(
    (state) =>
      state.drafts &&
      state.drafts.findIndex((draft) => draft.parentCastId?.hash === cast?.hash)
  );
  const { drafts } = useNewPostStore();
  const draft = draftIdx !== -1 ? drafts[draftIdx] : undefined;

  // upgrade this component
  // - simple iterate with j,k along the full data, maybe I flatten the tree and just have a list with depth of cast?
  // - make sure setSelectedCast works, because this opens up the reply modal

  const castTree = useMemo(() => {
    if (casts.length === 0) return [];

    const castTree = casts.reduce((acc, cast) => {
      if (!cast?.parentHash) {
        acc.push(cast);
      } else {
        const parentCast = casts.find((c) => c.hash === cast.parentHash);
        // console.log('found parentCast', parentCast);
        if (parentCast) {
          if (!parentCast.children) {
            parentCast.children = [];
          }
          parentCast.children.push(cast);
        }
      }
      return acc;
    }, [] as CastType[]);

    return castTree;
  }, [casts]);

  const { selectedChannelUrl } = useAccountStore();

  const { addNewPostDraft, removePostDraft } = useNewPostStore();

  useEffect(() => {
    if (!cast || casts.length === 0 || !setSelectedCast) return;

    setSelectedCast(casts[selectedCastIdx]);
  }, [cast, selectedCastIdx, casts]);

  const renderGoBackButton = () => (
    <Button
      onClick={() => onBack && onBack()}
      className="group md:-ml-2 flex items-center px-2 py-1 shadow-sm text-sm font-medium rounded-md text-gray-100 bg-gray-800 hover:bg-gray-700 focus:outline-none"
    >
      <Tooltip.Provider delayDuration={50} skipDelayDuration={0}>
        <HotkeyTooltipWrapper hotkey="Esc" side="right">
          <>
            <ArrowLeftIcon
              className="mr-1 h-4 w-4 text-gray-400 group-hover:text-gray-300"
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
      const neynarEndpoint = getNeynarCastThreadEndpoint({
        castHash: cast.hash,
        fid,
      });
      await fetch(neynarEndpoint)
        .then((response) => response.json())
        .then((resp) => {
          setCasts(resp.result.casts);
        })
        .catch((error) => {
          console.log({ error });
        })
        .finally(() => {
          setIsLoading(false);
        });
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

  const onOpenLinkInCast = () => {
    const castInThread = casts[selectedCastIdx];
    if (castInThread?.embeds?.length === 0) return;

    const url = castInThread.embeds[0].url;
    openWindow(url);
  };

  const renderRow = (
    cast: CastType & { children: CastType[] },
    idx: number,
    depth: number = 0
  ) => {
    const isRowSelected =
      selectedCastIdx === idx && selectedCastDepth === depth;

    return (
      <li
        key={`cast-thread-${cast.hash}`}
        className={classNames(idx === selectedCastIdx ? "" : "")}
      >
        <div className="relative px-4">
          {/* this is the left line */}
          {/* {idx !== casts.length - 1 ? (
            <span className="rounded-lg absolute left-12 top-10 ml-px h-[calc(100%-36px)] w-px" aria-hidden="true" />
          ) : null} */}
          <div
            className={classNames(
              "border-l-2",
              isActive && isRowSelected
                ? "border-transparent"
                : "border-transparent",
              "pl-3.5 relative flex items-start space-x-3"
            )}
          >
            <>
              <div
                className={classNames(
                  "absolute left-16 top-4 ml-1.5 w-0.5 h-[calc(100%-30px)]",
                  cast.children ? "bg-gray-600/50" : "bg-transparent"
                )}
              />
              <div className="min-w-0 flex-1">
                <CastRow
                  cast={cast}
                  showChannel={selectedChannelUrl === null}
                  isSelected={
                    selectedCastIdx === idx && selectedCastDepth === depth
                  }
                />
                {cast?.children && cast.children.length > 0 && depth < 2 && (
                  <SelectableListWithHotkeys
                    data={cast.children}
                    selectedIdx={selectedCastIdx}
                    setSelectedIdx={setSelectedCastIdx}
                    renderRow={(item: any, idx: number) =>
                      renderRow(item, idx, depth + 1)
                    }
                    onSelect={() => onOpenLinkInCast()}
                    onExpand={() => null}
                    isActive={isActive && selectedCastDepth === depth}
                    onDown={() => {
                      // if cast has children, increase depth and set select index to 0
                      // what is the current cast? we dont know
                    }}
                    onUp={() => console.log("onUp")}
                  />
                )}
              </div>
            </>
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
      onSelect={() => onOpenLinkInCast()}
      onExpand={() => null}
      isActive={isActive}
    />
  );

  const renderThread = () => (
    <div className="flow-root">
      {renderFeed()}
      {draftIdx !== -1 && (
        <div
          className="mt-4 ml-10 mr-4"
          key={`new-post-parentHash-${cast?.hash}`}
        >
          <NewPostEntry
            draft={draft}
            draftIdx={draftIdx}
            onPost={() => onBack && onBack()}
            hideChannel
            disableAutofocus
          />
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col text-gray-100 text-lg mb-8">
      {!isLoading && onBack && (
        <div className="mb-4">{renderGoBackButton()}</div>
      )}
      {isLoading ? <Loading /> : renderThread()}
    </div>
  );
};

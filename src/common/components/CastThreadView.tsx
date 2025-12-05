import React, { useEffect, useState } from 'react';
import { CastRow } from './CastRow';
import { ArrowLeftIcon } from '@heroicons/react/24/solid';
import { SelectableListWithHotkeys } from './SelectableListWithHotkeys';
import HotkeyTooltipWrapper from './HotkeyTooltipWrapper';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Button } from '@/components/ui/button';
import { CastWithInteractions } from '@neynar/nodejs-sdk/build/neynar-api/v2';
import { cn } from '@/lib/utils';
import { useDataStore } from '@/stores/useDataStore';
import SkeletonCastRow from './SkeletonCastRow';
import { useRouter } from 'next/navigation';

type CastThreadViewProps = {
  hash?: string;
  cast?: { hash: string; author: { fid: number } };
  onBack?: () => void;
  isActive?: boolean;
  onReply?: () => void;
  onQuote?: () => void;
  containerHeight?: string;
};

export const CastThreadView = ({ hash, cast, onBack, isActive, containerHeight = '100%' }: CastThreadViewProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [casts, setCasts] = useState<CastWithInteractions[]>([]);
  const [selectedCastIdx, setSelectedCastIdx] = useState(0);
  const { updateSelectedCast } = useDataStore();
  const router = useRouter();

  useEffect(() => {
    if (!cast || casts.length === 0) return;

    updateSelectedCast(casts[selectedCastIdx]);
  }, [cast, selectedCastIdx, casts]);

  useEffect(() => {
    if (selectedCastIdx === 0) {
      // Scroll the main content container instead of window
      const mainContainer = document.querySelector('.overflow-y-auto.no-scrollbar');
      if (mainContainer) {
        mainContainer.scrollTop = 0;
      }
    }
  }, [selectedCastIdx]);

  const renderGoBackButton = () => (
    <Button size="sm" variant="outline" onClick={() => onBack && onBack()} className="ml-2 max-w-fit group my-2">
      <Tooltip.Provider delayDuration={50} skipDelayDuration={0}>
        <HotkeyTooltipWrapper hotkey="Esc" side="right">
          <>
            <ArrowLeftIcon
              className="mr-1 mt-0.5 h-4 w-4 text-foreground/70 group-hover:text-foreground/80"
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

      try {
        const params = new URLSearchParams({
          identifier: threadHash,
          reply_depth: '1',
          include_chronological_parent_casts: 'true',
        });

        const response = await fetch(`/api/casts/conversation?${params.toString()}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch cast conversation: ${response.statusText}`);
        }

        const { conversation } = await response.json();
        if (conversation?.cast?.direct_replies) {
          const { direct_replies: replies, ...castObjectWithoutReplies } = conversation.cast;
          setCasts((conversation.chronological_parent_casts || []).concat([castObjectWithoutReplies].concat(replies)));
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

  const handleCastClick = (cast: CastWithInteractions) => {
    // Navigate to the conversation page for this cast
    router.push(`/conversation/${cast.hash}`);
  };

  const renderRow = (cast: CastWithInteractions, idx: number) => {
    const isRowSelected = selectedCastIdx === idx;

    return (
      <li
        key={`cast-thread-${cast.hash}`}
        className={cn(idx === selectedCastIdx ? '' : '')}
        onClick={() => setSelectedCastIdx(idx)}
      >
        <div className="relative pl-7">
          {/* this is the left line */}
          <div className={cn(idx === 0 ? '-ml-[31px]' : 'border-l-2', 'relative flex items-start border-muted')}>
            <div className="min-w-0 flex-1">
              {idx === 0 && (
                <div
                  className={cn(
                    isRowSelected ? 'bg-muted-foreground/50' : 'bg-foreground/10',
                    'absolute top-8 left-[31px] h-[calc(100%-32px)] w-0.5'
                  )}
                />
              )}
              <CastRow
                cast={cast}
                showChannel
                isSelected={selectedCastIdx === idx}
                isThreadView={idx > 0}
                onSelect={() => setSelectedCastIdx(idx)}
                onCastClick={() => handleCastClick(cast)}
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
      renderRow={(item: CastWithInteractions, idx: number) => renderRow(item, idx)}
      isActive={isActive}
      containerHeight={containerHeight}
      pinnedNavigation={true}
      footer={<div className="h-32" />}
    />
  );

  return (
    <div className="flex flex-col h-full w-full text-foreground/80 text-lg">
      {!isLoading && onBack && renderGoBackButton()}
      {isLoading ? <SkeletonCastRow className="m-4" /> : <div className="flex-1 w-full min-h-0">{renderFeed()}</div>}
    </div>
  );
};

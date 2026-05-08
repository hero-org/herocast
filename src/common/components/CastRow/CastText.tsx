import { ErrorBoundary } from '@sentry/react';
import Linkify from 'linkify-react';
import { useRouter } from 'next/navigation';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { HotkeyScopes } from '@/common/constants/hotkeys';
import { castTextStyle } from '@/common/helpers/css';
import { useAppHotkeys } from '@/common/hooks/useAppHotkeys';
import type { FarcasterCast } from '@/common/types/farcaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useAccountStore } from '@/stores/useAccountStore';
import HotkeyTooltipWrapper from '../HotkeyTooltipWrapper';
import { linkifyOptions } from './linkify';

const LINE_CLAMP_CLASS = {
  1: 'line-clamp-1',
  2: 'line-clamp-2',
  3: 'line-clamp-3',
  6: 'line-clamp-6',
} as const;

interface CastTextProps {
  cast: Pick<FarcasterCast, 'text'>;
  userFid: number;
  isEmbed: boolean;
  isSelected: boolean;
  effectiveIsExpanded: boolean;
  onToggleExpand: () => void;
  onCastClick?: () => void;
  onSelect?: () => void;
  lineClamp?: 1 | 2 | 3 | 6;
}

export const CastText: React.FC<CastTextProps> = ({
  cast,
  userFid,
  isEmbed,
  isSelected,
  effectiveIsExpanded,
  onToggleExpand,
  onCastClick,
  onSelect,
  lineClamp = 6,
}) => {
  const router = useRouter();
  const { setSelectedChannelByName } = useAccountStore();

  const textRef = useRef<HTMLDivElement>(null);
  const [needsTruncation, setNeedsTruncation] = useState(false);

  // Heuristic: text long enough that truncation is meaningful. Used to
  // decide whether to show the show-more / show-less toggle without
  // depending on a DOM measurement, which is unreliable while the text is
  // already expanded (scrollHeight equals clientHeight in that state, so
  // we'd lose the signal that the cast is "actually long" the moment it
  // expands). Threshold is conservative: short and one-paragraph casts
  // get no toggle; long casts always get one.
  const text = 'text' in cast && cast.text ? cast.text : '';
  const newlineCount = text.match(/\n/g)?.length ?? 0;
  const hasLongText = text.length > 280 || newlineCount >= 5;

  // Show the toggle when the text is long enough to benefit from truncation
  // — either because the DOM measurement says it's clipped right now, or
  // because the heuristic says it would clip if we collapsed it (covers the
  // case where the cast started in `defaultExpanded` mode).
  const showToggle = needsTruncation || (hasLongText && (effectiveIsExpanded || needsTruncation));

  // Hotkey for expanding/collapsing text (only for non-embeds)
  useAppHotkeys(
    'x',
    () => {
      if (showToggle) {
        onToggleExpand();
      }
    },
    {
      scopes: [HotkeyScopes.CAST_SELECTED],
      enabled: !isEmbed && isSelected && showToggle,
    },
    [isEmbed, isSelected, showToggle, onToggleExpand]
  );

  // Detect if text overflows (needs truncation). Skip while expanded — the
  // measurement is meaningless then (scrollHeight === clientHeight always),
  // and updating to `false` would hide the show-less toggle the user needs
  // to collapse a long cast they explicitly expanded.
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    if (effectiveIsExpanded) return;

    const checkTruncation = () => {
      // Compare scroll height vs client height to detect overflow
      // Add small buffer (2px) to avoid false positives from rounding
      const isTruncated = el.scrollHeight > el.clientHeight + 2;
      setNeedsTruncation(isTruncated);
    };

    // Initial check
    checkTruncation();

    // Use ResizeObserver to detect content changes
    const resizeObserver = new ResizeObserver(checkTruncation);
    resizeObserver.observe(el);

    return () => resizeObserver.disconnect();
  }, [cast.text, effectiveIsExpanded]);

  const processedText = useMemo(
    () =>
      'text' in cast && cast.text ? (
        <ErrorBoundary>
          <Linkify
            as="span"
            options={{
              ...linkifyOptions,
              attributes: { userFid, setSelectedChannelByName, router },
            }}
          >
            {cast.text.trimEnd()}{' '}
          </Linkify>
        </ErrorBoundary>
      ) : null,
    [cast.text, userFid, setSelectedChannelByName, router]
  );

  return (
    <>
      <div
        ref={textRef}
        onClick={(e) => {
          e.stopPropagation();
          if (onCastClick) {
            onCastClick();
          } else if (onSelect) {
            onSelect();
          }
        }}
        className={cn(
          'mt-2 w-full min-w-0 text-md text-foreground cursor-pointer break-words',
          !effectiveIsExpanded && LINE_CLAMP_CLASS[lineClamp]
        )}
        style={castTextStyle}
      >
        {processedText}
      </div>
      {showToggle && (
        <div className="w-full text-left">
          <TooltipProvider delayDuration={50}>
            <HotkeyTooltipWrapper hotkey={isEmbed ? '' : 'X'} side="right">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleExpand();
                }}
                className="text-muted-foreground hover:text-foreground text-sm hover:underline mt-1"
                aria-label={effectiveIsExpanded ? 'Collapse' : 'Expand'}
              >
                {effectiveIsExpanded ? 'show less' : 'read more...'}
              </button>
            </HotkeyTooltipWrapper>
          </TooltipProvider>
        </div>
      )}
    </>
  );
};

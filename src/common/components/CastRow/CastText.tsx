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

  // Hotkey for expanding/collapsing text (only for non-embeds)
  useAppHotkeys(
    'x',
    () => {
      if (needsTruncation || effectiveIsExpanded) {
        onToggleExpand();
      }
    },
    {
      scopes: [HotkeyScopes.CAST_SELECTED],
      enabled: !isEmbed && isSelected && (needsTruncation || effectiveIsExpanded),
    },
    [isEmbed, isSelected, needsTruncation, effectiveIsExpanded, onToggleExpand]
  );

  // Detect if text overflows (needs truncation)
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;

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
      {(needsTruncation || effectiveIsExpanded) && (
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

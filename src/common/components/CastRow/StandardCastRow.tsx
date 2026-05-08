import { useRouter } from 'next/navigation';
import React, { useCallback, useState } from 'react';
import type { ChannelType } from '@/common/constants/channels';
import { createEmbedCastId, createParentCastId } from '@/common/constants/farcaster';
import { HotkeyScopes } from '@/common/constants/hotkeys';
import { isNftSaleUrl, isSwapUrl } from '@/common/helpers/onchain';
import { useAppHotkeys } from '@/common/hooks/useAppHotkeys';
import type { FarcasterCast } from '@/common/types/farcaster';
import { useProfileByFid } from '@/hooks/queries/useProfile';
import { cn } from '@/lib/utils';
import { useAccountStore } from '@/stores/useAccountStore';
import { useDraftStore } from '@/stores/useDraftStore';
import { CastModalView, useNavigationStore } from '@/stores/useNavigationStore';
import { AccountPlatformType } from '../../constants/accounts';
import { useChannelLookup } from '../../hooks/useChannelLookup';
import { QuickListManageDialog } from '../QuickListManageDialog';
import { AuthorAvatar, AuthorHeader } from './Author';
import { CastText } from './CastText';
import { EmbedList, ExternalUrlReply } from './EmbedSection';
import { ReactionBar } from './ReactionBar';
import { RecastBadge } from './RecastBadge';

export interface CastRowProps {
  cast: FarcasterCast & {
    inclusion_context?: {
      is_following_recaster: boolean;
      is_following_author: boolean;
    };
  };
  showChannel?: boolean;
  onSelect?: () => void;
  isSelected?: boolean;
  isThreadView?: boolean;
  isEmbed?: boolean;
  hideReactions?: boolean;
  showParentDetails?: boolean;
  hideAuthor?: boolean;
  showAdminActions?: boolean;
  recastedByFid?: number;
  onCastClick?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  /**
   * When true, the locally-managed expansion state initializes to expanded.
   * Has no effect when `onToggleExpand` is provided (the parent owns expansion
   * in that case). Used by the preview pane so the user doesn't have to press
   * `x` to read past the 6-line truncation on every selection change.
   */
  defaultExpanded?: boolean;
}

const StandardCastRowComponent = ({
  cast,
  isSelected,
  showChannel,
  onSelect,
  isEmbed = false,
  hideReactions = false,
  showParentDetails = false,
  hideAuthor = false,
  showAdminActions = false,
  recastedByFid,
  onCastClick,
  isExpanded = false,
  onToggleExpand,
  defaultExpanded = false,
}: CastRowProps) => {
  const router = useRouter();
  const { accounts, selectedAccountIdx, setSelectedChannelUrl } = useAccountStore();

  const { setCastModalDraftId, setCastModalView, openNewCastModal, updateSelectedCast } = useNavigationStore();
  const { addNewPostDraft } = useDraftStore();

  // Fetch recaster profile if this cast was recasted by someone we're following
  const { data: recasterProfile } = useProfileByFid(recastedByFid, {
    enabled: !!recastedByFid,
  });

  const [isListDialogOpen, setIsListDialogOpen] = useState(false);

  // Local expansion state for embeds (when no onToggleExpand provided).
  // Seeded from `defaultExpanded` so the preview pane can render expanded
  // by default without forcing every cast row to manage state via prop.
  const [localExpanded, setLocalExpanded] = useState(defaultExpanded);
  // Use prop-based expansion if provided, otherwise use local state
  const effectiveIsExpanded = onToggleExpand ? isExpanded : localExpanded;
  const handleToggleExpand = onToggleExpand ?? (() => setLocalExpanded((prev) => !prev));

  const selectedAccount = accounts[selectedAccountIdx];
  const userFid = Number(selectedAccount?.platformAccountId);
  const canSendReaction = selectedAccount?.platform !== AccountPlatformType.farcaster_local_readonly;

  // Use on-demand channel lookup instead of loading all channels
  const parentUrl = cast.parent_url ?? null;
  const { channel: parentChannel } = useChannelLookup(parentUrl ?? undefined);

  // Detect if this cast is replying to an external URL (swap:// or nft-sale://)
  const isExternalUrlReply = Boolean(
    parentUrl && !cast.parent_hash && (isNftSaleUrl(parentUrl) || isSwapUrl(parentUrl))
  );

  const getChannelForParentUrl = useCallback(
    (url: string | null): ChannelType | undefined => (url === parentUrl ? parentChannel : undefined),
    [parentUrl, parentChannel]
  );

  const channel = showChannel && 'parent_url' in cast ? getChannelForParentUrl(cast.parent_url as string | null) : null;

  const onReply = () => {
    setCastModalView(CastModalView.Reply);
    updateSelectedCast(cast);
    addNewPostDraft({
      parentCastId: createParentCastId(cast.author.fid, cast.hash, 'CastRow.onReply'),
      onSuccess(draftId) {
        setCastModalDraftId(draftId);
        openNewCastModal();
      },
    });
  };

  const onQuote = () => {
    setCastModalView(CastModalView.Quote);
    updateSelectedCast(cast);
    addNewPostDraft({
      embeds: [
        {
          // Store hash as string for JSON serialization - will be converted to bytes in prepareCastBody
          castId: createEmbedCastId(cast.author.fid, cast.hash, 'CastRow.onQuote'),
        },
      ],
      onSuccess(draftId) {
        setCastModalDraftId(draftId);
        openNewCastModal();
      },
    });
  };

  // Hotkey for managing lists - kept on the composer because the QuickListManageDialog
  // it controls is rendered as a sibling of the cast content, not inside ReactionBar.
  useAppHotkeys(
    'm',
    () => {
      if (isSelected && 'author' in cast && cast.author.fid) {
        setIsListDialogOpen(true);
      }
    },
    {
      scopes: [HotkeyScopes.CAST_SELECTED],
      enabled: isSelected && 'author' in cast && !!cast.author.fid,
    },
    [isSelected, cast]
  );

  const renderCastContent = () => (
    <div className="flex flex-col w-full min-w-0">
      <div
        className={cn(
          isEmbed ? 'p-2' : 'p-3',
          isEmbed && !hideReactions && 'pb-0',
          isSelected && isEmbed ? 'bg-muted' : 'cursor-pointer',
          isSelected ? 'bg-muted border-l-1 border-foreground/20' : 'border-l-1 border-transparent',
          'lg:ml-0 grow rounded-r-sm hover:bg-muted'
        )}
      >
        <RecastBadge cast={cast} recastedByFid={recastedByFid} recasterProfile={recasterProfile} />
        <ExternalUrlReply
          parentUrl={parentUrl}
          isExternalUrlReply={isExternalUrlReply}
          isSelected={isSelected}
          isEmbed={isEmbed}
          hideAuthor={hideAuthor}
        />
        <div
          className={cn('flex items-start gap-x-2')}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (onCastClick) {
              onCastClick();
            } else if (onSelect) {
              onSelect();
            }
          }}
        >
          <AuthorAvatar cast={cast} isEmbed={isEmbed} hideAuthor={hideAuthor} />
          <div className="flex flex-col w-full min-w-0 space-y-1">
            <AuthorHeader
              cast={cast}
              userFid={userFid}
              isEmbed={isEmbed}
              hideAuthor={hideAuthor}
              showChannel={!!showChannel}
              showParentDetails={showParentDetails}
              showAdminActions={showAdminActions}
              channel={channel}
              selectedAccount={selectedAccount}
              onSelectChannelUrl={setSelectedChannelUrl}
            />
            <CastText
              cast={cast}
              userFid={userFid}
              isEmbed={isEmbed}
              isSelected={!!isSelected}
              effectiveIsExpanded={!!effectiveIsExpanded}
              onToggleExpand={handleToggleExpand}
              onCastClick={onCastClick}
              onSelect={onSelect}
            />
            {!isEmbed && <EmbedList cast={cast} isSelected={isSelected} hideReactions={hideReactions} />}
            {!hideReactions && (
              <ReactionBar
                cast={cast}
                isSelected={isSelected}
                userFid={userFid}
                canSendReaction={canSendReaction}
                onReply={onReply}
                onQuote={onQuote}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (isEmbed) {
    return (
      <div
        className="cursor-pointer"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('a')) return;
          router.push(`/conversation/${cast.hash}`);
        }}
      >
        {renderCastContent()}
      </div>
    );
  }

  return (
    <>
      {renderCastContent()}
      {'author' in cast && cast.author.fid && (
        <QuickListManageDialog
          open={isListDialogOpen}
          onOpenChange={setIsListDialogOpen}
          authorFid={cast.author.fid.toString()}
          authorUsername={cast.author.username || 'unknown'}
          authorDisplayName={cast.author.display_name || cast.author.username || 'Unknown'}
          authorAvatar={cast.author.pfp_url}
        />
      )}
    </>
  );
};

export const StandardCastRow = React.memo(StandardCastRowComponent, (prevProps, nextProps) => {
  // Custom comparison for better performance
  // Avoid JSON.stringify for reactions - use targeted shallow comparisons instead
  const prevReactions = prevProps.cast.reactions;
  const nextReactions = nextProps.cast.reactions;

  return (
    prevProps.cast.hash === nextProps.cast.hash &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.showChannel === nextProps.showChannel &&
    prevProps.isEmbed === nextProps.isEmbed &&
    prevProps.hideReactions === nextProps.hideReactions &&
    prevProps.recastedByFid === nextProps.recastedByFid &&
    // Targeted shallow comparisons for reaction counts
    prevReactions?.likes_count === nextReactions?.likes_count &&
    prevReactions?.recasts_count === nextReactions?.recasts_count &&
    // Compare array lengths for viewer context changes
    prevReactions?.likes?.length === nextReactions?.likes?.length &&
    prevReactions?.recasts?.length === nextReactions?.recasts?.length
  );
});

import { Copy, ExternalLink, MoreHorizontal, Trash2 } from 'lucide-react';
import Link from 'next/link';
import type React from 'react';
import { useMemo } from 'react';
import type { ChannelType } from '@/common/constants/channels';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { addToClipboard } from '../../helpers/clipboard';
import { removeCast } from '../../helpers/farcaster';
import { toastCopiedToClipboard, toastSuccessCastDeleted, toastUnableToDeleteCast } from '../../helpers/toast';
import { CastTime } from './CastTime';
import { MemoizedProfileHoverCard } from './linkify';
import type { CastWithInclusionContext } from './RecastBadge';

type SelectedAccount =
  | {
      id: string;
    }
  | undefined;

const AVATAR_SIZE_CLASS = { md: 'h-10 w-10', sm: 'h-8 w-8' } as const;

interface AuthorAvatarProps {
  cast: CastWithInclusionContext;
  isEmbed: boolean;
  hideAuthor: boolean;
  size?: 'sm' | 'md';
}

export const AuthorAvatar: React.FC<AuthorAvatarProps> = ({ cast, isEmbed, hideAuthor, size = 'md' }) => {
  if (isEmbed || hideAuthor) return null;
  const username = cast.author.username;
  return (
    <Link href={`/profile/${username}`} prefetch={false} className="flex shrink-0">
      <Avatar className={`relative ${AVATAR_SIZE_CLASS[size]} mr-1`}>
        <AvatarImage src={cast.author.pfp_url} />
        <AvatarFallback>{username?.slice(0, 2)}</AvatarFallback>
      </Avatar>
    </Link>
  );
};

const ChannelButton: React.FC<{
  showChannel: boolean;
  channel?: ChannelType | null;
  onSelectChannelUrl: (url: string) => void;
}> = ({ showChannel, channel, onSelectChannelUrl }) => {
  if (!showChannel || !channel) return null;
  return (
    <Badge
      className="truncate items-top bg-channel/10 hover:bg-channel/20 text-channel border-channel/20 shadow-none"
      onClick={() => onSelectChannelUrl(channel.url)}
    >
      {channel.name}
    </Badge>
  );
};

const AdminActions: React.FC<{
  cast: CastWithInclusionContext;
  selectedAccount: SelectedAccount;
}> = ({ cast, selectedAccount }) => {
  const actions = [
    {
      key: 'delete',
      isDialog: true,
      label: 'Delete',
      icon: <Trash2 className="h-4 w-4 mr-1" />,
      content: (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you sure?</DialogTitle>
            <DialogDescription>Do you want to permanently delete this cast?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose>
              <Button
                variant="destructive"
                type="submit"
                onClick={() => {
                  if (!selectedAccount) {
                    toastUnableToDeleteCast();
                    return;
                  }

                  removeCast(selectedAccount.id, cast.hash).then(() => {
                    toastSuccessCastDeleted(cast?.text);
                  });
                }}
              >
                Confirm
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      ),
    },
    {
      key: 'copy-cast-link',
      label: 'Copy cast link',
      icon: <Copy className="h-4 w-4 mr-1" />,
      onClick: () => {
        const url = `${process.env.NEXT_PUBLIC_URL}/conversation/${cast.hash}`;
        addToClipboard(url);
        toastCopiedToClipboard(url);
      },
    },
    {
      key: 'copy-cast-hash',
      label: 'Copy cast hash',
      icon: <Copy className="h-4 w-4 mr-1" />,
      onClick: () => {
        addToClipboard(cast.hash);
        toastCopiedToClipboard(cast.hash);
      },
    },
  ];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild className="ml-1">
        <Button size="icon" variant="outline" className="rounded-full h-6 w-6">
          <MoreHorizontal className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <Dialog>
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {actions.map(({ key, label, icon, onClick, isDialog }) => {
            if (isDialog) {
              return (
                <DialogTrigger key={`dialog-trigger-${key}`} asChild>
                  <DropdownMenuItem key={key} onSelect={(e) => e.preventDefault()}>
                    {icon}
                    {label}
                  </DropdownMenuItem>
                </DialogTrigger>
              );
            }
            return (
              <DropdownMenuItem key={key} onClick={onClick}>
                {icon}
                {label}
              </DropdownMenuItem>
            );
          })}
          {actions.map(({ content }) => content)}
        </Dialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

interface AuthorHeaderProps {
  cast: CastWithInclusionContext;
  userFid: number;
  isEmbed: boolean;
  hideAuthor: boolean;
  showChannel: boolean;
  showParentDetails: boolean;
  showAdminActions: boolean;
  channel?: ChannelType | null;
  selectedAccount: SelectedAccount;
  onSelectChannelUrl: (url: string) => void;
}

export const AuthorHeader: React.FC<AuthorHeaderProps> = ({
  cast,
  userFid,
  isEmbed,
  hideAuthor,
  showChannel,
  showParentDetails,
  showAdminActions,
  channel,
  selectedAccount,
  onSelectChannelUrl,
}) => {
  const authorInfo = useMemo(
    () => ({
      pfpUrl: cast.author.pfp_url,
      username: cast.author.username,
      displayName: cast.author.display_name || cast.author.username,
    }),
    [cast.author]
  );

  return (
    <>
      <div className="flex flex-row flex-wrap justify-between gap-x-4 leading-5">
        <div className="flex flex-row">
          {hideAuthor ? (
            <span className="text-sm leading-5 text-foreground/60">{authorInfo.username}</span>
          ) : (
            <MemoizedProfileHoverCard fid={cast.author.fid} viewerFid={userFid} username={authorInfo.username}>
              <span className="items-center flex font-semibold text-foreground truncate cursor-pointer w-full max-w-54 lg:max-w-full">
                {isEmbed && (
                  <Avatar className="relative h-4 w-4 mr-1">
                    <AvatarImage src={authorInfo.pfpUrl} />
                    <AvatarFallback>{cast.author.username?.slice(0, 2)}</AvatarFallback>
                  </Avatar>
                )}
                {authorInfo.username}
              </span>
            </MemoizedProfileHoverCard>
          )}
          <div className="hidden lg:ml-2 lg:block">
            <ChannelButton showChannel={showChannel} channel={channel} onSelectChannelUrl={onSelectChannelUrl} />
          </div>
        </div>
        <div className="flex flex-row">
          <div className="block mr-2 lg:hidden">
            <ChannelButton showChannel={showChannel} channel={channel} onSelectChannelUrl={onSelectChannelUrl} />
          </div>
          <CastTime timestamp={cast.timestamp} />
          <Link
            href={`${process.env.NEXT_PUBLIC_URL}/conversation/${cast.hash}`}
            className="text-sm leading-5 text-foreground/60"
            tabIndex={-1}
            prefetch={false}
          >
            <ExternalLink className="mt-0.5 w-4 h-4 ml-1.5" />
          </Link>
          {showAdminActions && <AdminActions cast={cast} selectedAccount={selectedAccount} />}
        </div>
      </div>
      {showParentDetails && cast?.parent_hash && (
        <div className="flex flex-row items-center">
          <span className="text-sm text-foreground/60">{cast.parent_hash && 'Replying'}</span>
        </div>
      )}
    </>
  );
};

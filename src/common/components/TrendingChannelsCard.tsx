import { Hash } from 'lucide-react';
import type { FarcasterChannel } from '@/common/types/farcaster';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTrendingChannels } from '@/hooks/queries/useChannelQueries';
import { useAccountStore } from '@/stores/useAccountStore';
import { useListStore } from '@/stores/useListStore';
import { formatLargeNumber } from '../helpers/text';

const TRENDING_CHANNELS_LIMIT = 8;

const TrendingChannelsCard = () => {
  const { data: channels, isLoading } = useTrendingChannels({ limit: TRENDING_CHANNELS_LIMIT });
  const { setSelectedChannelUrl } = useAccountStore();
  const { setSelectedListId } = useListStore();

  const onSelectChannel = (channel: FarcasterChannel) => {
    setSelectedChannelUrl(channel.parent_url || channel.url);
    setSelectedListId(undefined);
  };

  const renderLoadingState = () => (
    <ul className="flex flex-col gap-1">
      {Array.from({ length: 5 }).map((_, idx) => (
        <li key={`trending-channel-skeleton-${idx}`} className="flex items-center gap-3 px-2 py-1.5">
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        </li>
      ))}
    </ul>
  );

  const renderEmptyState = () => (
    <p className="px-2 py-4 text-sm text-muted-foreground">No trending channels right now.</p>
  );

  const renderChannels = (items: FarcasterChannel[]) => (
    <ul className="flex flex-col gap-0.5">
      {items.map((channel) => (
        <li key={channel.id}>
          <button
            type="button"
            onClick={() => onSelectChannel(channel)}
            className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent"
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={channel.image_url || channel.icon_url} alt={channel.name} />
              <AvatarFallback className="bg-channel/10 text-channel">
                <Hash className="h-4 w-4" aria-hidden="true" />
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium text-channel">{channel.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {formatLargeNumber(channel.member_count)} members
              </span>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="mx-auto max-w-7xl px-6 lg:px-8 mt-8">
      <div className="mx-auto max-w-2xl lg:mx-0">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Trending channels</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoading
              ? renderLoadingState()
              : channels && channels.length > 0
                ? renderChannels(channels)
                : renderEmptyState()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TrendingChannelsCard;

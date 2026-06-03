'use client';

import { useRouter } from 'next/navigation';
import { Loading } from '@/common/components/Loading';
import { formatLargeNumber } from '@/common/helpers/text';
import type { FarcasterChannel } from '@/common/types/farcaster';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useUserChannels } from '@/hooks/queries/useChannelQueries';
import { useAccountStore } from '@/stores/useAccountStore';
import { useListStore } from '@/stores/useListStore';

type ProfileChannelsProps = {
  fid?: number;
};

const ProfileChannels = ({ fid }: ProfileChannelsProps) => {
  const { data: channels, isLoading } = useUserChannels(fid, { enabled: !!fid });
  const router = useRouter();
  const { setSelectedChannelUrl } = useAccountStore();
  const { setSelectedListId } = useListStore();

  // Open the channel's feed inside herocast (same nav pattern as
  // TrendingChannelsCard) rather than linking out to Warpcast.
  const onSelectChannel = (channel: FarcasterChannel) => {
    setSelectedChannelUrl(channel.parent_url || channel.url);
    setSelectedListId(undefined);
    router.push('/feeds');
  };

  if (isLoading) {
    return <Loading />;
  }

  if (!channels || channels.length === 0) {
    return <p className="text-foreground/60 py-8 text-center">No channels yet.</p>;
  }

  return (
    <ul role="list" className="max-w-full md:max-w-2xl">
      {channels.map((channel) => (
        <li key={channel.id} className="border-b border-border">
          <button
            type="button"
            onClick={() => onSelectChannel(channel)}
            className="flex w-full items-center gap-x-3 px-2 py-3 hover:bg-sidebar/40 rounded-lg text-left"
          >
            <Avatar className="h-10 w-10 flex-none">
              <AvatarImage src={channel.image_url || channel.icon_url} alt={channel.name} />
              <AvatarFallback>{channel.name.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground truncate">{channel.name}</p>
              <p className="text-sm text-foreground/60 truncate">/{channel.id}</p>
            </div>
            {channel.member_count !== undefined && (
              <span className="text-sm text-foreground/60 flex-none">
                {formatLargeNumber(channel.member_count)} members
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
};

export default ProfileChannels;

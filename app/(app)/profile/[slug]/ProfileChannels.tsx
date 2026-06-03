'use client';

import { Loading } from '@/common/components/Loading';
import { formatLargeNumber } from '@/common/helpers/text';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useUserChannels } from '@/hooks/queries/useChannelQueries';

type ProfileChannelsProps = {
  fid?: number;
};

const getChannelUrl = (channel: { id: string; url?: string }) => `https://warpcast.com/~/channel/${channel.id}`;

const ProfileChannels = ({ fid }: ProfileChannelsProps) => {
  const { data: channels, isLoading } = useUserChannels(fid, { enabled: !!fid });

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
          <a
            href={getChannelUrl(channel)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-x-3 px-2 py-3 hover:bg-sidebar/40 rounded-lg"
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
          </a>
        </li>
      ))}
    </ul>
  );
};

export default ProfileChannels;

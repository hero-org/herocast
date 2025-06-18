import React, { useState, useEffect } from 'react';
import { CommandItem } from '@/components/ui/command';
import { MagnifyingGlassIcon } from '@heroicons/react/20/solid';
import { useRouter } from 'next/router';
import { useAccountStore } from '@/stores/useAccountStore';
import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import { Channel } from '@neynar/nodejs-sdk/build/neynar-api/v2';
import { Skeleton } from '@/components/ui/skeleton';

interface ChannelSearchCommandProps {
  query: string;
}

const neynarClient = new NeynarAPIClient(process.env.NEXT_PUBLIC_NEYNAR_API_KEY!);

export const ChannelSearchCommand: React.FC<ChannelSearchCommandProps> = ({ query }) => {
  const router = useRouter();
  const { setSelectedChannelUrl } = useAccountStore();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!query || query.length < 2) {
      setChannels([]);
      return;
    }

    const searchChannels = async () => {
      setIsLoading(true);
      try {
        const result = await neynarClient.searchChannels(query);
        setChannels(result.channels || []);
      } catch (error) {
        console.error('Failed to search channels:', error);
        setChannels([]);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(searchChannels, 300);
    return () => clearTimeout(debounceTimer);
  }, [query]);

  if (!query || query.length < 2) return null;

  if (isLoading) {
    return (
      <CommandItem disabled>
        <MagnifyingGlassIcon className="h-5 w-5 flex-none text-foreground/80 mr-2" />
        <span className="ml-2">Searching channels...</span>
      </CommandItem>
    );
  }

  if (channels.length === 0) {
    return (
      <CommandItem disabled>
        <MagnifyingGlassIcon className="h-5 w-5 flex-none text-foreground/80 mr-2" />
        <span className="ml-2">No channels found for &quot;{query}&quot;</span>
      </CommandItem>
    );
  }

  return (
    <>
      {channels.slice(0, 5).map((channel) => (
        <CommandItem
          key={channel.id}
          value={`channel-${channel.id}`}
          onSelect={() => {
            setSelectedChannelUrl(channel.parent_url || channel.url);
            router.push('/feeds');
          }}
          className="flex items-center py-1.5 rounded-lg"
        >
          {channel.image_url ? (
            <img
              src={channel.image_url}
              alt=""
              className="mr-2 h-5 w-5 flex-none rounded-full"
            />
          ) : (
            <Skeleton className="mr-2 h-5 w-5 flex-none rounded-full" />
          )}
          <span className="ml-2 flex-auto truncate">Go to /{channel.id} channel</span>
        </CommandItem>
      ))}
    </>
  );
};
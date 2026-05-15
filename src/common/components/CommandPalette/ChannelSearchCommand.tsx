import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type React from 'react';
import { useEffect, useState } from 'react';
import type { FarcasterChannel } from '@/common/types/farcaster';
import { CommandItem } from '@/components/ui/command';
import { Skeleton } from '@/components/ui/skeleton';
import { getProvider } from '@/lib/farcaster/providers';
import { useAccountStore } from '@/stores/useAccountStore';
import { useNavigationStore } from '@/stores/useNavigationStore';

interface ChannelSearchCommandProps {
  query: string;
}

export const ChannelSearchCommand: React.FC<ChannelSearchCommandProps> = ({ query }) => {
  const router = useRouter();
  const { setSelectedChannelUrl } = useAccountStore();
  const [channels, setChannels] = useState<FarcasterChannel[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!query || query.length < 2) {
      setChannels([]);
      return;
    }

    const searchChannels = async () => {
      setIsLoading(true);
      try {
        const channels = await getProvider().searchChannels({ q: query });
        setChannels(channels);
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
        <Search className="h-5 w-5 flex-none text-foreground/80 mr-2" />
        <span className="ml-2">Searching channels...</span>
      </CommandItem>
    );
  }

  if (channels.length === 0) {
    return (
      <CommandItem disabled>
        <Search className="h-5 w-5 flex-none text-foreground/80 mr-2" />
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
            // Close command palette
            const { toggleCommandPalette } = useNavigationStore.getState();
            toggleCommandPalette();
          }}
          className="flex items-center py-1.5 rounded-lg"
        >
          {channel.image_url ? (
            <img src={channel.image_url} alt="" className="mr-2 h-5 w-5 flex-none rounded-full" />
          ) : (
            <Skeleton className="mr-2 h-5 w-5 flex-none rounded-full" />
          )}
          <span className="ml-2 flex-auto truncate">Go to /{channel.id} channel</span>
        </CommandItem>
      ))}
    </>
  );
};

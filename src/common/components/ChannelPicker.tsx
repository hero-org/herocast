import type { Channel } from '@neynar/nodejs-sdk/build/neynar-api/v2';
import { Cross2Icon, PersonIcon } from '@radix-ui/react-icons';
import Fuse from 'fuse.js';
import { take } from 'lodash';
import orderBy from 'lodash.orderby';
import uniqBy from 'lodash.uniqby';
import * as React from 'react';
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatLargeNumber } from '../helpers/text';

// Strip URL scheme for better Fuse.js matching
const stripUrlScheme = (url: string | undefined): string => {
  if (!url) return '';
  return url.replace(/^https?:\/\//, '');
};

// Default "Home" channel when no channel is selected
const HOME_CHANNEL: Channel = {
  id: 'home',
  name: 'Home',
  object: 'channel',
  image_url: 'https://warpcast.com/~/channel-images/home.png',
  parent_url: undefined,
} as Channel;

type Props = {
  getChannels: (query: string) => Promise<Channel[]>;
  onSelect: (value: Channel | undefined) => void;
  value?: Channel;
  initialChannels?: Channel[];
  disabled?: boolean;
  /** Show only icon without text label */
  compact?: boolean;
};

export function ChannelPicker(props: Props) {
  const { getChannels, onSelect } = props;
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [isPending, setIsPending] = React.useState(false);

  // Deduplicate initial channels by parent_url to avoid React key conflicts
  const [channels, setChannels] = React.useState<Channel[]>(uniqBy(props.initialChannels ?? [], 'parent_url'));

  const setChannelResults = (newChannels: Channel[]) => {
    setChannels(uniqBy(newChannels, 'parent_url'));
  };

  // Track current search request to handle race conditions
  const abortControllerRef = useRef<AbortController | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear any pending debounce timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.length < 2) return;

    // Debounce the search by 300ms
    searchTimeoutRef.current = setTimeout(async () => {
      // Cancel any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      try {
        setIsPending(true);
        const results = await getChannels(query);
        // Only update if this request wasn't aborted
        if (!abortControllerRef.current?.signal.aborted) {
          setChannelResults(results);
        }
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          console.error(e);
        }
      } finally {
        if (!abortControllerRef.current?.signal.aborted) {
          setIsPending(false);
        }
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, getChannels]);

  useEffect(() => {
    // Reset query when popover opens to avoid stale search state
    if (open) {
      setQuery('');
    }
  }, [open]);

  const handleSelect = React.useCallback(
    (channel: Channel) => {
      setOpen(false);
      onSelect(channel);
    },
    [onSelect, setOpen]
  );

  const filteredChannels = React.useMemo((): Channel[] => {
    if (channels.length === 0) return [];
    if (!query) {
      // Show all channels (user pinned + top channels), scrollable
      return channels;
    }

    // Create Fuse instance inside memo with correct field names
    // Use getFn to strip URL scheme for better matching
    const fuse = new Fuse(channels, {
      keys: ['name', 'id'],
      getFn: (obj, path) => {
        const key = Array.isArray(path) ? path[0] : path;
        if (key === 'id') {
          // Also search in stripped parent_url for broader matches
          const parentUrl = stripUrlScheme((obj as Channel).parent_url);
          return [(obj as Channel).id || '', parentUrl];
        }
        return ((obj as Channel)[key as keyof Channel] as string) || '';
      },
      threshold: 0.3,
    });

    const results = fuse.search(query).map((result) => result.item);
    return take(orderBy(results, 'follower_count', 'desc'), 10);
  }, [query, channels]);

  // Use HOME_CHANNEL as fallback when value is undefined
  const displayChannel = props.value ?? HOME_CHANNEL;
  const isHomeChannel = !props.value || props.value.id === 'home' || !props.value.parent_url;

  const handleClear = React.useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect(undefined);
    },
    [onSelect]
  );

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          className={props.compact ? 'h-8 w-8 p-0' : 'h-9 px-4'}
          disabled={props.disabled}
          variant={props.compact ? 'ghost' : 'outline'}
          role="combobox"
          aria-expanded={open}
          type="button"
          title={displayChannel.name}
        >
          {displayChannel.image_url ? (
            <img
              src={displayChannel.image_url}
              alt={displayChannel.name}
              width={24}
              height={24}
              className={props.compact ? 'h-4 w-4 rounded' : 'h-4 w-4 mr-2 -ml-2 rounded'}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : null}
          <div
            className={`h-4 w-4 rounded bg-muted ${props.compact ? '' : 'mr-2 -ml-2'} ${displayChannel.image_url ? 'hidden' : ''}`}
          />
          {!props.compact && displayChannel.name}
          {!props.compact && !isHomeChannel && !props.disabled && (
            <Cross2Icon className="ml-2 h-3 w-3 text-muted-foreground hover:text-foreground" onClick={handleClear} />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0 z-[100]" align="start" side="top" avoidCollisions={false}>
        <Command>
          <CommandInput placeholder="Search Channels" value={query} onValueChange={(e) => setQuery(e)} />
          <CommandList>
            <CommandEmpty>{isPending ? 'Searching...' : 'No channels found.'}</CommandEmpty>
            <CommandGroup>
              {(channels.length === 0 ? [displayChannel] : filteredChannels).map((channel, idx) => (
                <CommandItem
                  key={channel?.parent_url || channel?.id || `channel-${idx}`}
                  value={channel?.name || 'home'}
                  className="cursor-pointer"
                  onSelect={() => channel && handleSelect(channel)}
                >
                  {channel?.image_url ? (
                    <img
                      src={channel.image_url}
                      alt={channel.name}
                      width={24}
                      height={24}
                      className="mr-2 rounded-lg h-6 w-6"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <div
                    className={`h-6 w-6 mr-2 rounded-lg bg-muted flex-shrink-0 ${channel?.image_url ? 'hidden' : ''}`}
                  />
                  {channel?.name || 'Home'}
                  {channel?.follower_count && (
                    <span className="ml-1 border-l border-foreground/10 text-foreground/60">
                      {' '}
                      <PersonIcon className="ml-1 mb-1 h-3 w-3 inline" /> {formatLargeNumber(channel.follower_count)}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

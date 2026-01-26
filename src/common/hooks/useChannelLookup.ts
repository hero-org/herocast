import { useEffect, useState } from 'react';
import type { ChannelType } from '../constants/channels';
import { createClient } from '../helpers/supabase/component';

// Simple in-memory cache for recently looked up channels
const channelCache = new Map<string, ChannelType>();
const CACHE_SIZE = 100;

export const useChannelLookup = (url?: string) => {
  const [channel, setChannel] = useState<ChannelType | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!url) return;

    // Check cache first
    if (channelCache.has(url)) {
      setChannel(channelCache.get(url));
      return;
    }

    // Fetch from database
    const fetchChannel = async () => {
      setIsLoading(true);
      try {
        const supabase = createClient();
        const { data, error } = await supabase.from('channel').select('*').eq('url', url).maybeSingle();

        if (data && !error) {
          // Add to cache (LRU eviction when full)
          if (channelCache.size >= CACHE_SIZE) {
            const firstKey = channelCache.keys().next().value;
            if (firstKey) channelCache.delete(firstKey);
          }
          const channel: ChannelType = {
            id: data.id,
            name: data.name ?? '',
            url: data.url ?? '',
            description: data.description ?? undefined,
            icon_url: data.icon_url ?? undefined,
            source: data.source ?? undefined,
            data: data.data as ChannelType['data'],
          };
          channelCache.set(url, channel);
          setChannel(channel);
        }
      } catch (error) {
        console.warn('Failed to fetch channel for URL:', url, error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchChannel();
  }, [url]);

  return { channel, isLoading };
};

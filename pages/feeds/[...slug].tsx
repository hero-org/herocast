import React, { useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useAccountStore } from '@/stores/useAccountStore';
import { useListStore } from '@/stores/useListStore';
import FeedsComponent from '.';
import { UUID } from 'crypto';

export default function FeedsPage() {
  console.log('FeedsPage');
  const router = useRouter();
  const { slug } = router.query;
  const { allChannels, selectedChannelUrl, setSelectedChannelUrl, setSelectedChannelByName } = useAccountStore();
  const { selectedListId, setSelectedListId } = useListStore();

  const handleSlugChange = useCallback((newSlug: string[]) => {
    if (newSlug[0] === 'trending') {
      return { newChannelUrl: 'trending', newListId: undefined };
    } else if (newSlug[0] === 'following') {
      return { newChannelUrl: 'following', newListId: undefined };
    } else if (newSlug[0] === 'channel' && newSlug[1]) {
      return { newChannelUrl: newSlug[1], newListId: undefined };
    } else if (newSlug[0] === 'list' && newSlug[1]) {
      return { newChannelUrl: undefined, newListId: newSlug[1] as UUID };
    }
    return { newChannelUrl: undefined, newListId: undefined };
  }, []);

  useEffect(() => {
    if (slug && Array.isArray(slug)) {
      const { newChannelUrl, newListId } = handleSlugChange(slug);
      if (newChannelUrl) {
        setSelectedChannelUrl(newChannelUrl);
        if (newChannelUrl !== 'trending' && newChannelUrl !== 'following') {
          setSelectedChannelByName(newChannelUrl);
        }
      }
      if (newListId) {
        setSelectedListId(newListId);
      }
    }
  }, [slug, handleSlugChange, setSelectedChannelUrl, setSelectedChannelByName, setSelectedListId]);

  useEffect(() => {
    const updateUrl = () => {
      if (selectedChannelUrl === 'trending') {
        router.push('/feeds/trending', undefined, { shallow: true });
      } else if (selectedChannelUrl === 'following') {
        router.push('/feeds/following', undefined, { shallow: true });
      } else if (selectedChannelUrl) {
        const channel = allChannels?.find((channel) => channel.url === selectedChannelUrl);
        if (channel) {
          router.push(`/feeds/channel/${channel.name}`, undefined, { shallow: true });
        } else {
          console.error(`Couldn't find channel with url ${selectedChannelUrl} in allChannels`);
        }
      } else if (selectedListId) {
        router.push(`/feeds/list/${selectedListId}`, undefined, { shallow: true });
      }
    };

    // Use a timeout to ensure this runs after the state has been updated
    const timeoutId = setTimeout(updateUrl, 0);

    return () => clearTimeout(timeoutId);
  }, [selectedChannelUrl, selectedListId, router, allChannels]);

  return <FeedsComponent />;
}

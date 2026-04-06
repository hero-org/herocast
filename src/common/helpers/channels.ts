import type { FarcasterChannel } from '@/common/types/farcaster';
import type { ChannelType } from '../constants/channels';

/**
 * Converts a database ChannelType to Neynar Channel format.
 *
 * Database stores `icon_url`, but Neynar API and ChannelPicker expect `image_url`.
 * This function handles that conversion.
 */
export function toNeynarChannel(dbChannel: ChannelType & { idx?: number }): FarcasterChannel {
  return {
    id: dbChannel.name,
    name: dbChannel.name,
    url: dbChannel.url,
    image_url: dbChannel.icon_url || '',
    parent_url: dbChannel.url,
    object: 'channel',
    created_at: 0,
    follower_count: dbChannel.data?.followerCount,
  } as FarcasterChannel;
}

/**
 * Converts an array of database channels to Neynar format.
 */
export function toNeynarChannels(dbChannels: (ChannelType & { idx?: number })[]): FarcasterChannel[] {
  return dbChannels.map(toNeynarChannel);
}

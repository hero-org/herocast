import type { Channel } from '@neynar/nodejs-sdk/build/neynar-api/v2';

/**
 * Top 10 Farcaster channels by follower count + activity.
 * Used as default channels in ChannelPicker when user has no pinned channels.
 * Update periodically by running: curl "https://api.neynar.com/v2/farcaster/channel/trending?time_window=30d&limit=10"
 */
export const TOP_CHANNELS: Partial<Channel>[] = [
  {
    id: 'farcaster',
    name: 'Farcaster',
    image_url: 'https://imagedelivery.net/BXluQx4ige9GuW0Ia56BHw/51ffff68-b05c-4465-37a3-38e0c9a21300/original',
    parent_url: 'chain://eip155:7777777/erc721:0x4f86113fc3e9783cf3ec9a552cbb566716a57628',
    object: 'channel',
  },
  {
    id: 'base',
    name: 'Base',
    image_url: 'https://warpcast.com/~/channel-images/base.png',
    parent_url: 'https://onchainsummer.xyz',
    object: 'channel',
  },
  {
    id: 'memes',
    name: 'Memes',
    image_url: 'https://i.imgur.com/YePqTgG.png',
    parent_url: 'chain://eip155:7777777/erc721:0xfd8427165df67df6d7fd689ae67c8ebf56d9ca61',
    object: 'channel',
  },
  {
    id: 'founders',
    name: 'Founders',
    image_url: 'https://warpcast.com/~/channel-images/founders.png',
    parent_url: 'https://farcaster.group/founders',
    object: 'channel',
  },
  {
    id: 'dev',
    name: 'Dev',
    image_url: 'https://warpcast.com/~/channel-images/dev.png',
    parent_url: 'chain://eip155:1/erc721:0x7dd4e31f1530ac682c8ea4d8016e95773e08d8b0',
    object: 'channel',
  },
  {
    id: 'art',
    name: 'Art',
    image_url: 'https://i.imgur.com/MWoWpTI.png',
    parent_url: 'chain://eip155:7777777/erc721:0xe96c21b136a477a6a97332694f0caae9fbb05571',
    object: 'channel',
  },
  {
    id: 'design',
    name: 'Design',
    image_url: 'https://warpcast.com/~/channel-images/design.png',
    parent_url: 'https://warpcast.com/~/channel/design',
    object: 'channel',
  },
];

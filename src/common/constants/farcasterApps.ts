export type FarcasterApp = {
  fid: number;
  name: string;
  url?: string;
};

export const KNOWN_FARCASTER_APPS: Record<number, FarcasterApp> = {
  9152: {
    fid: 9152,
    name: 'Warpcast',
    url: 'https://warpcast.com',
  },
  18665: {
    fid: 18665,
    name: 'herocast',
    url: 'https://herocast.xyz',
  },
  6131: {
    fid: 6131,
    name: 'Neynar',
    url: 'https://neynar.com',
  },
  309857: {
    fid: 309857,
    name: 'Base',
    url: 'https://base.org',
  },
  827605: {
    fid: 827605,
    name: 'Zapper',
    url: 'https://zapper.xyz',
  },
  12312: {
    fid: 12312,
    name: 'Paragraph',
    url: 'https://paragraph.xyz',
  },
  19150: {
    fid: 19150,
    name: 'Flink',
    url: 'https://flink.fyi',
  },
  1129: {
    fid: 1129,
    name: 'Yup',
    url: 'https://yup.io',
  },
};

export function getAppByFid(fid: number): FarcasterApp | undefined {
  return KNOWN_FARCASTER_APPS[fid];
}

export type VerifiedAccountPlatform = 'x' | 'github' | 'discord';

export const VERIFIED_ACCOUNT_PLATFORMS: Record<
  VerifiedAccountPlatform,
  {
    name: string;
    urlPrefix: string;
  }
> = {
  x: {
    name: 'X',
    urlPrefix: 'https://x.com/',
  },
  github: {
    name: 'GitHub',
    urlPrefix: 'https://github.com/',
  },
  discord: {
    name: 'Discord',
    urlPrefix: '',
  },
};

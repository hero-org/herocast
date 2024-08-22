import { UUID } from 'crypto';

export type ChannelType = {
  id: UUID;
  name: string;
  url: string;
  icon_url?: string;
  source?: string;
  description?: string;
  data?: {
    leadFid?: string;
    moderatorFid?: string;
    followerCount?: number;
  };
};

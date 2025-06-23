import React, { useEffect } from 'react';
import { fetchAndAddUserProfile, shouldUpdateProfile } from '../helpers/profileUtils';
import { useDataStore } from '@/stores/useDataStore';
import get from 'lodash.get';
import Link from 'next/link';
import ProfileInfoContent from './ProfileInfoContent';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { take } from 'lodash';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatLargeNumber } from '../helpers/text';

const priorityChannels = ['email', 'linkedin', 'telegram', 'twitter', 'github'];

const ProfileInfo = ({
  fid,
  viewerFid,
  showFollowButton,
  showFullInfo,
  hideBio = false,
  wideFormat = false,
}: {
  fid: number;
  viewerFid: number;
  showFollowButton?: boolean;
  showFullInfo?: boolean;
  hideBio?: boolean;
  wideFormat?: boolean;
}) => {
  const profile = useDataStore((state) => get(state.fidToData, fid));

  useEffect(() => {
    if (shouldUpdateProfile(profile)) {
      fetchAndAddUserProfile({ fid, viewerFid });
    }
  }, [fid, viewerFid, profile]);

  const shouldRenderFullInfo = showFullInfo && profile?.icebreakerSocialInfo;

  const renderIcebreakerCredentials = () => {
    if (!profile?.icebreakerSocialInfo?.credentials?.length) return null;

    return (
      <div className="mt-2">
        <span className="text-sm text-foreground">Icebreaker Credentials</span>
        <div className="mt-2 flex flex-wrap gap-1">
          {take(profile.icebreakerSocialInfo.credentials, 5).map((credential) => (
            <span
              key={`${fid}-${credential.name}`}
              className="h-6 rounded-lg px-1 border border-foreground/20 text-xs text-muted-foreground flex items-center"
            >
              {credential.name}
            </span>
          ))}
        </div>
      </div>
    );
  };

  const renderIcebreakerChannels = () => {
    if (!profile?.icebreakerSocialInfo?.channels?.length) return null;

    const filteredChannels = profile.icebreakerSocialInfo.channels.filter(
      (channel) => channel.value && priorityChannels.includes(channel.type)
    );

    const sortedChannels = filteredChannels.sort(
      (a, b) => priorityChannels.indexOf(a.type) - priorityChannels.indexOf(b.type)
    );

    return (
      <div className="mt-2">
        <div className="flex flex-wrap gap-1">
          {sortedChannels.map((channel) => (
            <Link key={`${fid}-${channel.type}-${channel.value}`} href={channel.url} prefetch={false}>
              <Badge variant="secondary" className="text-sm">
                {channel.type}
              </Badge>
            </Link>
          ))}
        </div>
      </div>
    );
  };

  const renderCoordinapeAttestations = () => {
    if (!profile?.coordinapeAttestations?.length) return null;

    return (
      <div className="mt-2" key={`coordinape-attestations-${fid}`}>
        <span className="text-sm text-foreground">Coordinape GIVE Attestations</span>
        <div className="mt-2 flex flex-wrap gap-1">
          {take(profile.coordinapeAttestations, 15).map((attestation) => (
            <span
              key={`${fid}-${attestation.platform}-${attestation.skill}`}
              className={cn(
                'h-6 rounded-lg px-1 border border-foreground/20 text-xs text-muted-foreground flex items-center',
                attestation.amount > 1 && 'pr-0 rounded-r-lg'
              )}
            >
              {attestation.skill}
              {attestation.amount > 1 && (
                <Badge
                  variant="secondary"
                  className="h-6 shadow-none border-t border-foreground/20  hover:bg-secondary rounded-l-none ml-1 -mr-0.5 text-xs"
                >
                  {attestation.amount}
                </Badge>
              )}
            </span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className={cn('w-full', wideFormat && 'md:grid md:grid-cols-2 md:gap-4')}>
      <Link
        href={`${process.env.NEXT_PUBLIC_URL}/profile/${profile?.username}`}
        prefetch={false}
        className="cursor-pointer block group"
      >
        <div className="transition-all duration-200 group-hover:bg-sidebar/20 rounded-lg p-2 -m-2">
          <ProfileInfoContent
            profile={profile}
            showFollowButton={showFollowButton}
            hideBio={hideBio}
            wideFormat={wideFormat}
          />
        </div>
      </Link>
      {shouldRenderFullInfo && (
        <div className="mt-3 space-y-3">
          {renderIcebreakerChannels()}
          {renderIcebreakerCredentials()}
          {renderCoordinapeAttestations()}
        </div>
      )}
    </div>
  );
};

export default ProfileInfo;

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

  const renderDateJoined = () => {
    if (!profile?.airstackSocialInfo?.userCreatedAt) return null;
    return (
      <p className="text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">
          {formatDistanceToNow(profile.airstackSocialInfo?.userCreatedAt)}
        </span>{' '}
        account age
      </p>
    );
  };

  const renderSocialCapitalScore = () =>
    profile?.airstackSocialInfo?.socialCapitalRank && (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{profile?.airstackSocialInfo?.socialCapitalRank}</span>{' '}
              social rank
            </span>
          </TooltipTrigger>
          <TooltipContent
            className="w-44 p-3 bg-background border border-muted text-foreground/80"
            side="bottom"
            sideOffset={5}
          >
            Social Capital Scores (SCS) are a measure of each Farcaster user&apos;s influence in the network. Learn more
            at{' '}
            <a
              target="_blank"
              rel="noreferrer"
              className="underline cursor-pointer"
              href="https://docs.airstack.xyz/airstack-docs-and-faqs/farcaster/farcaster/social-capital#social-capital-scores"
            >
              Airstack.xyz
            </a>
          </TooltipContent>
        </Tooltip>
        {profile?.airstackSocialInfo?.moxieEarnings && (
          <>
            <br />
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {formatLargeNumber(profile?.airstackSocialInfo?.moxieEarnings)}
                  </span>{' '}
                  Moxie earned
                </span>
              </TooltipTrigger>
              <TooltipContent
                className="w-44 p-3 bg-background border border-muted text-foreground/80"
                side="bottom"
                sideOffset={5}
              >
                Moxie is a community-owned and community-governed Farcaster protocol. Its mission is to grow the
                Farcaster GDP. Learn more at{' '}
                <a target="_blank" rel="noreferrer" className="underline cursor-pointer" href="https://moxie.xyz">
                  moxie.xyz
                </a>
              </TooltipContent>
            </Tooltip>
          </>
        )}
      </TooltipProvider>
    );

  const shouldRenderFullInfo = showFullInfo && (profile?.airstackSocialInfo || profile?.icebreakerSocialInfo);

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
    <div className={cn('space-y-2 min-h-40 w-full grid gap-4', wideFormat && 'md:grid-cols-2')}>
      <Link
        href={`${process.env.NEXT_PUBLIC_URL}/profile/${profile?.username}`}
        prefetch={false}
        className="cursor-pointer block"
      >
        <ProfileInfoContent
          profile={profile}
          showFollowButton={showFollowButton}
          hideBio={hideBio}
          wideFormat={wideFormat}
        />
      </Link>
      {shouldRenderFullInfo && (
        <div className="mt-4 content-end">
          {renderDateJoined()}
          {renderSocialCapitalScore()}
          {renderIcebreakerChannels()}
          {renderIcebreakerCredentials()}
          {renderCoordinapeAttestations()}
        </div>
      )}
    </div>
  );
};

export default ProfileInfo;

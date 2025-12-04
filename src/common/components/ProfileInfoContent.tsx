import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loading } from './Loading';
import { formatLargeNumber } from '../helpers/text';
import FollowButton from './FollowButton';
import Linkify from 'linkify-react';
import Link from 'next/link';
import { useDataStore } from '@/stores/useDataStore';
import { useAccountStore } from '@/stores/useAccountStore';
import get from 'lodash.get';

type ProfileInfoContentProps = {
  profile: any;
  showFollowButton?: boolean;
  isHoverCard?: boolean;
  hideBio?: boolean;
  wideFormat?: boolean;
  compact?: boolean;
};

const ProfileInfoContent: React.FC<ProfileInfoContentProps> = ({
  profile,
  showFollowButton = true,
  isHoverCard = false,
  hideBio = false,
  wideFormat = false,
  compact = false,
}) => {
  const currentUserFid = useAccountStore((state) => state.accounts[state.selectedAccountIdx]?.platformAccountId);

  if (!profile) return <Loading />;

  const isOwnProfile = currentUserFid && profile.fid.toString() === currentUserFid;

  const renderFollowButton = () => {
    if (!showFollowButton || !profile.username || isOwnProfile) return null;
    return <FollowButton username={profile.username} profile={profile} />;
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-row justify-between items-start">
        <div className="flex space-x-3">
          <Avatar className={compact ? 'h-8 w-8' : 'h-10 w-10 ring-2 ring-sidebar-border/20'}>
            <AvatarImage src={profile.pfp_url} />
            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold">
              {profile.username?.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-foreground break-all overflow-x-hidden line-clamp-1 text-sm">
              {profile.display_name}
            </h2>
            <h3 className="flex items-center text-sm text-foreground/70 font-medium">
              @{profile.username}
              {profile?.power_badge && (
                <img src="/images/ActiveBadge.webp" className="ml-1 h-[14px] w-[14px]" alt="Power badge" />
              )}
            </h3>
          </div>
        </div>
        {wideFormat && renderFollowButton()}
      </div>
      {!wideFormat && !compact && renderFollowButton()}
      {!compact && (
        <div className="space-y-2 text-sm">
          {!hideBio && profile.profile?.bio?.text && (
            <div
              className={`text-sm break-words text-foreground/80 leading-relaxed line-clamp-3 min-h-[60px] ${isHoverCard ? '' : 'pr-2 overflow-x-hidden'}`}
            >
              <Linkify
                as="p"
                options={{
                  validate: {
                    url: (value): boolean => {
                      return !value.startsWith('$');
                    },
                  },
                  render: {
                    url: ({ attributes, content }) => {
                      const { href, ...props } = attributes;
                      return (
                        <Link
                          href={href}
                          className="text-primary underline hover:no-underline transition-all"
                          prefetch={false}
                          {...props}
                        >
                          {content}
                        </Link>
                      );
                    },
                  },
                }}
              >
                {profile.profile?.bio?.text}
              </Linkify>
            </div>
          )}
          <div className="flex flex-col space-y-1 sm:flex-row sm:space-y-0 sm:space-x-4 lg:flex-col lg:space-x-0 lg:space-y-1 text-sm">
            <p className="text-foreground/70">
              <span className="font-semibold text-foreground">
                {formatLargeNumber(profile.follower_count || 0)}&nbsp;
              </span>
              followers
            </p>
            <p className="text-foreground/70">
              <span className="font-semibold text-foreground">
                {formatLargeNumber(profile.following_count || 0)}&nbsp;
              </span>
              following
            </p>
          </div>
          {!isHoverCard && profile.fid && (
            <p className="text-foreground/70 text-xs">
              <span className="font-semibold text-foreground">{profile.fid}&nbsp;</span>
              fid
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ProfileInfoContent;

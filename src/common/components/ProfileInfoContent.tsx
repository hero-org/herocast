import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loading } from './Loading';
import { formatLargeNumber } from '../helpers/text';
import FollowButton from './FollowButton';

type ProfileInfoContentProps = {
  profile: any;
  showFollowButton?: boolean;
  isHoverCard?: boolean;
  hideBio?: boolean;
};

const ProfileInfoContent: React.FC<ProfileInfoContentProps> = ({
  profile,
  showFollowButton = true,
  isHoverCard = false,
  hideBio = false,
}) => {
  if (!profile) return <Loading />;

  return (
    <div className="space-y-2">
      <div className="flex flex-row justify-between">
        <div className="flex space-x-2">
          <Avatar>
            <AvatarImage
              src={`https://res.cloudinary.com/merkle-manufactory/image/fetch/c_fill,f_png,w_144/${profile.pfp_url}`}
            />
            <AvatarFallback>{profile.username?.slice(0, 2)}</AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-md font-semibold break-all overflow-x-hidden line-clamp-1">{profile.display_name}</h2>
            <h3 className="flex text-sm font-regular">
              @{profile.username}
              {profile?.power_badge && (
                <img src="/images/ActiveBadge.webp" className="ml-1 mt-0.5 h-[14px] w-[14px]" alt="Power badge" />
              )}
            </h3>
          </div>
        </div>
      </div>
      {showFollowButton && profile.username && <FollowButton username={profile.username} />}
      {!hideBio && profile.profile?.bio?.text && (
        <p className={`flex pt-2 text-sm break-words ${isHoverCard ? '' : 'pr-4 overflow-x-hidden'}`}>
          {profile.profile?.bio?.text}
        </p>
      )}
      <div className="flex flex-col pt-2 text-sm text-muted-foreground">
        <div className="flex flex-col lg:flex-row lg:space-x-2">
          <p>
            <span className="font-semibold text-foreground">
              {formatLargeNumber(profile.follower_count || 0)}&nbsp;
            </span>
            followers
          </p>
          <p>
            <span className="font-semibold text-foreground">
              {formatLargeNumber(profile.following_count || 0)}&nbsp;
            </span>
            following
          </p>
        </div>
        {!isHoverCard && profile.fid && (
          <p>
            <span className="font-semibold text-foreground">{profile.fid}&nbsp;</span>
            fid
          </p>
        )}
      </div>
    </div>
  );
};

export default ProfileInfoContent;

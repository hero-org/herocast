import React, { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import clsx from 'clsx';
import { followUser, unfollowUser } from '../helpers/farcaster';
import { useAccountStore } from '@/stores/useAccountStore';
import { useRouter } from 'next/router';
import { AccountPlatformType } from '../constants/accounts';
import { toastInfoReadOnlyMode } from '../helpers/toast';
import { useProfileByUsername } from '@/hooks/queries/useProfile';

type ProfileWithViewerContext = {
  fid: number;
  username: string;
  viewer_context?: {
    following?: boolean;
  };
};

type FollowButtonProps = {
  username: string;
  profile?: ProfileWithViewerContext;
};

const APP_FID = Number(process.env.NEXT_PUBLIC_APP_FID!);

const FollowButton = ({ username, profile: profileProp }: FollowButtonProps) => {
  const [isFollowing, setIsFollowing] = useState(false);
  const router = useRouter();
  const { accounts, selectedAccountIdx } = useAccountStore();
  const selectedAccount = accounts[selectedAccountIdx];
  const viewerFid = Number(selectedAccount?.platformAccountId) || APP_FID;

  const [isPending, setIsPending] = useState(false);
  // Use passed profile if available, otherwise fetch via React Query
  const { data: fetchedProfile } = useProfileByUsername(username, {
    viewerFid,
    enabled: !profileProp && !!username,
  });
  const profile = profileProp || fetchedProfile;

  useEffect(() => {
    if (!profile) return;

    setIsFollowing(!!profile.viewer_context?.following);
  }, [profile]);

  const updateFollowStatus = async () => {
    if (!selectedAccount || !profile || isFollowing === undefined) return;
    const canSendReaction = selectedAccount?.platform !== AccountPlatformType.farcaster_local_readonly;
    if (!canSendReaction) {
      toastInfoReadOnlyMode();
      return;
    }

    setIsPending(true);
    if (isFollowing) {
      unfollowUser(Number(profile.fid), Number(selectedAccount.platformAccountId), selectedAccount.privateKey!);
    } else {
      followUser(Number(profile.fid), Number(selectedAccount.platformAccountId), selectedAccount.privateKey!);
    }
    setIsPending(false);
    setIsFollowing(!isFollowing);
  };

  const getButtonText = () => {
    if (!selectedAccount) return 'Login';
    if (isPending) return 'Pending';
    if (isFollowing) return 'Following';
    return 'Follow';
  };

  return (
    <Button
      variant={isFollowing ? 'secondary' : 'default'}
      className="group text-xs sm:text-sm"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!selectedAccount) router.push('/login');

        updateFollowStatus();
      }}
    >
      <span className={clsx(isFollowing && 'group-hover:hidden', 'block')}>{getButtonText()}</span>
      {isFollowing && <span className="hidden group-hover:block group-hover:text-red-600">Unfollow</span>}
    </Button>
  );
};

export default FollowButton;

import React, { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import clsx from 'clsx';
import { followUser, unfollowUser } from '../helpers/farcaster';
import { useAccountStore } from '@/stores/useAccountStore';
import { useRouter } from 'next/router';
import { useDataStore } from '@/stores/useDataStore';
import get from 'lodash.get';
import { AccountPlatformType } from '../constants/accounts';
import { toastInfoReadOnlyMode } from '../helpers/toast';

type FollowButtonProps = {
  username: string;
};

const FollowButton = ({ username }: FollowButtonProps) => {
  const [isFollowing, setIsFollowing] = useState(false);
  const router = useRouter();
  const { accounts, selectedAccountIdx } = useAccountStore();
  const selectedAccount = accounts[selectedAccountIdx];

  const [isPending, setIsPending] = useState(false);
  const profile = useDataStore((state) => get(state.fidToData, get(state.usernameToFid, username)));

  useEffect(() => {
    if (!profile) return;

    if (profile.viewer_context?.following) {
      setIsFollowing(true);
    }
  }, [profile]);

  const updateFollowStatus = async () => {
    if (!selectedAccount || isFollowing === undefined) return;
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

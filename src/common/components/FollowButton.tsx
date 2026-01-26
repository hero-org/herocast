import clsx from 'clsx';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useFollow, useUnfollow } from '@/hooks/mutations/useFollow';
import { useProfileByUsername } from '@/hooks/queries/useProfile';
import { useAccountStore } from '@/stores/useAccountStore';
import { AccountPlatformType } from '../constants/accounts';
import { toastInfoReadOnlyMode } from '../helpers/toast';

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
  const router = useRouter();
  const { accounts, selectedAccountIdx } = useAccountStore();
  const selectedAccount = accounts[selectedAccountIdx];
  const viewerFid = Number(selectedAccount?.platformAccountId) || APP_FID;

  // Use passed profile if available, otherwise fetch via React Query
  const { data: fetchedProfile } = useProfileByUsername(username, {
    viewerFid,
    enabled: !profileProp && !!username,
  });
  const profile = profileProp || fetchedProfile;

  // Get follow/unfollow mutations
  const follow = useFollow();
  const unfollow = useUnfollow();

  // Get following state from profile's viewer_context
  const isFollowing = profile?.viewer_context?.following ?? false;
  const isPending = follow.isPending || unfollow.isPending;

  const updateFollowStatus = async () => {
    if (!selectedAccount || !profile) return;
    const canSendReaction = selectedAccount?.platform !== AccountPlatformType.farcaster_local_readonly;
    if (!canSendReaction) {
      toastInfoReadOnlyMode();
      return;
    }

    const mutationParams = {
      targetFid: Number(profile.fid),
      accountId: selectedAccount.id,
    };

    if (isFollowing) {
      unfollow.mutate(mutationParams);
    } else {
      follow.mutate(mutationParams);
    }
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

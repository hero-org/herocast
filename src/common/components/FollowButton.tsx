import React, { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import clsx from "clsx";
import { followUser, unfollowUser } from "../helpers/farcaster";
import { useAccountStore } from "@/stores/useAccountStore";
import { useRouter } from "next/navigation";
import { useDataStore } from "@/stores/useDataStore";
import get from "lodash.get";

type FollowButtonProps = {
  username: string;
};

const FollowButton = ({ username }: FollowButtonProps) => {
  const [isFollowing, setIsFollowing] = useState(false);
  const router = useRouter();
  const { accounts, selectedAccountIdx } = useAccountStore();
  const selectedAccount = accounts[selectedAccountIdx];

  const [isPending, setIsPending] = useState(false);
  const profile = useDataStore((state) => get(state.usernameToData, username));

  useEffect(() => {
    if (!profile) return;

    if (profile.viewer_context?.following) {
      setIsFollowing(true);
    }
  }, [profile]);

  const updateFollowStatus = async () => {
    if (isFollowing === undefined) return;

    setIsPending(true);
    if (isFollowing) {
      unfollowUser(
        Number(profile.fid),
        Number(selectedAccount.platformAccountId),
        selectedAccount.privateKey!
      );
    } else {
      followUser(
        Number(profile.fid),
        Number(selectedAccount.platformAccountId),
        selectedAccount.privateKey!
      );
    }
    setIsPending(false);
    setIsFollowing(!isFollowing);
  };

  const getButtonText = () => {
    if (!selectedAccount) return "Login to herocast";
    if (isPending) return "Pending";
    if (isFollowing) return "Following";
    return "Follow";
  };

  return (
    <Button
      size="lg"
      className="rounded-sm group"
      onClick={(e) => {
        if (!selectedAccount) router.push("/login");

        updateFollowStatus();
        e.stopPropagation();
      }}
    >
      <span className={clsx(isFollowing && "group-hover:hidden", "block")}>
        {getButtonText()}
      </span>
      {isFollowing && (
        <span className="hidden group-hover:block group-hover:text-red-600">
          Unfollow
        </span>
      )}
    </Button>
  );
};

export default FollowButton;

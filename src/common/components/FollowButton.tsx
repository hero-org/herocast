import React, { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import clsx from "clsx";
import { followUser, unfollowUser } from "../helpers/farcaster";
import { useAccountStore } from "@/stores/useAccountStore";
import { useRouter } from "next/navigation";

type FollowButtonProps = {
  following: boolean;
  targetFid: string;
};

const FollowButton = ({ following, targetFid }: FollowButtonProps) => {
    const [isFollowing, setIsFollowing] = useState(following);
    const router = useRouter();
    const { accounts, selectedAccountIdx } = useAccountStore();
    const selectedAccount = accounts[selectedAccountIdx];

  const [isPending, setIsPending] = useState(false);

  const updateFollowStatus = async () => {
    if (isFollowing === undefined) return;

    setIsPending(true);
    if (isFollowing) {
      console.log("unfollow");
      unfollowUser(
        Number(targetFid),
        Number(selectedAccount.platformAccountId),
        selectedAccount.privateKey!
      );
    } else {
      console.log("follow");
      followUser(
        Number(targetFid),
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

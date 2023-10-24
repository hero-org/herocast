import React, { useEffect, useState } from 'react';
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@/components/ui/avatar";
import { UserNeynarV1Type, fetchUserProfile } from '../helpers/neynar';
//   import { Button } from '@/components/ui/button';
import { openWindow } from '../helpers/navigation';
import { Loading } from './Loading';
import { Button } from '@/components/ui/button';

const ProfileHoverCard = ({ userFid, username }: { userFid: string, username: string }) => {
    const [profile, setProfile] = useState<UserNeynarV1Type | null>(null);

    useEffect(() => {
        const getData = async () => {
            setProfile(await fetchUserProfile(userFid, username.slice(1)));
        }

        getData();
    }, []);

    const onClick = () => {
        openWindow(`https://warpcast.com/${profile?.username || username}`);
    }

    const updateFollowStatus = (following: boolean | undefined) => async () => {
        if (following === undefined) return;
        
    }

    // console.log('profile', profile);

    return (
        <HoverCard openDelay={0.1}>
            <HoverCardTrigger onClick={onClick}>{username}</HoverCardTrigger>
            <HoverCardContent onClick={onClick} className="overflow-hidden">
                <div className="space-y-2">
                    <div className="flex flex-row justify-between">
                        <Avatar>
                            <AvatarImage src={profile?.pfp.url} />
                            <AvatarFallback>{username.slice(1, 2)}</AvatarFallback>
                        </Avatar>
                        {/* <Button
                            className="rounded-sm group"
                            onClick={(e) => {e.stopPropagation(); updateFollowStatus(profile?.viewerContext.following)}}
                        >
                            <span className="block group-hover:hidden">{profile?.viewerContext.following ? "Following" : "Follow"}</span>
                            <span className="hidden group-hover:block group-hover:text-red-600">Unfollow</span>
                        </Button> */}
                    </div>
                    <div>
                        <h2 className="text-md font-semibold">{profile?.displayName}</h2>
                        <h3 className="text-sm font-regular">{username}</h3>
                    </div>
                    {profile ? (
                        <>
                            <p className="flex pt-2 text-sm break-words">
                                {profile?.profile?.bio?.text}
                            </p>
                            <div className="flex items-center pt-2 text-sm text-muted-foreground">
                                <span className="font-semibold text-foreground">
                                    {profile?.followingCount}
                                    &nbsp;
                                </span>
                                following
                                <span className="ml-2 font-semibold text-foreground">
                                    {profile?.followerCount}
                                    &nbsp;
                                </span>
                                followers
                            </div>
                        </>
                    ) : <Loading />}
                </div>
            </HoverCardContent>
        </HoverCard>
    )
}

export default ProfileHoverCard;
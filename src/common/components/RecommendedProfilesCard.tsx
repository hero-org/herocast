import React, { useEffect, useState } from 'react';
import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import { User } from '@neynar/nodejs-sdk/build/neynar-api/v2';
import FollowButton from './FollowButton';
import { useDataStore } from '@/stores/useDataStore';

const defaultProfiles: User[] = [
  {
    username: 'hellno',
    fid: 13596,
    profile: {
      bio: {
        text: 'dev + founder | @herocast',
      },
    },
    display_name: 'hellno the optimist',
    pfp_url:
      'https://wrpcd.net/cdn-cgi/image/anim=false,fit=contain,f=auto,w=288/https%3A%2F%2Fi.imgur.com%2FqoHFjQD.gif',
  },
  {
    username: 'herocast',
    fid: 18665,
    display_name: 'herocast',
    pfp_url:
      'https://wrpcd.net/cdn-cgi/imagedelivery/BXluQx4ige9GuW0Ia56BHw/6958dc09-d654-4192-35f6-3e5816246700/anim=false,fit=contain,f=auto,w=336',
    profile: {
      bio: {
        text: 'you are using herocast right now 👋🏻',
      },
    },
  },
] as User[];

const RecommendedProfilesCard = () => {
  const [profiles, setProfiles] = useState<User[]>(defaultProfiles);

  const { addUserProfile } = useDataStore();

  useEffect(() => {
    const getProfiles = async () => {
      const client = new NeynarAPIClient(process.env.NEXT_PUBLIC_NEYNAR_API_KEY!);

      const relevantFollowers = await client.fetchActiveUsers({
        limit: 14,
      });

      if (!relevantFollowers || !relevantFollowers.users) {
        return;
      }

      setProfiles([...defaultProfiles, ...relevantFollowers.users]);
    };

    getProfiles();
  }, []);

  useEffect(() => {
    profiles.forEach((user) => {
      addUserProfile({ user });
    });
  }, [profiles]);

  return (
    <div className="mx-auto max-w-7xl px-6 lg:px-8 mt-8">
      <div className="mx-auto max-w-2xl lg:mx-0">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Follow more profiles to see more content
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The more profiles you follow, the more content you will see in your feed.
        </p>
      </div>
      <ul
        role="list"
        className="mx-auto mt-12 grid max-w-2xl grid-cols-2 gap-x-8 gap-y-16 text-center sm:grid-cols-3 md:grid-cols-4 lg:mx-0 lg:max-w-none"
      >
        {profiles.map((person) => (
          <li key={person.username}>
            <img className="mx-auto h-24 w-24 rounded-full" src={person.pfp_url} alt="" />
            <h3 className="my-2 text-base font-semibold leading-7 tracking-tight text-foreground">
              {person.display_name}
            </h3>
            <FollowButton username={person.username} />
            <p className="mt-2 line-clamp-2 h-18 text-sm leading-6 text-muted-foreground">
              {person?.profile?.bio?.text}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default RecommendedProfilesCard;

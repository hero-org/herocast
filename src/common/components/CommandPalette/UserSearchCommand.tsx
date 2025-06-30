import React, { useState, useEffect } from 'react';
import { CommandItem } from '@/components/ui/command';
import { UserCircleIcon } from '@heroicons/react/20/solid';
import { useRouter } from 'next/router';
import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import { useNavigationStore } from '@/stores/useNavigationStore';
import { User } from '@neynar/nodejs-sdk/build/neynar-api/v2';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';

interface UserSearchCommandProps {
  query: string;
}

const neynarClient = new NeynarAPIClient(process.env.NEXT_PUBLIC_NEYNAR_API_KEY!);

export const UserSearchCommand: React.FC<UserSearchCommandProps> = ({ query }) => {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!query || query.length < 2) {
      setUsers([]);
      return;
    }

    const searchUsers = async () => {
      setIsLoading(true);
      try {
        const result = await neynarClient.searchUser(query, 5);
        setUsers(result.result.users || []);
      } catch (error) {
        console.error('Failed to search users:', error);
        setUsers([]);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounceTimer);
  }, [query]);

  if (!query || query.length < 2) return null;

  if (isLoading) {
    return (
      <CommandItem disabled>
        <UserCircleIcon className="h-5 w-5 flex-none text-foreground/80 mr-2" />
        <span className="ml-2">Searching users...</span>
      </CommandItem>
    );
  }

  if (users.length === 0) {
    return (
      <CommandItem disabled>
        <UserCircleIcon className="h-5 w-5 flex-none text-foreground/80 mr-2" />
        <span className="ml-2">No users found for &quot;{query}&quot;</span>
      </CommandItem>
    );
  }

  return (
    <>
      {users.map((user) => (
        <CommandItem
          key={user.fid}
          value={`user-${user.fid}`}
          onSelect={() => {
            router.push(`/profile/${user.username}`);
            // Close command palette
            const { toggleCommandPalette } = useNavigationStore.getState();
            toggleCommandPalette();
          }}
          className="flex items-center py-1.5 rounded-lg"
        >
          {user.pfp_url ? (
            <Image src={user.pfp_url} alt="" width={20} height={20} className="mr-2 h-5 w-5 flex-none rounded-full" />
          ) : (
            <UserCircleIcon className="h-5 w-5 flex-none text-foreground/80 mr-2" />
          )}
          <div className="flex flex-col ml-2">
            <span className="font-medium">{user.display_name || user.username}</span>
            <span className="text-xs text-muted-foreground">@{user.username}</span>
          </div>
        </CommandItem>
      ))}
    </>
  );
};

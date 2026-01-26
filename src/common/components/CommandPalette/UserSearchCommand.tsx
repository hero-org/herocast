import { UserCircleIcon } from '@heroicons/react/20/solid';
import type { User } from '@neynar/nodejs-sdk/build/neynar-api/v2';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type React from 'react';
import { useEffect, useState } from 'react';
import { CommandItem } from '@/components/ui/command';
import { useNavigationStore } from '@/stores/useNavigationStore';

interface UserSearchCommandProps {
  query: string;
}

const APP_FID = process.env.NEXT_PUBLIC_APP_FID!;

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
        const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}&viewer_fid=${APP_FID}&limit=5`);
        if (!response.ok) {
          throw new Error('Failed to search users');
        }
        const data = await response.json();
        setUsers(data.users || []);
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

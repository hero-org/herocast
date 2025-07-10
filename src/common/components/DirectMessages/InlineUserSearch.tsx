import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, User } from 'lucide-react';
import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import { User as NeynarUser } from '@neynar/nodejs-sdk/build/neynar-api/v2';
import { debounce } from 'lodash';
import { formatLargeNumber } from '@/common/helpers/text';

interface InlineUserSearchProps {
  onSelect: (user: NeynarUser) => void;
  placeholder?: string;
  viewerFid?: string;
  autoFocus?: boolean;
}

export function InlineUserSearch({
  onSelect,
  placeholder = 'Search for a user...',
  viewerFid,
  autoFocus = true,
}: InlineUserSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NeynarUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Memoize the search function to prevent recreating on every render
  const searchUsers = useMemo(
    () =>
      debounce(async (searchQuery: string) => {
        if (!searchQuery || searchQuery.length < 2) {
          setResults([]);
          setIsLoading(false);
          return;
        }

        setIsLoading(true);
        setHasSearched(true);

        try {
          const appFid = process.env.NEXT_PUBLIC_APP_FID!;
          const client = new NeynarAPIClient(process.env.NEXT_PUBLIC_NEYNAR_API_KEY!);

          const response = await client.searchUser(searchQuery.replace('@', ''), Number(viewerFid || appFid), {
            limit: 10,
          });

          setResults(response.result.users || []);
        } catch (error) {
          console.error('Error searching users:', error);
          setResults([]);
        } finally {
          setIsLoading(false);
        }
      }, 300),
    [viewerFid]
  );

  useEffect(() => {
    searchUsers(query);
    
    // Cleanup function to cancel pending searches
    return () => {
      searchUsers.cancel();
    };
  }, [query, searchUsers]);

  return (
    <div className="border rounded-lg">
      <Command shouldFilter={false}>
        <CommandInput
          placeholder={placeholder}
          value={query}
          onValueChange={setQuery}
          autoFocus={autoFocus}
          className="h-12"
        />
        <CommandList>
          {isLoading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
              <p>Searching users...</p>
            </div>
          ) : query.length === 0 ? (
            <CommandEmpty>Type to search for users</CommandEmpty>
          ) : results.length === 0 && hasSearched ? (
            <CommandEmpty>No users found</CommandEmpty>
          ) : (
            <CommandGroup>
              {results.map((user) => (
                <CommandItem
                  key={user.fid}
                  value={user.username}
                  onSelect={() => onSelect(user)}
                  className="flex items-center gap-3 p-3 cursor-pointer"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.pfp_url} alt={user.display_name} />
                    <AvatarFallback>
                      <User className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{user.display_name}</span>
                      <span className="text-sm text-muted-foreground">@{user.username}</span>
                    </div>
                    {user.follower_count > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {formatLargeNumber(user.follower_count)} followers
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </div>
  );
}

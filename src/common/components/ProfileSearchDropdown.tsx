'use client';

import type { User } from '@neynar/nodejs-sdk/build/neynar-api/v2';
import { CaretSortIcon, CheckIcon } from '@radix-ui/react-icons';
import debounce from 'lodash.debounce';
import uniqBy from 'lodash.uniqby';
import { useEffect, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { type AccountObjectType, useAccountStore } from '@/stores/useAccountStore';
import { getUserDataForFidOrUsername } from '../helpers/neynar';
import { formatLargeNumber } from '../helpers/text';

type ProfileSearchDropdownProps = {
  disabled?: boolean;
  defaultProfiles: User[];
  selectedProfile: User | undefined;
  setSelectedProfile: (profile: User) => void;
  placeholder?: string;
};

export function ProfileSearchDropdown({
  defaultProfiles,
  selectedProfile,
  setSelectedProfile,
  disabled,
  placeholder,
}: ProfileSearchDropdownProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [profiles, setProfiles] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const { accounts, selectedAccountIdx } = useAccountStore();
  const account: AccountObjectType = accounts[selectedAccountIdx];

  useEffect(() => {
    const debouncedSearch = debounce(
      (term) => {
        if (term) {
          setIsLoading(true);
          const viewerFid = account?.platformAccountId
            ? Number(account.platformAccountId)
            : Number(process.env.NEXT_PUBLIC_APP_FID) || 3;

          // Ensure viewerFid is a valid number
          if (isNaN(viewerFid)) {
            console.warn('Invalid viewerFid, using default value 3');
            getUserDataForFidOrUsername({
              username: term,
              viewerFid: '3',
            }).then((users) => {
              setProfiles(users);
              setIsLoading(false);
            });
          } else {
            getUserDataForFidOrUsername({
              username: term,
              viewerFid: String(viewerFid),
            }).then((users) => {
              setProfiles(users);
              setIsLoading(false);
            });
          }
        } else {
          setProfiles([]);
        }
      },
      300,
      {
        leading: false,
        trailing: true,
      }
    );
    debouncedSearch(searchTerm);
  }, [searchTerm, account]);

  const renderSelectedProfile = () => {
    return (
      <div className="flex items-center truncate">
        <Avatar className="mr-2 h-5 w-5">
          <AvatarImage src={selectedProfile?.pfp_url} alt={selectedProfile?.username} />
          <AvatarFallback className="text-xs">{selectedProfile?.username.slice(0, 2)}</AvatarFallback>
        </Avatar>
        <span className="truncate text-sm">@{selectedProfile?.username}</span>
      </div>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            disabled && 'hover:bg-transparent cursor-default',
            'h-10 px-3 w-full justify-between font-normal',
            !selectedProfile && 'text-muted-foreground'
          )}
        >
          {selectedProfile ? renderSelectedProfile() : placeholder || 'Select account...'}
          {!disabled && <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />}
        </Button>
      </PopoverTrigger>
      {!disabled && (
        <PopoverContent className="w-[300px] sm:w-[350px] p-0" align="start" sideOffset={4}>
          <Command shouldFilter={false}>
            <CommandInput placeholder="Search users..." value={searchTerm} onValueChange={setSearchTerm} />
            <CommandList>
              {isLoading && (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  <p>Searching...</p>
                </div>
              )}
              {!isLoading && searchTerm && profiles.length === 0 && (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  <p>No profiles found</p>
                </div>
              )}
              {(profiles.length > 0 || defaultProfiles.length > 0) && (
                <CommandGroup>
                  {uniqBy([...profiles, ...defaultProfiles], 'fid').map((profile) => (
                    <CommandItem
                      key={`profile-search-profile-${profile.fid}`}
                      onSelect={() => {
                        setSelectedProfile(profile);
                        setOpen(false);
                      }}
                      className="py-3"
                    >
                      <div className="flex items-center flex-1">
                        <Avatar className="mr-3 h-8 w-8">
                          <AvatarImage
                            src={profile.pfp_url}
                            alt={profile.username}
                            className={cn(selectedProfile?.fid !== profile.fid && 'grayscale')}
                          />
                          <AvatarFallback>{profile.username.slice(0, 2)}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-medium truncate">{profile.display_name || profile.username}</span>
                            {profile.follower_count && (
                              <span className="text-xs text-muted-foreground ml-2">
                                {formatLargeNumber(profile.follower_count)} followers
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground truncate">@{profile.username}</span>
                        </div>
                        <CheckIcon
                          className={cn(
                            'ml-2 h-4 w-4 flex-shrink-0',
                            selectedProfile?.fid === profile.fid ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      )}
    </Popover>
  );
}

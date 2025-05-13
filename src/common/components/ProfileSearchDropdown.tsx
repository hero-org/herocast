'use client';

import React, { useState, useEffect } from 'react';
import { CheckIcon, CaretSortIcon } from '@radix-ui/react-icons';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { User } from '@neynar/nodejs-sdk/build/neynar-api/v2';
import debounce from 'lodash.debounce';
import { CommandLoading } from 'cmdk';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import uniqBy from 'lodash.uniqby';
import { getUserDataForFidOrUsername } from '../helpers/neynar';
import { formatLargeNumber } from '../helpers/text';
import { AccountObjectType, useAccountStore } from '@/stores/useAccountStore';

type ProfileSearchDropdownProps = {
  disabled?: boolean;
  defaultProfiles: User[];
  selectedProfile: User | undefined;
  setSelectedProfile: (profile: User) => void;
};

export function ProfileSearchDropdown({
  defaultProfiles,
  selectedProfile,
  setSelectedProfile,
  disabled,
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
          getUserDataForFidOrUsername({
            username: term,
            viewerFid: account.platformAccountId || process.env.NEXT_PUBLIC_APP_FID! || 3,
          }).then((users) => {
            setProfiles(users);
            setIsLoading(false);
          });
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
  }, [searchTerm]);

  const renderSelectedProfile = () => {
    return (
      <div className="flex items-center truncate">
        <Avatar className="mr-2 h-6 w-6">
          <AvatarImage src={selectedProfile?.pfp_url} alt={selectedProfile?.username} />
          <AvatarFallback>{selectedProfile?.username.slice(0, 2)}</AvatarFallback>
        </Avatar>
        <div className="flex flex-row items-center space-x-1">
          <span className="font-medium text-sm">{selectedProfile?.display_name || selectedProfile?.username}</span>
          <span className="text-xs text-muted-foreground">@{selectedProfile?.username}</span>
        </div>
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
          className={cn(disabled && 'hover:bg-transparent cursor-default', 'px-4 w-full max-w-[300px] justify-between')}
        >
          {selectedProfile ? renderSelectedProfile() : 'Select account...'}
          {!disabled && <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />}
        </Button>
      </PopoverTrigger>
      {!disabled && (
        <PopoverContent className="w-[350px] p-0">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Search users..." value={searchTerm} onValueChange={setSearchTerm} />
            <CommandList>
              {isLoading && <CommandLoading>Searching...</CommandLoading>}
              <CommandEmpty>No profile found.</CommandEmpty>
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
            </CommandList>
          </Command>
        </PopoverContent>
      )}
    </Popover>
  );
}

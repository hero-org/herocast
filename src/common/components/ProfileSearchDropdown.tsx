"use client";

import React, { useState, useEffect } from "react";
import { CheckIcon, CaretSortIcon } from "@radix-ui/react-icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { NeynarAPIClient } from "@neynar/nodejs-sdk";
import { SearchedUser } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import debounce from "lodash.debounce";
import { CommandLoading } from "cmdk";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import uniqBy from "lodash.uniqby";

const neynarClient = new NeynarAPIClient(
  process.env.NEXT_PUBLIC_NEYNAR_API_KEY!
);

export function ProfileSearchDropdown({
  defaultProfiles,
  selectedProfile,
  setSelectedProfile,
}) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [profiles, setProfiles] = useState<SearchedUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const debouncedSearch = debounce(
      (term) => {
        if (term) {
          setIsLoading(true);
          neynarClient.searchUser(term).then((res) => {
            setProfiles(res.result.users);
            setIsLoading(false);
          });
        } else {
          setProfiles([]);
        }
      },
      300,
      {
        leading: true,
        trailing: true,
      }
    );

    debouncedSearch(searchTerm);
  }, [searchTerm]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          className="w-full max-w-[150px] justify-between"
        >
          {selectedProfile ? (
            <>
              <Avatar className="h-5 w-5">
                <AvatarImage
                  src={selectedProfile.pfp_url}
                  alt={selectedProfile.username}
                />
                <AvatarFallback>
                  {selectedProfile.username.slice(2)}
                </AvatarFallback>
              </Avatar>
              {selectedProfile?.username}
            </>
          ) : (
            "Select account..."
          )}
          <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search users..."
            value={searchTerm}
            onValueChange={setSearchTerm}
          />
          <CommandList>
            {isLoading && <CommandLoading>Searching...</CommandLoading>}
            <CommandEmpty>No profile found.</CommandEmpty>
            <CommandGroup>
              {uniqBy([...defaultProfiles, ...profiles], "fid").map(
                (profile) => (
                  <CommandItem
                    key={`profile-search-profile-${profile.fid}`}
                    onSelect={() => {
                      setSelectedProfile(profile);
                      setOpen(false);
                    }}
                  >
                    <Avatar className="mr-2 h-5 w-5">
                      <AvatarImage
                        src={profile.pfp_url}
                        alt={profile.username}
                        className={cn(
                          selectedProfile?.fid !== profile.fid && "grayscale"
                        )}
                      />
                      <AvatarFallback>
                        {profile.username.slice(2)}
                      </AvatarFallback>
                    </Avatar>
                    {profile.username}
                    <CheckIcon
                      className={cn(
                        "ml-auto h-4 w-4",
                        selectedProfile?.fid === profile.fid
                          ? "opacity-100"
                          : "opacity-0"
                      )}
                    />
                  </CommandItem>
                )
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

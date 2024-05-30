"use client";

import * as React from "react";
import {
  CaretSortIcon,
  CheckIcon,
  PlusCircledIcon,
} from "@radix-ui/react-icons";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useRouter } from "next/router";
import {
  AccountObjectType,
  PENDING_ACCOUNT_NAME_PLACEHOLDER,
  useAccountStore,
} from "@/stores/useAccountStore";
import map from "lodash.map";
import { AccountPlatformType } from "@/common/constants/accounts";

const groups = [
  {
    label: "Personal Account",
    key: AccountPlatformType.farcaster,
  },
  {
    label: "Shared Account",
    key: AccountPlatformType.farcaster_hats_protocol,
  },
  {
    label: "Local Account",
    key: AccountPlatformType.farcaster_local_readonly,
  },
];

type PopoverTriggerProps = React.ComponentPropsWithoutRef<
  typeof PopoverTrigger
>;

interface AccountSwitcherProps extends PopoverTriggerProps {}

export default function AccountSwitcher({ className }: AccountSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const { accounts, selectedAccountIdx, setCurrentAccountById } =
    useAccountStore();
  const selectedAccount = accounts[selectedAccountIdx];

  // group list of accounts by platform
  const accountsByPlatform = accounts.reduce((acc, account) => {
    if (!acc[account.platform]) {
      acc[account.platform] = [];
    }
    acc[account.platform].push(account);
    return acc;
  }, {});

  console.log("accountsByPlatform", accountsByPlatform);

  const renderGroup = (group) => {
    if (!accountsByPlatform[group.key]) {
      return null;
    }

    return (
      <CommandGroup key={group.label} heading={group.label}>
        {map(accountsByPlatform[group.key], (account: AccountObjectType) => (
          <CommandItem
            key={account.id}
            onSelect={() => {
              setCurrentAccountById(account.id);
              setOpen(false);
            }}
            className="text-sm"
          >
            <Avatar className="mr-2 h-5 w-5">
              <AvatarImage
                src={account.user?.pfp_url}
                alt={account.name}
                className="grayscale"
              />
              <AvatarFallback>HC</AvatarFallback>
            </Avatar>
            {account.name || PENDING_ACCOUNT_NAME_PLACEHOLDER}
            {account.status !== "active" && (
              <span className={"ml-5 flex-none text-sm text-foreground/70"}>
                {account.status}
              </span>
            )}
            <CheckIcon
              className={cn(
                "ml-auto h-4 w-4",
                selectedAccount.id === account.id ? "opacity-100" : "opacity-0"
              )}
            />
          </CommandItem>
        ))}
      </CommandGroup>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Select an account"
          className={cn("w-[220px] justify-between", className)}
        >
          {selectedAccount ? (
            <div className="flex">
              <Avatar className="mr-2 h-5 w-5">
                <AvatarImage
                  src={selectedAccount.user?.pfp_url}
                  alt={selectedAccount.name}
                />
                <AvatarFallback>{selectedAccount.name}</AvatarFallback>
              </Avatar>
              {selectedAccount.name || PENDING_ACCOUNT_NAME_PLACEHOLDER}
            </div>
          ) : (
            "Select account..."
          )}
          <CaretSortIcon className="ml-auto h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0">
        <Command>
          <CommandList>
            <CommandInput placeholder="Search accounts..." />
            <CommandEmpty>No account found.</CommandEmpty>
            {groups.map(renderGroup)}
          </CommandList>
          <CommandSeparator />
          <CommandList>
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  setOpen(false);
                  router.push("/accounts");
                }}
              >
                <PlusCircledIcon className="mr-2 h-5 w-5" />
                Connect account
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

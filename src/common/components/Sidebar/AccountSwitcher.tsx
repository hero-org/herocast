'use client';

import * as React from 'react';
import { CaretSortIcon, PlusCircledIcon } from '@radix-ui/react-icons';

import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useRouter } from 'next/router';
import { AccountObjectType, PENDING_ACCOUNT_NAME_PLACEHOLDER, useAccountStore } from '@/stores/useAccountStore';
import map from 'lodash.map';
import { AccountPlatformType } from '@/common/constants/accounts';
import { Badge } from '@/components/ui/badge';
import get from 'lodash.get';
import { UserGroupIcon } from '@heroicons/react/24/outline';

const groups = [
  {
    label: 'Accounts',
    platforms: [AccountPlatformType.farcaster],
  },
  {
    label: 'Local Accounts',
    platforms: [AccountPlatformType.farcaster_local_readonly],
  },
];

type PopoverTriggerProps = React.ComponentPropsWithoutRef<typeof PopoverTrigger>;

interface AccountSwitcherProps extends PopoverTriggerProps {}

export default function AccountSwitcher({ className }: AccountSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const { accounts, selectedAccountIdx, setCurrentAccountById } = useAccountStore();
  const selectedAccount = accounts[selectedAccountIdx];

  const accountsByPlatform = accounts.reduce((acc, account) => {
    const labelForAccount = groups.find((group) => group.platforms.includes(account.platform))?.label;
    if (!labelForAccount) {
      console.log('No label found for account', account);
      return acc;
    }

    if (!acc[labelForAccount]) {
      acc[labelForAccount] = [];
    }
    acc[labelForAccount].push(account);
    return acc;
  }, {});

  const renderGroup = (group) => {
    const accounts = get(accountsByPlatform, group.label, []);
    if (!accounts.length) {
      return null;
    }

    return (
      <CommandGroup key={group.label} heading={group.label}>
        {map(accounts, (account: AccountObjectType, idx: number) => (
          <CommandItem
            key={account.id}
            onSelect={() => {
              setCurrentAccountById(account.id);
              setOpen(false);
            }}
            className={cn('text-sm truncate', selectedAccount?.id === account.id && 'bg-muted')}
          >
            <Avatar className="mr-2 h-5 w-5">
              <AvatarImage
                src={account.user?.pfp_url}
                alt={account.name}
                className={cn(selectedAccount?.id !== account.id && 'grayscale')}
              />
              <AvatarFallback>HC</AvatarFallback>
            </Avatar>
            {account.name || PENDING_ACCOUNT_NAME_PLACEHOLDER}
            {idx < 9 && (
              <Badge variant="outline" className="ml-auto">
                Ctrl + {idx + 1}
              </Badge>
            )}
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
          className={cn('px-2 max-w-[130px] min-w-[130px] justify-between', className)}
        >
          {selectedAccount ? (
            <div className="flex truncate max-w-full">
              {selectedAccount.user?.pfp_url && (
                <Avatar className="mr-2 h-5 w-5">
                  <AvatarImage src={selectedAccount.user?.pfp_url} alt={selectedAccount.name} />
                  <AvatarFallback>{selectedAccount.name?.slice(0, 2)}</AvatarFallback>
                </Avatar>
              )}
              {selectedAccount.name || PENDING_ACCOUNT_NAME_PLACEHOLDER}
            </div>
          ) : (
            'Select...'
          )}
          <CaretSortIcon className="ml-auto h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0">
        <Command>
          <CommandList>
            {accounts.length > 2 && <CommandInput placeholder="Search accounts..." />}
            <CommandEmpty>No account found.</CommandEmpty>
            {groups.map(renderGroup)}
          </CommandList>
          <CommandSeparator />
          <CommandList>
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  setOpen(false);
                  router.push('/accounts');
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

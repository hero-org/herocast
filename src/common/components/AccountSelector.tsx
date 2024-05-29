"use client";

import React, { useEffect, useState } from "react";

import { CheckIcon, CaretSortIcon } from "@radix-ui/react-icons";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

import { Command, CommandGroup, CommandItem } from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAccount } from "wagmi";
import {
  AccountObjectType,
  hydrateAccounts,
  useAccountStore,
} from "@/stores/useAccountStore";

type AccountSelectorProps = {
  accountFilter?: (account: AccountObjectType) => boolean;
};

export function AccountSelector({ accountFilter }: AccountSelectorProps) {
  const { address, isConnected } = useAccount();
  const { selectedAccountIdx, setCurrentAccountIdx } = useAccountStore();
  const accounts = useAccountStore((state) => state.accounts).filter(
    (account) => (accountFilter ? accountFilter(account) : true)
  );

  const selectedAccount = accounts[selectedAccountIdx];
  const [open, setOpen] = useState(false);

  return accounts.length === 0 ? (
    <div className="py-3">
      <Button variant="secondary" onClick={() => hydrateAccounts()}>
        Retry
      </Button>
    </div>
  ) : (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full max-w-[450px] justify-between"
        >
          {selectedAccount ? (
            <div className="flex">
              <img
                src={selectedAccount?.user?.pfp_url}
                className="mr-1 bg-gray-100 border h-5 w-5 flex-none shrink-0 rounded-full"
              />
              {selectedAccount.name}{" "}
              <span className="ml-1 text-[0.8rem] text-muted-foreground">
                (fid {selectedAccount.platformAccountId})
              </span>
            </div>
          ) : (
            "Select account..."
          )}
          <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[450px] p-0">
        <Command>
          <CommandGroup>
            {accounts.map((account, idx) => (
              <CommandItem
                key={account.id}
                value={account.id}
                onSelect={async () => {
                  setCurrentAccountIdx(idx);
                  setOpen(false);
                }}
              >
                <CheckIcon
                  className={cn(
                    "mr-2 h-4 w-4",
                    selectedAccountIdx === idx ? "opacity-100" : "opacity-0"
                  )}
                />
                <img
                  src={account?.user?.pfp_url}
                  className="mr-1 bg-gray-100 border h-5 w-5 flex-none shrink-0 rounded-full"
                />
                {account.name}
                <span className="ml-1 text-[0.8rem] text-muted-foreground">
                  (fid {account.platformAccountId})
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

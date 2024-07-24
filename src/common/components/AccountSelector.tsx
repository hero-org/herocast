"use client";

import React, { useState } from "react";

import { CheckIcon, CaretSortIcon } from "@radix-ui/react-icons";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AccountObjectType,
  hydrateAccounts,
  useAccountStore,
} from "@/stores/useAccountStore";
import { Label } from "@/components/ui/label";

type AccountSelectorProps = {
  className?: string;
  accountFilter?: (account: AccountObjectType) => boolean;
};

export function AccountSelector({
  className,
  accountFilter,
}: AccountSelectorProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { selectedAccountIdx, setCurrentAccountById } = useAccountStore();
  const accounts = useAccountStore((state) => state.accounts).filter(
    (account) => (accountFilter ? accountFilter(account) : true)
  );

  const selectedAccount = useAccountStore((state) => state.accounts)[
    selectedAccountIdx
  ];
  const [open, setOpen] = useState(false);

  const renderRetryButton = () => (
    <>
      <div className="flex flex-col">
        <Button
          size="sm"
          variant="secondary"
          className="w-20"
          disabled={isLoading}
          onClick={async () => {
            setIsLoading(true);
            await hydrateAccounts();
            setIsLoading(false);
          }}
        >
          {isLoading ? "Loading..." : "Retry"}
        </Button>
        <Label className="mt-2">
          Try fetching accounts. <br />
          You can refresh the page and navigate back here to continue your account setup.
        </Label>
      </div>
    </>
  );

  const renderSelector = () => (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full max-w-[150px] justify-between", className)}
        >
          {selectedAccount ? (
            <div className="flex">
              {selectedAccount?.user?.pfp_url && (
                <img
                  src={selectedAccount?.user?.pfp_url}
                  className="mr-1 bg-gray-100 border h-4 w-4 flex-none shrink-0 rounded-full"
                />
              )}
              {selectedAccount.name}{" "}
            </div>
          ) : (
            "Select..."
          )}
          <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[450px] p-0">
        <Command>
          <CommandList>
            <CommandGroup>
              {accounts.map((account, idx) => (
                <CommandItem
                  key={account.id}
                  value={account.id}
                  onSelect={async () => {
                    setCurrentAccountById(account.id);
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
                    fid {account.platformAccountId}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );

  return accounts.length === 0 ? renderRetryButton() : renderSelector();
}

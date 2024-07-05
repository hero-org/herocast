"use client";

import * as React from "react";

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
import { CaretSortIcon, CheckIcon } from "@radix-ui/react-icons";

export enum SearchInterval {
  d1 = "1 day",
  d7 = "7 days",
  d30 = "30 days",
  all = "all",
}

const intervals = [
  {
    label: "1 day",
    value: SearchInterval.d1,
  },
  {
    label: "7 days",
    value: SearchInterval.d7,
  },
  {
    label: "30 days",
    value: SearchInterval.d30,
  },
  {
    label: "All time",
    value: SearchInterval.all,
  },
];

export function SearchIntervalFilter({
  defaultInterval,
  updateInterval,
}: {
  defaultInterval?: SearchInterval;
  updateInterval: (value: SearchInterval) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState<SearchInterval | undefined>(
    defaultInterval
  );

  const handleSelect = (currentValue: SearchInterval) => {
    setValue(currentValue === value ? undefined : currentValue);
    updateInterval(currentValue);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[110px] justify-between"
        >
          {value !== undefined
            ? intervals.find((framework) => framework.value === value)?.label
            : "Interval..."}
          <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[110px] p-0">
        <Command>
          <CommandList>
            <CommandGroup>
              {intervals.map((framework) => (
                <CommandItem
                  key={framework.value}
                  value={framework.value.toString()}
                  onSelect={(value) =>
                    handleSelect(value as unknown as SearchInterval)
                  }
                >
                  <CheckIcon
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === framework.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {framework.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

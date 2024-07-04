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
  d30 = "30 days",
  all = "all",
}

const intervals = [
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
  updateInterval,
}: {
  updateInterval: (value: SearchInterval) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState<SearchInterval | null>(
    intervals[0].value
  );

  const handleSelect = (currentValue: SearchInterval) => {
    setValue(currentValue === value ? null : currentValue);
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
          className="w-[120px] justify-between"
        >
          {value !== null
            ? intervals.find((framework) => framework.value === value)?.label
            : "Interval..."}
          <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[150px] p-0">
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

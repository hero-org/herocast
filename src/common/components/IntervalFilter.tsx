"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CaretSortIcon, CheckIcon } from "@radix-ui/react-icons";
import { Interval } from "../helpers/search";

type IntervalFilterProps = {
  intervals: Interval[];
  defaultInterval?: Interval;
  updateInterval?: (value: Interval) => void;
};

export function IntervalFilter({ intervals, defaultInterval, updateInterval }: IntervalFilterProps) {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState<Interval | undefined>(defaultInterval);

  const canSelect = updateInterval !== undefined;
  const handleSelect = (currentValue: Interval) => {
    setValue(currentValue === value ? undefined : currentValue);
    updateInterval?.(currentValue);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          disabled={!canSelect}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[110px] justify-between"
        >
          {value !== undefined ? intervals.find((interval) => interval === value) : "Interval..."}
          <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[120px] p-0">
        <Command>
          <CommandList>
            <CommandGroup>
              {intervals.map((interval) => (
                <CommandItem
                  key={interval}
                  value={interval.toString()}
                  onSelect={(value) => handleSelect(value as unknown as Interval)}
                >
                  <CheckIcon className={cn("mr-2 h-4 w-4", value === interval ? "opacity-100" : "opacity-0")} />
                  {interval}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

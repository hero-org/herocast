import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Channel } from "@mod-protocol/farcaster";
import { CaretDownIcon } from "@radix-ui/react-icons";
import { take } from "lodash";

type Props = {
  getChannels: (query: string) => Promise<Channel[]>;
  onSelect: (value: Channel) => void;
  value: Channel;
  initialChannels?: Channel[];
};

export function ChannelPicker(props: Props) {
  const { getChannels, onSelect } = props;
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);

  const [channelResults, setChannelResults] = React.useState<Channel[]>(
    props.initialChannels ?? []
  );

  React.useEffect(() => {
    async function getChannelResults() {
      const channels = await getChannels("");
      setChannelResults(channels);
    }

    getChannelResults();
  }, [setChannelResults, getChannels]);

  const handleSelect = React.useCallback(
    (channel: Channel) => {
      setOpen(false);
      onSelect(channel);
    },
    [onSelect, setOpen]
  );

  const filteredChannels =
    query === ""
      ? take(channelResults, 50)
      : take(
          channelResults.filter((channel) => {
            return channel.name.toLowerCase().includes(query.toLowerCase());
          }),
          10
        );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          type="button"
        >
          <img
            src={props.value.image_url ?? ""}
            alt={props.value.name}
            width={24}
            height={24}
            className="mr-2 -ml-2"
          />
          {props.value.name}
          <CaretDownIcon className="-mr-2 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Search Channels"
            value={query}
            onValueChange={(e) => setQuery(e)}
          />
          <CommandEmpty>No channels found.</CommandEmpty>
          <CommandGroup className="max-h-[300px] overflow-y-auto">
            {(channelResults.length === 0
              ? [props.value]
              : filteredChannels
            ).map((channel) => (
              <CommandItem
                key={channel.parent_url || "home"}
                value={channel.name || "home"}
                className="cursor-pointer"
                onSelect={() => handleSelect(channel)}
              >
                <img
                  src={channel.image_url ?? ""}
                  alt={channel.name}
                  width={24}
                  height={24}
                  className="mr-2"
                />
                {channel.name}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

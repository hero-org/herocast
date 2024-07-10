import * as React from "react";
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
import { take } from "lodash";
import { useEffect } from "react";
import uniqBy from "lodash.uniqby";
import { Channel } from "@neynar/nodejs-sdk/build/neynar-api/v2";
import { PersonIcon } from "@radix-ui/react-icons";
import { formatLargeNumber } from "../helpers/text";
import Fuse from "fuse.js";
import map from "lodash.map";
import orderBy from "lodash.orderby";

type Props = {
  getChannels: (query: string) => Promise<Channel[]>;
  getAllChannels: () => Promise<Channel[]>;
  onSelect: (value: Channel) => void;
  value: Channel;
  initialChannels?: Channel[];
  disabled?: boolean;
};

export function ChannelPicker(props: Props) {
  const { getChannels, getAllChannels, onSelect } = props;
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [isPending, setIsPending] = React.useState(false);

  const [channels, setChannels] = React.useState<Channel[]>(
    props.initialChannels ?? []
  );

  const setChannelResults = (newChannels: Channel[]) => {
    setChannels(uniqBy(newChannels, "parent_url"));
  };

  useEffect(() => {
    async function getChannelResults() {
      if (query.length < 2) return;

      try {
        setIsPending(true);
        setChannelResults(await getChannels(query));
      } catch (e) {
        console.error(e);
      } finally {
        setIsPending(false);
      }
    }

    getChannelResults();
  }, [query, setChannels, getChannels]);

  useEffect(() => {
    async function getChannelResults() {
      const channels = await getAllChannels();
      setChannelResults(channels);
    }

    getChannelResults();
  }, [setChannels, getAllChannels]);

  const handleSelect = React.useCallback(
    (channel: Channel) => {
      setOpen(false);
      onSelect(channel);
    },
    [onSelect, setOpen]
  );

  const fuse = new Fuse(channels, {
    keys: ["name", "url"],
  });
  const filteredChannels = React.useMemo(() => {
    if (channels.length === 0) return [];
    if (!query) {
      return take(channels, 7);
    }

    return take(
      orderBy(map(fuse.search(query), "item"), "follower_count", "desc"),
      7
    );
  }, [query, channels, fuse]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          className="h-9 px-4"
          disabled={props.disabled}
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
            className="h-4 w-4 mr-2 -ml-2"
          />
          {props.value.name}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandList>
            <CommandInput
              placeholder="Search Channels"
              value={query}
              onValueChange={(e) => setQuery(e)}
            />
            <CommandEmpty>
              {isPending ? "Searching..." : "No channels found."}
            </CommandEmpty>
            <CommandGroup className="max-h-[300px] overflow-y-auto">
              {(channels.length === 0 ? [props.value] : filteredChannels).map(
                (channel) => (
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
                      className="mr-2 rounded-lg"
                    />
                    {channel.name}
                    {channel.follower_count && (
                      <span className="ml-1 border-l border-foreground/10 text-foreground/60">
                        {" "}
                        <PersonIcon className="ml-1 mb-1 h-3 w-3 inline" />{" "}
                        {formatLargeNumber(channel.follower_count)}
                      </span>
                    )}
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

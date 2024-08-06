import React from "react";
import { ChannelType } from "@/common/constants/channels";
import { CUSTOM_CHANNELS, useAccountStore } from "@/stores/useAccountStore";
import { SidebarHeader } from "./SidebarHeader";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const ChannelsOverview = () => {
  const { selectedChannelUrl, setSelectedChannelUrl, resetSelectedChannel } =
    useAccountStore();

  let channels: ChannelType[] = useAccountStore(
    (state) => state.accounts[state.selectedAccountIdx]?.channels
  );
  if (!channels) channels = [];

  const renderCustomChannel = ({
    name,
    shortcut,
    url,
    onClick,
  }: {
    name: string;
    shortcut: string;
    url: string;
    onClick: () => void;
  }) => {
    return (
      <li key={`custom-channel-${name}`} className="px-2 sm:px-3 lg:px-4">
        <div
          onClick={() => onClick()}
          className={cn(
            selectedChannelUrl === url
              ? "text-foreground font-semibold"
              : "text-foreground/70 hover:text-foreground",
            "flex align-center justify-between gap-x-3 rounded-md p-1 text-sm leading-6 cursor-pointer"
          )}
        >
          <span className="flex-nowrap truncate">{name}</span>
          <Badge variant="outline" className="w-16">
            {shortcut}
          </Badge>
        </div>
      </li>
    );
  };

  return (
    <div className="">
      <SidebarHeader title="Feeds" />
      <ul role="list" className="mt-2 mb-36">
        {renderCustomChannel({
          name: "Follow Feed",
          shortcut: "Shift + 0",
          url: CUSTOM_CHANNELS.FOLLOWING,
          onClick: resetSelectedChannel,
        })}
        {renderCustomChannel({
          name: "Trending Feed",
          shortcut: "Shift + 1",
          url: CUSTOM_CHANNELS.TRENDING,
          onClick: () => setSelectedChannelUrl(CUSTOM_CHANNELS.TRENDING),
        })}
        {channels.map((channel: ChannelType, idx: number) => (
          <li key={channel.name} className="px-2 sm:px-3 lg:px-4">
            <div
              onClick={() => setSelectedChannelUrl(channel.url)}
              className={cn(
                selectedChannelUrl === channel.url
                  ? "text-foreground font-semibold"
                  : "text-foreground/70 hover:text-foreground",
                "flex align-center justify-between gap-x-3 rounded-md p-1 text-sm leading-6 cursor-pointer"
              )}
            >
              <div className="flex max-w-sm">
                {channel.icon_url && (
                  <img
                    src={channel.icon_url}
                    alt=""
                    className={cn(
                      selectedChannelUrl === channel.url
                        ? "border-gray-100"
                        : "border-gray-400 hover:border-gray-300",
                      "mr-1 mt-0.5 bg-gray-100 border h-5 w-5 flex-none rounded-full"
                    )}
                  />
                )}
                <span className="flex-nowrap truncate">{channel.name}</span>
              </div>
              {idx < 8 && (
                <Badge variant="outline" className="w-16 hidden lg:flex">
                  Shift + {idx + 2}
                </Badge>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ChannelsOverview;

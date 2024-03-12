import React from "react";
import { ChannelType } from "@/common/constants/channels";
import { classNames } from "@/common/helpers/css";
import { CUSTOM_CHANNELS, useAccountStore } from "@/stores/useAccountStore";
import { SidebarHeader } from "./SidebarHeader";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useRouter } from "next/router";
import HotkeyTooltipWrapper from "../HotkeyTooltipWrapper";
import { Badge } from "@/components/ui/badge";

const ChannelsOverview = () => {
  const router = useRouter();
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
          className={classNames(
            selectedChannelUrl === url
              ? "bg-background text-foreground font-normal"
              : "text-foreground/80 hover:text-foreground/80 hover:bg-background",
              "flex align-center justify-between gap-x-3 rounded-md p-1 text-sm leading-6 cursor-pointer"
              )}
        >
          <span className="flex-nowrap truncate">{name}</span>
          <Badge variant="outline" className="w-16">{shortcut}</Badge>
        </div>
      </li>
    );
  };

  return (
    <div className="mt-4">
      <SidebarHeader
        title="Channels"
        actionTitle={"Manage"}
        onClick={() => router.push("/channels")}
      />
      <ul role="list" className="mt-2 mb-12">
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
              className={classNames(
                selectedChannelUrl === channel.url
                  ? "text-foreground font-semibold"
                  : "text-foreground/70 hover:text-foreground",
                "flex align-center justify-between gap-x-3 rounded-md p-1 text-sm leading-6 cursor-pointer"
              )}
            >
              <Tooltip.Provider delayDuration={50} skipDelayDuration={0}>
                <HotkeyTooltipWrapper
                  hotkey={
                    <div className="flex align-center">
                      {channel.icon_url && (
                        <img
                          src={channel.icon_url}
                          alt=""
                          className={classNames(
                            selectedChannelUrl === channel.url
                              ? "border-gray-100"
                              : "border-gray-400 hover:border-gray-300",
                            "mr-2 -mt-0.5 bg-gray-100 border h-5 w-5 flex-none rounded-full"
                          )}
                        />
                      )}
                      <span className="flex-nowrap">{channel.name}</span>
                    </div>
                  }
                  side="right"
                >
                  <div className="flex max-w-sm">
                    {channel.icon_url && (
                      <img
                        src={channel.icon_url}
                        alt=""
                        className={classNames(
                          selectedChannelUrl === channel.url
                            ? "border-gray-100"
                            : "border-gray-400 hover:border-gray-300",
                          "mr-1 mt-0.5 bg-gray-100 border h-5 w-5 flex-none rounded-full"
                        )}
                      />
                    )}
                    <span className="flex-nowrap truncate">{channel.name}</span>
                  </div>
                </HotkeyTooltipWrapper>
              </Tooltip.Provider>
              {idx < 8 && <Badge variant="outline" className="w-16">Shift + {idx + 2}</Badge>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ChannelsOverview;

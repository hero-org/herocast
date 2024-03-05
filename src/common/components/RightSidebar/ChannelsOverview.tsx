import React from "react";
import { ChannelType } from "@/common/constants/channels";
import { classNames } from "@/common/helpers/css";
import { CUSTOM_CHANNELS, useAccountStore } from "@/stores/useAccountStore";
import { SidebarHeader } from "./SidebarHeader";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useRouter } from "next/router";

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
              ? "bg-background text-foreground font-semibold"
              : "text-foreground/80 hover:text-foreground/80 hover:bg-background",
            "group align-center justify-between flex gap-x-3 rounded-md p-1 text-sm leading-6 cursor-pointer"
          )}
        >
          <span className="flex-nowrap truncate">{name}</span>
          <kbd className="flex flex-nowrap px-1.5 py-0.5 text-xs border rounded-md bg-muted text-primary border-foreground/60">
            {shortcut}
          </kbd>
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
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
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
                      <span className="flex-nowrap truncate">
                        {channel.name}
                      </span>
                    </div>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      align={"center"}
                      className="flex text-foreground data-[state=delayed-open]:data-[side=top]:animate-slideDownAndFade data-[state=delayed-open]:data-[side=right]:animate-slideLeftAndFade data-[state=delayed-open]:data-[side=left]:animate-slideRightAndFade data-[state=delayed-open]:data-[side=bottom]:animate-slideUpAndFade text-violet11 select-none rounded-[4px] bg-muted px-[15px] py-[10px] text-[15px] leading-none shadow-[hsl(206_22%_7%_/_35%)_0px_10px_38px_-10px,_hsl(206_22%_7%_/_20%)_0px_10px_20px_-15px] will-change-[transform,opacity]"
                      side="left"
                      sideOffset={5}
                    >
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
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </Tooltip.Provider>
              {idx < 9 && (
                <kbd className="flex flex-nowrap px-1.5 py-0.5 text-xs border rounded-md bg-muted text-primary border-foreground/60">
                  Shift + {idx + 1}
                </kbd>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ChannelsOverview;
